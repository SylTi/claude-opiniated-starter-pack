import Stripe from 'stripe'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  PaymentProvider,
  CheckoutSessionParams,
  CheckoutSessionResult,
  CustomerPortalParams,
  CustomerPortalResult,
  WebhookEvent,
  WebhookResult,
} from '#services/types/payment_provider'
import PaymentCustomer from '#models/payment_customer'
import Price from '#models/price'
import Subscription from '#models/subscription'
import ProcessedWebhookEvent from '#models/processed_webhook_event'
import { auditEventEmitter } from '#services/audit_event_emitter'
import { AUDIT_EVENT_TYPES } from '#constants/audit_events'
import { setRlsContext, setSystemRlsContext } from '#utils/rls_context'

export default class StripeProvider implements PaymentProvider {
  readonly name = 'stripe'
  private stripe: Stripe

  constructor() {
    const secretKey = env.get('STRIPE_SECRET_KEY')
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    this.stripe = new Stripe(secretKey)
  }

  /**
   * Create a checkout session for subscription
   * Tenant is the billing unit - no user-level subscriptions
   */
  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const { tenant, priceId, successUrl, cancelUrl, metadata } = params

    // Get the price from our database
    const price = await Price.query()
      .where('id', priceId)
      .where('provider', this.name)
      .preload('product', (query) => {
        query.preload('tier')
      })
      .firstOrFail()

    // Build client_reference_id: tenant_123
    const clientReferenceId = `tenant_${tenant.tenantId}`

    // Check if we have an existing Stripe customer
    let customerId: string | undefined
    const existingCustomer = await PaymentCustomer.findByTenant(tenant.tenantId, this.name)
    if (existingCustomer) {
      customerId = existingCustomer.providerCustomerId
    }

    if (app.inTest) {
      return { sessionId: 'test_session', url: successUrl }
    }

    // Create the checkout session
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.providerPriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: clientReferenceId,
      customer: customerId,
      customer_email: customerId ? undefined : tenant.email,
      metadata: {
        ...metadata,
        tenant_id: String(tenant.tenantId),
        tier_id: String(price.product.tierId),
      },
    })

    if (!session.url) {
      throw new Error('Failed to create checkout session URL')
    }

    return {
      sessionId: session.id,
      url: session.url,
    }
  }

  /**
   * Create a customer portal session
   */
  async createCustomerPortalSession(params: CustomerPortalParams): Promise<CustomerPortalResult> {
    const { tenant, returnUrl } = params

    // Find existing payment customer
    const paymentCustomer = await PaymentCustomer.findByTenant(tenant.tenantId, this.name)

    if (!paymentCustomer) {
      throw new Error('No payment customer found for this tenant')
    }

    if (app.inTest) {
      return { url: returnUrl }
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: paymentCustomer.providerCustomerId,
      return_url: returnUrl,
    })

    return {
      url: session.url,
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    const webhookSecret = env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
    }

    try {
      this.stripe.webhooks.constructEvent(rawPayload, signature, webhookSecret)
      return true
    } catch {
      return false
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    const webhookSecret = env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
    }

    // Verify signature
    let stripeEvent: Stripe.Event
    try {
      stripeEvent = this.stripe.webhooks.constructEvent(
        event.rawPayload,
        event.signature,
        webhookSecret
      )
    } catch {
      throw new Error('Invalid webhook signature')
    }

    // Check idempotency
    const alreadyProcessed = await ProcessedWebhookEvent.hasBeenProcessed(stripeEvent.id, this.name)
    if (alreadyProcessed) {
      return {
        processed: false,
        eventType: stripeEvent.type,
        message: 'Event already processed',
      }
    }

    // Process the event within a transaction
    await db.transaction(async (trx) => {
      switch (stripeEvent.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(
            stripeEvent.data.object as Stripe.Checkout.Session,
            trx
          )
          break

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription, trx)
          break

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription, trx)
          break

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(stripeEvent.data.object as Stripe.Invoice, trx)
          break

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(stripeEvent.data.object as Stripe.Invoice, trx)
          break

        default:
          // Unhandled event type - still mark as processed
          break
      }

      // Mark event as processed (within transaction)
      await ProcessedWebhookEvent.create(
        {
          eventId: stripeEvent.id,
          provider: this.name,
          eventType: stripeEvent.type,
          processedAt: DateTime.now(),
        },
        { client: trx }
      )
    })

    return {
      processed: true,
      eventType: stripeEvent.type,
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.cancel(providerSubscriptionId)
  }

  /**
   * Handle checkout.session.completed event
   * Tenant is the billing unit - extract tenantId from client_reference_id
   */
  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
    trx: TransactionClientContract
  ): Promise<void> {
    // Extract tenant info from client_reference_id
    const clientReferenceId = session.client_reference_id
    if (!clientReferenceId) {
      throw new Error('Missing client_reference_id in checkout session')
    }

    // Format: tenant_123
    const [prefix, tenantIdStr] = clientReferenceId.split('_')
    const tenantId = Number.parseInt(tenantIdStr, 10)

    if (prefix !== 'tenant' || !tenantId || Number.isNaN(tenantId)) {
      throw new Error(`Invalid client_reference_id format: ${clientReferenceId}`)
    }

    // Get the Stripe subscription
    if (!session.subscription) {
      throw new Error('Missing subscription in checkout session')
    }

    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      session.subscription as string
    )

    // Get the price from the subscription
    const stripePriceId = stripeSubscription.items.data[0]?.price.id
    if (!stripePriceId) {
      throw new Error('Missing price in Stripe subscription')
    }

    // Find our local price
    const price = await Price.findByProviderPriceId(this.name, stripePriceId)
    if (!price) {
      throw new Error(`Price not found for Stripe price ID: ${stripePriceId}`)
    }

    // Set RLS context for this tenant operation
    // Webhooks run outside HttpContext, so we must set context explicitly
    await setRlsContext(trx, tenantId)

    // Create or update payment customer for the tenant
    await PaymentCustomer.upsertByTenant(tenantId, this.name, session.customer as string)

    // Cancel existing active subscriptions via instance methods (RLS-aware)
    const activeSubscriptions = await Subscription.query({ client: trx })
      .where('tenantId', tenantId)
      .where('status', 'active')

    for (const sub of activeSubscriptions) {
      sub.status = 'cancelled'
      sub.useTransaction(trx)
      await sub.save()
    }

    // Calculate expiration from Stripe subscription
    // Note: current_period_end is on the Subscription object per Stripe API docs,
    // but Stripe SDK v20 types are incomplete. Using type assertion.
    const subWithPeriod = stripeSubscription as unknown as { current_period_end?: number }
    const currentPeriodEnd = subWithPeriod.current_period_end
    const expiresAt = currentPeriodEnd ? DateTime.fromSeconds(currentPeriodEnd) : null

    // Create new subscription
    const newSubscription = await Subscription.create(
      {
        tenantId,
        tierId: price.product.tierId,
        status: 'active',
        startsAt: DateTime.now(),
        expiresAt,
        providerName: this.name,
        providerSubscriptionId: stripeSubscription.id,
      },
      { client: trx }
    )

    // Emit audit event for subscription creation
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.SUBSCRIPTION_CREATE,
      tenantId,
      actor: auditEventEmitter.createServiceActor('stripe'),
      resource: { type: 'subscription', id: newSubscription.id },
      meta: { tierId: price.product.tierId, stripeSubscriptionId: stripeSubscription.id },
    })
  }

  /**
   * Handle customer.subscription.updated event
   */
  private async handleSubscriptionUpdated(
    stripeSubscription: Stripe.Subscription,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup (we don't know tenant yet)
    // RLS policies must allow reads when user_id=0
    await setSystemRlsContext(trx)

    // Find our local subscription
    const subscription = await Subscription.query({ client: trx })
      .where('providerName', this.name)
      .where('providerSubscriptionId', stripeSubscription.id)
      .preload('tier')
      .first()

    if (!subscription) {
      // Subscription not found - might be created outside our system
      return
    }

    // Switch to tenant-scoped RLS context for updates
    await setRlsContext(trx, subscription.tenantId)

    // Map Stripe status to our status
    let status: 'active' | 'expired' | 'cancelled' = 'active'
    if (stripeSubscription.status === 'canceled') {
      status = 'cancelled'
    } else if (stripeSubscription.status === 'past_due' || stripeSubscription.status === 'unpaid') {
      // Keep as active but may want to handle differently
      status = 'active'
    } else if (stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing') {
      status = 'active'
    }

    // Update expiration
    // Note: current_period_end is on the Subscription object per Stripe API docs,
    // but Stripe SDK v20 types are incomplete. Using type assertion.
    const subWithPeriod = stripeSubscription as unknown as { current_period_end?: number }
    const currentPeriodEnd = subWithPeriod.current_period_end
    const expiresAt = currentPeriodEnd ? DateTime.fromSeconds(currentPeriodEnd) : null

    // Check if plan changed
    const stripePriceId = stripeSubscription.items.data[0]?.price.id
    if (stripePriceId) {
      const price = await Price.findByProviderPriceId(this.name, stripePriceId)
      if (price && price.product.tierId !== subscription.tierId) {
        subscription.tierId = price.product.tierId
      }
    }

    subscription.status = status
    subscription.expiresAt = expiresAt
    subscription.useTransaction(trx)
    await subscription.save()

    // Emit audit event for subscription update
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.SUBSCRIPTION_UPDATE,
      tenantId: subscription.tenantId,
      actor: auditEventEmitter.createServiceActor('stripe'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { status, stripeStatus: stripeSubscription.status },
    })
  }

  /**
   * Handle customer.subscription.deleted event
   */
  private async handleSubscriptionDeleted(
    stripeSubscription: Stripe.Subscription,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup (we don't know tenant yet)
    await setSystemRlsContext(trx)

    // Find our local subscription
    const subscription = await Subscription.query({ client: trx })
      .where('providerName', this.name)
      .where('providerSubscriptionId', stripeSubscription.id)
      .preload('tier')
      .first()

    if (!subscription) {
      return
    }

    // Switch to tenant-scoped RLS context for updates
    await setRlsContext(trx, subscription.tenantId)

    // Mark as cancelled
    subscription.status = 'cancelled'
    subscription.useTransaction(trx)
    await subscription.save()

    // Emit audit event for subscription cancellation
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.SUBSCRIPTION_CANCEL,
      tenantId: subscription.tenantId,
      actor: auditEventEmitter.createServiceActor('stripe'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { stripeSubscriptionId: stripeSubscription.id },
    })

    // Downgrade tenant to free tier (pass transaction with RLS context)
    await Subscription.downgradeTenantToFree(subscription.tenantId, trx)
  }

  /**
   * Handle invoice.payment_failed event
   */
  private async handlePaymentFailed(
    invoice: Stripe.Invoice,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup
    await setSystemRlsContext(trx)

    // Get subscription ID from invoice
    const invoiceData = invoice as unknown as { subscription?: string | { id: string } | null }
    const subscriptionId =
      typeof invoiceData.subscription === 'string'
        ? invoiceData.subscription
        : (invoiceData.subscription?.id ?? null)

    let tenantId: number | null = null

    if (subscriptionId) {
      const subscription = await Subscription.query({ client: trx })
        .where('providerName', this.name)
        .where('providerSubscriptionId', subscriptionId)
        .first()
      tenantId = subscription?.tenantId ?? null
    }

    // Emit audit event for payment failure
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.BILLING_PAYMENT_FAILURE,
      tenantId,
      actor: auditEventEmitter.createServiceActor('stripe'),
      resource: subscriptionId ? { type: 'invoice', id: invoice.id ?? 'unknown' } : undefined,
      meta: { invoiceId: invoice.id, stripeSubscriptionId: subscriptionId },
    })
  }

  /**
   * Handle invoice.payment_succeeded event
   */
  private async handlePaymentSucceeded(
    invoice: Stripe.Invoice,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup
    await setSystemRlsContext(trx)

    // Get subscription ID from invoice metadata or parent subscription
    // In Stripe v20+, subscription might be accessed differently
    const invoiceData = invoice as unknown as { subscription?: string | { id: string } | null }
    const subscriptionId =
      typeof invoiceData.subscription === 'string'
        ? invoiceData.subscription
        : (invoiceData.subscription?.id ?? null)

    if (!subscriptionId) {
      return
    }

    const subscription = await Subscription.query({ client: trx })
      .where('providerName', this.name)
      .where('providerSubscriptionId', subscriptionId)
      .preload('tier')
      .first()

    if (!subscription) {
      return
    }

    // Switch to tenant-scoped RLS context for updates
    await setRlsContext(trx, subscription.tenantId)

    // Update expiration based on invoice period
    const periodEnd = invoice.lines.data[0]?.period?.end
    if (periodEnd) {
      subscription.expiresAt = DateTime.fromSeconds(periodEnd)
      subscription.useTransaction(trx)
      await subscription.save()
    }

    // Emit audit event for payment success
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.BILLING_PAYMENT_SUCCESS,
      tenantId: subscription.tenantId,
      actor: auditEventEmitter.createServiceActor('stripe'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { invoiceId: invoice.id, amountPaid: invoice.amount_paid },
    })
  }
}

import { Polar } from '@polar-sh/sdk'
import crypto from 'node:crypto'
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
import { hookRegistry } from '@saas/plugins-core'
import { PaymentProviderConfigError, WebhookVerificationError } from '#exceptions/billing_errors'

/**
 * Polar webhook event data shape
 * Polar uses the Standard Webhooks (Svix) format for signatures.
 */
interface PolarWebhookPayload {
  type: string
  timestamp: string
  data: Record<string, unknown>
}

export default class PolarProvider implements PaymentProvider {
  readonly name = 'polar'
  private polar: Polar
  readonly organizationId: string | undefined

  constructor() {
    const accessToken = env.get('POLAR_ACCESS_TOKEN')
    if (!accessToken) {
      throw new PaymentProviderConfigError('polar', 'POLAR_ACCESS_TOKEN')
    }

    this.organizationId = env.get('POLAR_ORGANIZATION_ID')
    this.polar = new Polar({ accessToken })
  }

  /**
   * Create a checkout session for subscription
   * Tenant is the billing unit - no user-level subscriptions
   */
  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const { tenant, priceId, successUrl, metadata } = params

    // Get the price from our database
    const price = await Price.query()
      .where('id', priceId)
      .where('provider', this.name)
      .preload('product', (query) => {
        query.preload('tier')
      })
      .firstOrFail()

    if (app.inTest) {
      return { sessionId: 'test_session', url: successUrl }
    }

    // Polar SDK requires product IDs (not price IDs)
    // The providerProductId on our Product model maps to Polar's product ID
    const result = await this.polar.checkouts.create({
      products: [price.product.providerProductId],
      successUrl,
      customerEmail: tenant.email,
      metadata: {
        ...metadata,
        tenant_id: String(tenant.tenantId),
        tier_id: String(price.product.tierId),
      },
    })

    return {
      sessionId: result.id,
      url: result.url,
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

    const session = await this.polar.customerSessions.create({
      customerId: paymentCustomer.providerCustomerId,
    })

    return {
      url: session.customerPortalUrl,
    }
  }

  /**
   * Verify webhook signature using Standard Webhooks (Svix) format
   *
   * Polar uses the Standard Webhooks spec with headers:
   *   - webhook-id
   *   - webhook-timestamp
   *   - webhook-signature (format: "v1,BASE64_HMAC")
   *
   * Since our PaymentProvider interface passes a single signature string,
   * we encode webhook-id, webhook-timestamp, and webhook-signature as a
   * pipe-delimited string from the controller: "webhookId|timestamp|signature"
   *
   * The HMAC is computed over: `${webhookId}.${timestamp}.${body}`
   * using the base64-decoded webhook secret.
   */
  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    const webhookSecret = env.get('POLAR_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new PaymentProviderConfigError('polar', 'POLAR_WEBHOOK_SECRET')
    }

    try {
      // Signature format from controller: "webhookId|timestamp|v1,base64sig"
      const parts = signature.split('|')
      if (parts.length !== 3) {
        return false
      }

      const [webhookId, timestamp, signatureHeader] = parts

      if (!webhookId || !timestamp || !signatureHeader) {
        return false
      }

      // Parse the signature header (format: "v1,BASE64_HMAC")
      const signatures = signatureHeader.split(' ')
      const signedContent = `${webhookId}.${timestamp}.${rawPayload}`

      // Polar webhook secret may be prefixed with "whsec_"
      const secretBytes = Buffer.from(
        webhookSecret.startsWith('whsec_') ? webhookSecret.slice(6) : webhookSecret,
        'base64'
      )

      const expectedSignature = crypto
        .createHmac('sha256', secretBytes)
        .update(signedContent)
        .digest('base64')

      // Check against all provided signature versions
      for (const sig of signatures) {
        const [version, value] = sig.split(',')
        if (version === 'v1' && value) {
          // Constant-time comparison
          const expected = Buffer.from(expectedSignature)
          const received = Buffer.from(value)
          if (expected.length === received.length && crypto.timingSafeEqual(expected, received)) {
            return true
          }
        }
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    // Verify signature
    if (!this.verifyWebhookSignature(event.rawPayload, event.signature)) {
      throw new WebhookVerificationError(this.name)
    }

    // Parse the webhook payload
    const payload: PolarWebhookPayload = JSON.parse(event.rawPayload)
    const eventType = payload.type
    const data = payload.data

    // Generate a unique event ID from the payload data
    const dataId = (data.id as string) || ''
    const eventId = `${this.name}_${eventType}_${dataId}`

    // Check idempotency
    const alreadyProcessed = await ProcessedWebhookEvent.hasBeenProcessed(eventId, this.name)
    if (alreadyProcessed) {
      return {
        processed: false,
        eventType,
        message: 'Event already processed',
      }
    }

    // Process the event within a transaction
    await db.transaction(async (trx) => {
      switch (eventType) {
        case 'checkout.created':
          await this.handleCheckoutCompleted(data, trx)
          break

        case 'subscription.updated':
        case 'subscription.active':
          await this.handleSubscriptionUpdated(data, trx)
          break

        case 'subscription.revoked':
        case 'subscription.canceled':
          await this.handleSubscriptionDeleted(data, trx)
          break

        case 'order.created':
          await this.handlePaymentSucceeded(data, trx)
          break

        default:
          // Unhandled event type - still mark as processed
          break
      }

      // Mark event as processed (within transaction)
      await ProcessedWebhookEvent.create(
        {
          eventId,
          provider: this.name,
          eventType,
          processedAt: DateTime.now(),
        },
        { client: trx }
      )
    })

    return {
      processed: true,
      eventType,
    }
  }

  /**
   * Cancel a subscription at the provider
   */
  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    await this.polar.subscriptions.revoke({
      id: providerSubscriptionId,
    })
  }

  /**
   * Handle checkout.created event (when checkout status is succeeded)
   * Tenant is the billing unit - extract tenantId from metadata
   */
  private async handleCheckoutCompleted(
    data: Record<string, unknown>,
    trx: TransactionClientContract
  ): Promise<void> {
    // Only process completed/succeeded checkouts
    const status = data.status as string | undefined
    if (status !== 'succeeded' && status !== 'confirmed') {
      return
    }

    // Extract tenant info from metadata
    const metadata = (data.metadata as Record<string, string>) || {}
    const tenantIdStr = metadata.tenant_id
    if (!tenantIdStr) {
      throw new Error('Missing tenant_id in checkout metadata')
    }

    const tenantId = Number.parseInt(tenantIdStr, 10)
    if (!tenantId || Number.isNaN(tenantId)) {
      throw new Error(`Invalid tenant_id in checkout metadata: ${tenantIdStr}`)
    }

    // Extract subscription and customer info from checkout data
    const customerId = (data.customerId as string) || (data.customer_id as string)
    if (!customerId) {
      throw new Error('Missing customerId in checkout data')
    }

    const subscriptionId = (data.subscriptionId as string) || (data.subscription_id as string)
    if (!subscriptionId) {
      throw new Error('Missing subscriptionId in checkout data')
    }

    // Find the price from checkout data
    const productPriceId = (data.productPriceId as string) || (data.product_price_id as string)
    if (!productPriceId) {
      throw new Error('Missing productPriceId in checkout data')
    }

    const price = await Price.findByProviderPriceId(this.name, productPriceId)
    if (!price) {
      throw new Error(`Price not found for Polar price ID: ${productPriceId}`)
    }

    // Set RLS context for this tenant operation
    // Webhooks run outside HttpContext, so we must set context explicitly
    await setRlsContext(trx, tenantId)

    // Create or update payment customer for the tenant
    await PaymentCustomer.upsertByTenant(tenantId, this.name, customerId)

    // Cancel existing active subscriptions via instance methods (RLS-aware)
    const activeSubscriptions = await Subscription.query({ client: trx })
      .where('tenantId', tenantId)
      .where('status', 'active')

    for (const sub of activeSubscriptions) {
      sub.status = 'cancelled'
      sub.useTransaction(trx)
      await sub.save()
    }

    // Calculate expiration from subscription data if available
    const currentPeriodEnd = data.currentPeriodEnd as string | undefined
    const expiresAt = currentPeriodEnd ? DateTime.fromISO(currentPeriodEnd) : null

    // Create new subscription
    const newSubscription = await Subscription.create(
      {
        tenantId,
        tierId: price.product.tierId,
        status: 'active',
        startsAt: DateTime.now(),
        expiresAt,
        providerName: this.name,
        providerSubscriptionId: subscriptionId,
      },
      { client: trx }
    )

    // Emit audit event for subscription creation
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.SUBSCRIPTION_CREATE,
      tenantId,
      actor: auditEventEmitter.createServiceActor('polar'),
      resource: { type: 'subscription', id: newSubscription.id },
      meta: { tierId: price.product.tierId, polarSubscriptionId: subscriptionId },
    })

    // Emit plugin hooks
    hookRegistry
      .doAction('billing:customer_created', {
        tenantId,
        customerId,
      })
      .catch(() => {})

    hookRegistry
      .doAction('billing:subscription_created', {
        tenantId,
        subscriptionId: newSubscription.id,
        tierId: price.product.tierId,
        providerSubscriptionId: subscriptionId,
        amount: data.amount as number | undefined,
        currency: data.currency as string | undefined,
        interval: data.recurringInterval as string | undefined,
      })
      .catch(() => {})
  }

  /**
   * Handle subscription.updated / subscription.active event
   */
  private async handleSubscriptionUpdated(
    data: Record<string, unknown>,
    trx: TransactionClientContract
  ): Promise<void> {
    const polarSubscriptionId = data.id as string
    if (!polarSubscriptionId) {
      return
    }

    // Set system RLS context for initial lookup (we don't know tenant yet)
    // RLS policies must allow reads when user_id=0
    await setSystemRlsContext(trx)

    // Find our local subscription
    const subscription = await Subscription.query({ client: trx })
      .where('providerName', this.name)
      .where('providerSubscriptionId', polarSubscriptionId)
      .preload('tier')
      .first()

    if (!subscription) {
      // Subscription not found - might be created outside our system
      return
    }

    // Switch to tenant-scoped RLS context for updates
    await setRlsContext(trx, subscription.tenantId)

    // Map Polar status to our status
    const polarStatus = data.status as string
    let status: 'active' | 'expired' | 'cancelled' = 'active'
    if (polarStatus === 'canceled' || polarStatus === 'revoked') {
      status = 'cancelled'
    } else if (polarStatus === 'past_due' || polarStatus === 'unpaid') {
      // Keep as active but may want to handle differently
      status = 'active'
    } else if (polarStatus === 'active' || polarStatus === 'trialing') {
      status = 'active'
    }

    // Update expiration from Polar subscription period end
    const currentPeriodEnd = data.currentPeriodEnd as string | undefined
    const expiresAt = currentPeriodEnd ? DateTime.fromISO(currentPeriodEnd) : null

    // Check if plan changed via prices array
    const prices = data.prices as Array<Record<string, unknown>> | undefined
    if (prices && prices.length > 0) {
      const polarPriceId = prices[0]?.id as string | undefined
      if (polarPriceId) {
        const price = await Price.findByProviderPriceId(this.name, polarPriceId)
        if (price && price.product.tierId !== subscription.tierId) {
          subscription.tierId = price.product.tierId
        }
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
      actor: auditEventEmitter.createServiceActor('polar'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { status, polarStatus },
    })

    // Emit plugin hook
    hookRegistry
      .doAction('billing:subscription_updated', {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        status,
        previousStatus: polarStatus,
        tierId: subscription.tierId,
        amount: data.amount as number | undefined,
        currency: data.currency as string | undefined,
        interval: data.recurringInterval as string | undefined,
      })
      .catch(() => {})
  }

  /**
   * Handle subscription.revoked / subscription.canceled event
   */
  private async handleSubscriptionDeleted(
    data: Record<string, unknown>,
    trx: TransactionClientContract
  ): Promise<void> {
    const polarSubscriptionId = data.id as string
    if (!polarSubscriptionId) {
      return
    }

    // Set system RLS context for initial lookup (we don't know tenant yet)
    await setSystemRlsContext(trx)

    // Find our local subscription
    const subscription = await Subscription.query({ client: trx })
      .where('providerName', this.name)
      .where('providerSubscriptionId', polarSubscriptionId)
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
      actor: auditEventEmitter.createServiceActor('polar'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { polarSubscriptionId },
    })

    // Emit plugin hook
    hookRegistry
      .doAction('billing:subscription_cancelled', {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        tierId: subscription.tierId,
      })
      .catch(() => {})

    // Downgrade tenant to free tier (pass transaction with RLS context)
    await Subscription.downgradeTenantToFree(subscription.tenantId, trx)
  }

  /**
   * Handle order.created event (payment succeeded / renewal)
   */
  private async handlePaymentSucceeded(
    data: Record<string, unknown>,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup
    await setSystemRlsContext(trx)

    // Get subscription ID from order data
    const subscriptionId =
      (data.subscriptionId as string) || (data.subscription_id as string) || null

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

    // Update expiration based on subscription data in the order
    // Polar orders include subscription details with period info
    const subscriptionData = data.subscription as Record<string, unknown> | undefined
    const currentPeriodEnd = subscriptionData?.currentPeriodEnd as string | undefined
    if (currentPeriodEnd) {
      subscription.expiresAt = DateTime.fromISO(currentPeriodEnd)
      subscription.useTransaction(trx)
      await subscription.save()
    }

    // Emit audit event for payment success
    const orderId = (data.id as string) || 'unknown'
    const amountPaid = data.amount as number | undefined
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.BILLING_PAYMENT_SUCCESS,
      tenantId: subscription.tenantId,
      actor: auditEventEmitter.createServiceActor('polar'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { orderId, amountPaid },
    })

    // Emit plugin hook
    hookRegistry
      .doAction('billing:invoice_paid', {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        amountPaid,
        currency: data.currency as string | undefined,
        invoiceId: orderId,
      })
      .catch(() => {})
  }
}

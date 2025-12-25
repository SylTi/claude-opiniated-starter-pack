import Stripe from 'stripe'
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
   */
  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const { subscriber, priceId, successUrl, cancelUrl, metadata } = params

    // Get the price from our database
    const price = await Price.query()
      .where('id', priceId)
      .where('provider', this.name)
      .preload('product', (query) => {
        query.preload('tier')
      })
      .firstOrFail()

    // Build client_reference_id: user_123 or team_456
    const clientReferenceId = `${subscriber.type}_${subscriber.id}`

    // Check if we have an existing Stripe customer
    let customerId: string | undefined
    const existingCustomer = await PaymentCustomer.findBySubscriber(
      subscriber.type,
      subscriber.id,
      this.name
    )
    if (existingCustomer) {
      customerId = existingCustomer.providerCustomerId
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
      customer_email: customerId ? undefined : subscriber.email,
      metadata: {
        ...metadata,
        subscriber_type: subscriber.type,
        subscriber_id: String(subscriber.id),
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
    const { subscriber, returnUrl } = params

    // Find existing payment customer
    const paymentCustomer = await PaymentCustomer.findBySubscriber(
      subscriber.type,
      subscriber.id,
      this.name
    )

    if (!paymentCustomer) {
      throw new Error('No payment customer found for this subscriber')
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
   */
  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
    trx: TransactionClientContract
  ): Promise<void> {
    // Extract subscriber info from client_reference_id
    const clientReferenceId = session.client_reference_id
    if (!clientReferenceId) {
      throw new Error('Missing client_reference_id in checkout session')
    }

    const [subscriberType, subscriberIdStr] = clientReferenceId.split('_')
    const subscriberId = Number.parseInt(subscriberIdStr, 10)

    if (!subscriberType || !subscriberId || Number.isNaN(subscriberId)) {
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

    // Create or update payment customer
    await PaymentCustomer.upsertBySubscriber(
      subscriberType as 'user' | 'team',
      subscriberId,
      this.name,
      session.customer as string
    )

    // Cancel existing active subscriptions
    await Subscription.query({ client: trx })
      .where('subscriberType', subscriberType)
      .where('subscriberId', subscriberId)
      .where('status', 'active')
      .update({ status: 'cancelled' })

    // Calculate expiration from Stripe subscription
    const currentPeriodEnd = stripeSubscription.items.data[0]?.current_period_end
    const expiresAt = currentPeriodEnd ? DateTime.fromSeconds(currentPeriodEnd) : null

    // Create new subscription
    await Subscription.create(
      {
        subscriberType: subscriberType as 'user' | 'team',
        subscriberId,
        tierId: price.product.tierId,
        status: 'active',
        startsAt: DateTime.now(),
        expiresAt,
        providerName: this.name,
        providerSubscriptionId: stripeSubscription.id,
      },
      { client: trx }
    )
  }

  /**
   * Handle customer.subscription.updated event
   */
  private async handleSubscriptionUpdated(
    stripeSubscription: Stripe.Subscription,
    trx: TransactionClientContract
  ): Promise<void> {
    // Find our local subscription
    const subscription = await Subscription.findByProviderSubscriptionId(
      this.name,
      stripeSubscription.id
    )

    if (!subscription) {
      // Subscription not found - might be created outside our system
      return
    }

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
    const currentPeriodEnd = stripeSubscription.items.data[0]?.current_period_end
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
  }

  /**
   * Handle customer.subscription.deleted event
   */
  private async handleSubscriptionDeleted(
    stripeSubscription: Stripe.Subscription,
    trx: TransactionClientContract
  ): Promise<void> {
    // Find our local subscription
    const subscription = await Subscription.findByProviderSubscriptionId(
      this.name,
      stripeSubscription.id
    )

    if (!subscription) {
      return
    }

    // Mark as cancelled
    subscription.status = 'cancelled'
    subscription.useTransaction(trx)
    await subscription.save()

    // Create free tier subscription
    if (subscription.subscriberType === 'user') {
      await Subscription.downgradeUserToFree(subscription.subscriberId)
    } else {
      await Subscription.downgradeTeamToFree(subscription.subscriberId)
    }
  }

  /**
   * Handle invoice.payment_failed event
   */
  private async handlePaymentFailed(
    _invoice: Stripe.Invoice,
    _trx: TransactionClientContract
  ): Promise<void> {
    // Log warning - could send email notification here
    // For now, we just mark the event as processed
    // The subscription status will be updated by customer.subscription.updated
  }

  /**
   * Handle invoice.payment_succeeded event
   */
  private async handlePaymentSucceeded(
    invoice: Stripe.Invoice,
    trx: TransactionClientContract
  ): Promise<void> {
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

    const subscription = await Subscription.findByProviderSubscriptionId(this.name, subscriptionId)

    if (!subscription) {
      return
    }

    // Update expiration based on invoice period
    const periodEnd = invoice.lines.data[0]?.period?.end
    if (periodEnd) {
      subscription.expiresAt = DateTime.fromSeconds(periodEnd)
      subscription.useTransaction(trx)
      await subscription.save()
    }
  }
}

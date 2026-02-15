import crypto from 'node:crypto'
import { Paddle, Environment, EventName } from '@paddle/paddle-node-sdk'
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
import { PaymentProviderConfigError, WebhookVerificationError } from '#exceptions/billing_errors'
import PaymentCustomer from '#models/payment_customer'
import Price from '#models/price'
import Subscription from '#models/subscription'
import ProcessedWebhookEvent from '#models/processed_webhook_event'
import { auditEventEmitter } from '#services/audit_event_emitter'
import { AUDIT_EVENT_TYPES } from '#constants/audit_events'
import { setRlsContext, setSystemRlsContext } from '#utils/rls_context'
import { hookRegistry } from '@saas/plugins-core'

const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = (() => {
  const parsed = Number.parseInt(process.env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300
})()

export default class PaddleProvider implements PaymentProvider {
  readonly name = 'paddle'
  private paddle: Paddle

  constructor() {
    const apiKey = env.get('PADDLE_API_KEY')
    if (!apiKey) {
      throw new PaymentProviderConfigError('paddle', 'PADDLE_API_KEY')
    }

    const paddleEnv = env.get('PADDLE_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production'
    const environment = paddleEnv === 'production' ? Environment.production : Environment.sandbox

    this.paddle = new Paddle(apiKey, { environment })
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

    // Check if we have an existing Paddle customer
    let customerId: string | undefined
    const existingCustomer = await PaymentCustomer.findByTenant(tenant.tenantId, this.name)
    if (existingCustomer) {
      customerId = existingCustomer.providerCustomerId
    }

    if (app.inTest) {
      return { sessionId: 'test_session', url: successUrl }
    }

    // Create a transaction (Paddle uses transactions for checkout)
    const transactionRequest: Record<string, unknown> = {
      items: [
        {
          priceId: price.providerPriceId,
          quantity: 1,
        },
      ],
      customData: {
        ...metadata,
        tenant_id: String(tenant.tenantId),
        tier_id: String(price.product.tierId),
      },
    }

    if (customerId) {
      transactionRequest.customerId = customerId
    }

    const transaction = await this.paddle.transactions.create(
      transactionRequest as unknown as Parameters<typeof this.paddle.transactions.create>[0]
    )

    const checkoutUrl =
      (transaction as unknown as { checkout?: { url?: string } }).checkout?.url ??
      (transaction as unknown as { checkoutUrl?: string }).checkoutUrl ??
      successUrl

    return {
      sessionId: transaction.id ?? 'unknown',
      url: checkoutUrl,
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

    // Find active subscription for the tenant
    const subscription = await Subscription.query()
      .where('tenantId', tenant.tenantId)
      .where('providerName', this.name)
      .where('status', 'active')
      .first()

    if (!subscription || !subscription.providerSubscriptionId) {
      throw new Error('No active subscription found for this tenant')
    }

    const session = await this.paddle.customerPortalSessions.create(
      paymentCustomer.providerCustomerId,
      [subscription.providerSubscriptionId]
    )

    const portalUrl = (session as unknown as { customerPortalUrl?: string }).customerPortalUrl
    if (!portalUrl) {
      throw new Error('Failed to create Paddle customer portal session URL')
    }

    return {
      url: portalUrl,
    }
  }

  /**
   * Verify webhook signature
   * Paddle signature format: ts=TIMESTAMP;h1=HASH
   */
  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    const webhookSecret = env.get('PADDLE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new WebhookVerificationError('paddle', 'PADDLE_WEBHOOK_SECRET is not configured')
    }

    try {
      // Parse the paddle-signature header: ts=TIMESTAMP;h1=HASH
      const parts = signature.split(';')
      const timestampPart = parts.find((p) => p.startsWith('ts='))
      const hashPart = parts.find((p) => p.startsWith('h1='))

      if (!timestampPart || !hashPart) {
        return false
      }

      const timestamp = timestampPart.replace('ts=', '')
      const expectedHash = hashPart.replace('h1=', '')
      const parsedTimestamp = Number.parseInt(timestamp, 10)

      if (Number.isNaN(parsedTimestamp)) {
        return false
      }

      const now = Math.floor(Date.now() / 1000)
      if (Math.abs(now - parsedTimestamp) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
        return false
      }

      // Compute HMAC-SHA256 of "timestamp:rawPayload"
      const computedHash = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${timestamp}:${rawPayload}`)
        .digest('hex')

      // Constant-time comparison
      const expectedBuffer = Buffer.from(expectedHash, 'hex')
      const computedBuffer = Buffer.from(computedHash, 'hex')

      if (expectedBuffer.length !== computedBuffer.length) {
        return false
      }

      return crypto.timingSafeEqual(expectedBuffer, computedBuffer)
    } catch {
      return false
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    const webhookSecret = env.get('PADDLE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new WebhookVerificationError('paddle', 'PADDLE_WEBHOOK_SECRET is not configured')
    }

    // Verify signature and unmarshal event
    let paddleEvent: Record<string, unknown>
    try {
      const unmarshalled = await this.paddle.webhooks.unmarshal(
        event.rawPayload,
        webhookSecret,
        event.signature
      )
      paddleEvent = unmarshalled as unknown as Record<string, unknown>
    } catch {
      throw new WebhookVerificationError('paddle', 'Invalid webhook signature')
    }

    const eventId = paddleEvent.eventId as string
    const eventType = paddleEvent.eventType as string

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
      const data = paddleEvent.data as Record<string, unknown>

      switch (eventType) {
        case EventName.TransactionCompleted:
          await this.handleCheckoutCompleted(data, trx)
          break

        case EventName.SubscriptionUpdated:
          await this.handleSubscriptionUpdated(data, trx)
          break

        case EventName.SubscriptionCanceled:
          await this.handleSubscriptionDeleted(data, trx)
          break

        case EventName.TransactionPaymentFailed:
          await this.handlePaymentFailed(data, trx)
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
   * Cancel a subscription
   */
  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    await this.paddle.subscriptions.cancel(providerSubscriptionId, {
      effectiveFrom: 'next_billing_period',
    })
  }

  /**
   * Handle transaction.completed event
   * Paddle sends custom data back in the transaction, including tenant_id
   */
  private async handleCheckoutCompleted(
    data: Record<string, unknown>,
    trx: TransactionClientContract
  ): Promise<void> {
    // Extract tenant info from custom data
    const customData = data.customData as Record<string, string> | null
    if (!customData || !customData.tenant_id) {
      throw new Error('Missing tenant_id in Paddle transaction custom data')
    }

    const tenantId = Number.parseInt(customData.tenant_id, 10)
    if (!tenantId || Number.isNaN(tenantId)) {
      throw new Error(`Invalid tenant_id in custom data: ${customData.tenant_id}`)
    }

    // Get the subscription ID from the transaction
    const subscriptionId = data.subscriptionId as string | null
    if (!subscriptionId) {
      throw new Error('Missing subscriptionId in Paddle transaction')
    }

    // Get the price from the transaction items
    const items = data.items as Array<Record<string, unknown>> | undefined
    const firstItem = items?.[0] as Record<string, unknown> | undefined
    const priceData = firstItem?.price as Record<string, unknown> | undefined
    const paddlePriceId = priceData?.id as string | undefined

    if (!paddlePriceId) {
      throw new Error('Missing price in Paddle transaction items')
    }

    // Find our local price
    const price = await Price.findByProviderPriceId(this.name, paddlePriceId)
    if (!price) {
      throw new Error(`Price not found for Paddle price ID: ${paddlePriceId}`)
    }

    // Set RLS context for this tenant operation
    // Webhooks run outside HttpContext, so we must set context explicitly
    await setRlsContext(trx, tenantId)

    // Create or update payment customer for the tenant
    const customerId = data.customerId as string
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

    // Calculate expiration from billing cycle if available
    // Paddle provides billing cycle info on the price, but for exact period end
    // we rely on subscription updates. Set null for now.
    const expiresAt: DateTime | null = null

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
      actor: auditEventEmitter.createServiceActor('paddle'),
      resource: { type: 'subscription', id: newSubscription.id },
      meta: { tierId: price.product.tierId, paddleSubscriptionId: subscriptionId },
    })

    // Emit plugin hooks
    hookRegistry
      .doAction('billing:customer_created', {
        tenantId,
        customerId,
      })
      .catch(() => {})

    const unitPrice = priceData?.unitPrice as Record<string, unknown> | undefined

    hookRegistry
      .doAction('billing:subscription_created', {
        tenantId,
        subscriptionId: newSubscription.id,
        tierId: price.product.tierId,
        providerSubscriptionId: subscriptionId,
        amount: unitPrice?.amount ?? null,
        currency: unitPrice?.currencyCode ?? null,
        interval: (priceData?.billingCycle as Record<string, unknown>)?.interval ?? null,
      })
      .catch(() => {})
  }

  /**
   * Handle subscription.updated event
   */
  private async handleSubscriptionUpdated(
    data: Record<string, unknown>,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup (we don't know tenant yet)
    // RLS policies must allow reads when user_id=0
    await setSystemRlsContext(trx)

    // Find our local subscription
    const paddleSubscriptionId = data.id as string
    const subscription = await Subscription.query({ client: trx })
      .where('providerName', this.name)
      .where('providerSubscriptionId', paddleSubscriptionId)
      .preload('tier')
      .first()

    if (!subscription) {
      // Subscription not found - might be created outside our system
      return
    }

    // Switch to tenant-scoped RLS context for updates
    await setRlsContext(trx, subscription.tenantId)

    // Map Paddle status to our status
    const paddleStatus = data.status as string
    let status: 'active' | 'expired' | 'cancelled' = 'active'
    if (paddleStatus === 'canceled') {
      status = 'cancelled'
    } else if (paddleStatus === 'paused') {
      status = 'cancelled'
    } else if (paddleStatus === 'active' || paddleStatus === 'trialing') {
      status = 'active'
    }

    // Update expiration from current billing period
    const currentBillingPeriod = data.currentBillingPeriod as Record<string, string> | undefined
    let expiresAt: DateTime | null = null
    if (currentBillingPeriod?.endsAt) {
      expiresAt = DateTime.fromISO(currentBillingPeriod.endsAt)
    }

    // Check if plan changed
    const items = data.items as Array<Record<string, unknown>> | undefined
    const firstItem = items?.[0] as Record<string, unknown> | undefined
    const priceData = firstItem?.price as Record<string, unknown> | undefined
    const paddlePriceId = priceData?.id as string | undefined

    if (paddlePriceId) {
      const price = await Price.findByProviderPriceId(this.name, paddlePriceId)
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
      actor: auditEventEmitter.createServiceActor('paddle'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { status, paddleStatus },
    })

    const unitPrice = priceData?.unitPrice as Record<string, unknown> | undefined
    const billingCycle = priceData?.billingCycle as Record<string, unknown> | undefined

    // Emit plugin hook
    hookRegistry
      .doAction('billing:subscription_updated', {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        status,
        previousStatus: paddleStatus,
        tierId: subscription.tierId,
        amount: unitPrice?.amount ?? null,
        currency: unitPrice?.currencyCode ?? null,
        interval: billingCycle?.interval ?? null,
      })
      .catch(() => {})
  }

  /**
   * Handle subscription.canceled event
   */
  private async handleSubscriptionDeleted(
    data: Record<string, unknown>,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup (we don't know tenant yet)
    await setSystemRlsContext(trx)

    // Find our local subscription
    const paddleSubscriptionId = data.id as string
    const subscription = await Subscription.query({ client: trx })
      .where('providerName', this.name)
      .where('providerSubscriptionId', paddleSubscriptionId)
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
      actor: auditEventEmitter.createServiceActor('paddle'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { paddleSubscriptionId },
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
   * Handle transaction.payment_failed event
   */
  private async handlePaymentFailed(
    data: Record<string, unknown>,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup
    await setSystemRlsContext(trx)

    // Get subscription ID from transaction data
    const paddleSubscriptionId = data.subscriptionId as string | null
    const transactionId = data.id as string

    let tenantId: number | null = null

    if (paddleSubscriptionId) {
      const subscription = await Subscription.query({ client: trx })
        .where('providerName', this.name)
        .where('providerSubscriptionId', paddleSubscriptionId)
        .first()
      tenantId = subscription?.tenantId ?? null
    }

    // Emit audit event for payment failure
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.BILLING_PAYMENT_FAILURE,
      tenantId,
      actor: auditEventEmitter.createServiceActor('paddle'),
      resource: paddleSubscriptionId ? { type: 'transaction', id: transactionId } : undefined,
      meta: { transactionId, paddleSubscriptionId },
    })

    // Emit plugin hook
    hookRegistry
      .doAction('billing:payment_failed', {
        tenantId,
        subscriptionId: paddleSubscriptionId,
        invoiceId: transactionId,
      })
      .catch(() => {})
  }
}

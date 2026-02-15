import {
  lemonSqueezySetup,
  createCheckout,
  cancelSubscription as lsCancelSubscription,
  getSubscription as lsGetSubscription,
} from '@lemonsqueezy/lemonsqueezy.js'
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
 * LemonSqueezy webhook payload shape
 */
interface LemonSqueezyWebhookBody {
  meta: {
    event_name: string
    custom_data?: {
      tenant_id?: string
      tier_id?: string
    }
  }
  data: {
    id: string
    type: string
    attributes: Record<string, unknown>
  }
}

/**
 * Build an idempotency key for LemonSqueezy webhooks.
 *
 * LemonSqueezy payload `data.id` identifies the resource (order/subscription),
 * not the webhook delivery event. Using resource IDs for dedupe drops legitimate
 * subsequent events for the same resource (for example repeated
 * `subscription_updated` events). Hashing the raw payload gives a stable key for
 * retries while preserving distinct updates.
 */
function buildLemonSqueezyEventId(rawPayload: string): string {
  const payloadHash = crypto.createHash('sha256').update(rawPayload).digest('hex')
  return `payload_${payloadHash}`
}

export default class LemonSqueezyProvider implements PaymentProvider {
  readonly name = 'lemonsqueezy'
  private storeId: string

  constructor() {
    const apiKey = env.get('LEMONSQUEEZY_API_KEY')
    if (!apiKey) {
      throw new PaymentProviderConfigError('lemonsqueezy', 'LEMONSQUEEZY_API_KEY')
    }

    const storeId = env.get('LEMONSQUEEZY_STORE_ID')
    if (!storeId) {
      throw new PaymentProviderConfigError('lemonsqueezy', 'LEMONSQUEEZY_STORE_ID')
    }

    lemonSqueezySetup({ apiKey })
    this.storeId = storeId
  }

  /**
   * Create a checkout session for subscription
   * Tenant is the billing unit - no user-level subscriptions
   */
  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const { tenant, priceId, successUrl } = params

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

    // LemonSqueezy createCheckout takes (storeId, variantId, options)
    // providerPriceId in our DB maps to the LemonSqueezy variant ID
    const { data, error } = await createCheckout(this.storeId, price.providerPriceId, {
      checkoutData: {
        email: tenant.email,
        custom: {
          tenant_id: String(tenant.tenantId),
          tier_id: String(price.product.tierId),
        },
      },
      checkoutOptions: {
        embed: false,
      },
      productOptions: {
        redirectUrl: successUrl,
      },
    })

    if (error) {
      throw new Error(`LemonSqueezy checkout creation failed: ${error.message}`)
    }

    if (!data?.data) {
      throw new Error('Failed to create LemonSqueezy checkout session')
    }

    return {
      sessionId: data.data.id,
      url: data.data.attributes.url as string,
    }
  }

  /**
   * Create a customer portal session
   * LemonSqueezy provides a customer_portal URL on the subscription object
   */
  async createCustomerPortalSession(params: CustomerPortalParams): Promise<CustomerPortalResult> {
    const { tenant, returnUrl } = params

    // Find active subscription for tenant
    const subscription = await Subscription.query()
      .where('tenantId', tenant.tenantId)
      .where('providerName', this.name)
      .where('status', 'active')
      .first()

    if (!subscription || !subscription.providerSubscriptionId) {
      throw new Error('No active LemonSqueezy subscription found for this tenant')
    }

    if (app.inTest) {
      return { url: returnUrl }
    }

    const { data, error } = await lsGetSubscription(subscription.providerSubscriptionId)

    if (error) {
      throw new Error(`Failed to retrieve LemonSqueezy subscription: ${error.message}`)
    }

    if (!data?.data) {
      throw new Error('LemonSqueezy subscription not found')
    }

    const urls = data.data.attributes.urls as {
      customer_portal?: string
      update_payment_method?: string
    }

    if (!urls?.customer_portal) {
      throw new Error('Customer portal URL not available for this subscription')
    }

    return {
      url: urls.customer_portal,
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    const webhookSecret = env.get('LEMONSQUEEZY_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new WebhookVerificationError(this.name, 'LEMONSQUEEZY_WEBHOOK_SECRET is not configured')
    }

    try {
      const hmac = crypto.createHmac('sha256', webhookSecret)
      const digest = hmac.update(rawPayload).digest('hex')
      const signatureBuffer = Buffer.from(signature, 'hex')
      const digestBuffer = Buffer.from(digest, 'hex')

      if (signatureBuffer.length !== digestBuffer.length) {
        return false
      }

      return crypto.timingSafeEqual(signatureBuffer, digestBuffer)
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
      throw new WebhookVerificationError(this.name, 'Invalid webhook signature')
    }

    // Parse the webhook body
    const body: LemonSqueezyWebhookBody = JSON.parse(event.rawPayload)
    const eventId = buildLemonSqueezyEventId(event.rawPayload)
    const eventType = body.meta.event_name

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
        case 'order_created':
          await this.handleCheckoutCompleted(body, trx)
          break

        case 'subscription_updated':
          await this.handleSubscriptionUpdated(body, trx)
          break

        case 'subscription_cancelled':
          await this.handleSubscriptionDeleted(body, trx)
          break

        case 'subscription_payment_failed':
          await this.handlePaymentFailed(body, trx)
          break

        case 'subscription_payment_success':
          await this.handlePaymentSucceeded(body, trx)
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
    await lsCancelSubscription(providerSubscriptionId)
  }

  /**
   * Handle order_created event (checkout completed)
   * Tenant is the billing unit - extract tenantId from custom_data
   */
  private async handleCheckoutCompleted(
    body: LemonSqueezyWebhookBody,
    trx: TransactionClientContract
  ): Promise<void> {
    // Extract tenant info from custom_data
    const customData = body.meta.custom_data
    if (!customData?.tenant_id) {
      throw new Error('Missing tenant_id in LemonSqueezy webhook custom_data')
    }

    const tenantId = Number.parseInt(customData.tenant_id, 10)
    if (!tenantId || Number.isNaN(tenantId)) {
      throw new Error(`Invalid tenant_id in custom_data: ${customData.tenant_id}`)
    }

    const attributes = body.data.attributes

    // Extract customer ID
    const customerId = String(attributes.customer_id)

    // Extract subscription ID from first_subscription_item or first_order_item
    const firstSubscriptionItem = attributes.first_subscription_item as {
      subscription_id?: number
    } | null
    const firstOrderItem = attributes.first_order_item as {
      subscription_id?: number
      price_id?: number
      variant_id?: number
    } | null

    const subscriptionId = firstSubscriptionItem?.subscription_id ?? firstOrderItem?.subscription_id
    if (!subscriptionId) {
      throw new Error('Missing subscription_id in LemonSqueezy order webhook')
    }

    // Find price by variant ID stored in our DB as providerPriceId
    const variantId = (attributes.variant_id as number) ?? firstOrderItem?.variant_id
    if (!variantId) {
      throw new Error('Missing variant_id in LemonSqueezy order webhook')
    }

    const price = await Price.findByProviderPriceId(this.name, String(variantId))
    if (!price) {
      throw new Error(`Price not found for LemonSqueezy variant ID: ${variantId}`)
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

    // Calculate expiration from renews_at
    const renewsAt = attributes.renews_at as string | null
    const expiresAt = renewsAt ? DateTime.fromISO(renewsAt) : null

    // Create new subscription
    const newSubscription = await Subscription.create(
      {
        tenantId,
        tierId: price.product.tierId,
        status: 'active',
        startsAt: DateTime.now(),
        expiresAt,
        providerName: this.name,
        providerSubscriptionId: String(subscriptionId),
      },
      { client: trx }
    )

    // Emit audit event for subscription creation
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.SUBSCRIPTION_CREATE,
      tenantId,
      actor: auditEventEmitter.createServiceActor('lemonsqueezy'),
      resource: { type: 'subscription', id: newSubscription.id },
      meta: {
        tierId: price.product.tierId,
        lemonSqueezySubscriptionId: String(subscriptionId),
      },
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
        providerSubscriptionId: String(subscriptionId),
        amount: attributes.total as number | undefined,
        currency: attributes.currency as string | undefined,
        interval: attributes.billing_anchor ? 'month' : undefined,
      })
      .catch(() => {})
  }

  /**
   * Handle subscription_updated event
   */
  private async handleSubscriptionUpdated(
    body: LemonSqueezyWebhookBody,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup (we don't know tenant yet)
    await setSystemRlsContext(trx)

    const providerSubscriptionId = String(body.data.id)
    const attributes = body.data.attributes

    // Find our local subscription
    const subscription = await Subscription.query({ client: trx })
      .where('providerName', this.name)
      .where('providerSubscriptionId', providerSubscriptionId)
      .preload('tier')
      .first()

    if (!subscription) {
      // Subscription not found - might be created outside our system
      return
    }

    // Switch to tenant-scoped RLS context for updates
    await setRlsContext(trx, subscription.tenantId)

    // Map LemonSqueezy status to our status
    const lsStatus = attributes.status as string
    let status: 'active' | 'expired' | 'cancelled' = 'active'
    if (lsStatus === 'cancelled') {
      status = 'cancelled'
    } else if (lsStatus === 'expired') {
      status = 'expired'
    } else if (lsStatus === 'paused') {
      status = 'cancelled'
    } else if (lsStatus === 'active' || lsStatus === 'on_trial') {
      status = 'active'
    } else if (lsStatus === 'past_due') {
      status = 'active'
    }

    // Update expiration from renews_at or ends_at
    const renewsAt = attributes.renews_at as string | null
    const endsAt = attributes.ends_at as string | null
    const expiresAt = endsAt
      ? DateTime.fromISO(endsAt)
      : renewsAt
        ? DateTime.fromISO(renewsAt)
        : null

    // Check if variant/price changed
    const variantId = attributes.variant_id as number | undefined
    if (variantId) {
      const price = await Price.findByProviderPriceId(this.name, String(variantId))
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
      actor: auditEventEmitter.createServiceActor('lemonsqueezy'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { status, lemonSqueezyStatus: lsStatus },
    })

    // Emit plugin hook
    hookRegistry
      .doAction('billing:subscription_updated', {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        status,
        previousStatus: lsStatus,
        tierId: subscription.tierId,
      })
      .catch(() => {})
  }

  /**
   * Handle subscription_cancelled event
   */
  private async handleSubscriptionDeleted(
    body: LemonSqueezyWebhookBody,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup (we don't know tenant yet)
    await setSystemRlsContext(trx)

    const providerSubscriptionId = String(body.data.id)

    // Find our local subscription
    const subscription = await Subscription.query({ client: trx })
      .where('providerName', this.name)
      .where('providerSubscriptionId', providerSubscriptionId)
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
      actor: auditEventEmitter.createServiceActor('lemonsqueezy'),
      resource: { type: 'subscription', id: subscription.id },
      meta: { lemonSqueezySubscriptionId: providerSubscriptionId },
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
   * Handle subscription_payment_failed event
   */
  private async handlePaymentFailed(
    body: LemonSqueezyWebhookBody,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup
    await setSystemRlsContext(trx)

    const attributes = body.data.attributes
    const subscriptionId = attributes.subscription_id ? String(attributes.subscription_id) : null

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
      actor: auditEventEmitter.createServiceActor('lemonsqueezy'),
      resource: subscriptionId ? { type: 'subscription_invoice', id: body.data.id } : undefined,
      meta: {
        invoiceId: body.data.id,
        lemonSqueezySubscriptionId: subscriptionId,
      },
    })

    // Emit plugin hook
    hookRegistry
      .doAction('billing:payment_failed', {
        tenantId,
        subscriptionId,
        invoiceId: body.data.id,
      })
      .catch(() => {})
  }

  /**
   * Handle subscription_payment_success event
   */
  private async handlePaymentSucceeded(
    body: LemonSqueezyWebhookBody,
    trx: TransactionClientContract
  ): Promise<void> {
    // Set system RLS context for initial lookup
    await setSystemRlsContext(trx)

    const attributes = body.data.attributes
    const subscriptionId = attributes.subscription_id ? String(attributes.subscription_id) : null

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

    // Update expiration based on renews_at from the subscription invoice
    const renewsAt = attributes.renews_at as string | null
    if (renewsAt) {
      subscription.expiresAt = DateTime.fromISO(renewsAt)
      subscription.useTransaction(trx)
      await subscription.save()
    }

    // Emit audit event for payment success
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.BILLING_PAYMENT_SUCCESS,
      tenantId: subscription.tenantId,
      actor: auditEventEmitter.createServiceActor('lemonsqueezy'),
      resource: { type: 'subscription', id: subscription.id },
      meta: {
        invoiceId: body.data.id,
        amountPaid: attributes.total as number | undefined,
      },
    })

    // Emit plugin hook
    hookRegistry
      .doAction('billing:invoice_paid', {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        amountPaid: attributes.total as number | undefined,
        currency: attributes.currency as string | undefined,
        invoiceId: body.data.id,
      })
      .catch(() => {})
  }
}

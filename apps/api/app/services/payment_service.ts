import type {
  PaymentProvider,
  CheckoutSessionResult,
  CustomerPortalResult,
  WebhookResult,
  TenantInfo,
} from '#services/types/payment_provider'
import StripeProvider from '#services/providers/stripe_provider'
import Tenant from '#models/tenant'
import Price from '#models/price'
import Product from '#models/product'
import PaymentCustomer from '#models/payment_customer'
import Subscription from '#models/subscription'

export default class PaymentService {
  private provider: PaymentProvider

  constructor(provider?: PaymentProvider) {
    this.provider = provider ?? new StripeProvider()
  }

  /**
   * Get the current provider name
   */
  get providerName(): string {
    return this.provider.name
  }

  /**
   * Get all billing tiers with prices
   */
  async getBillingTiers(): Promise<Product[]> {
    return Product.getProductsWithPrices(this.provider.name)
  }

  /**
   * Create a checkout session for a tenant
   * Tenant is the billing unit - no user-level subscriptions
   */
  async createCheckoutSession(
    tenantId: number,
    priceId: number,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    // Get tenant info
    const tenantInfo = await this.getTenantInfo(tenantId)

    // Verify the price exists and is active
    const price = await Price.query()
      .where('id', priceId)
      .where('provider', this.provider.name)
      .where('isActive', true)
      .first()

    if (!price) {
      throw new Error('Price not found or inactive')
    }

    return this.provider.createCheckoutSession({
      tenant: tenantInfo,
      priceId,
      successUrl,
      cancelUrl,
    })
  }

  /**
   * Create a customer portal session for a tenant
   */
  async createCustomerPortalSession(
    tenantId: number,
    returnUrl: string
  ): Promise<CustomerPortalResult> {
    // Check if tenant has a payment customer
    const paymentCustomer = await PaymentCustomer.findByTenant(tenantId, this.provider.name)

    if (!paymentCustomer) {
      throw new Error('No billing account found. Please subscribe first.')
    }

    // Get tenant info
    const tenantInfo = await this.getTenantInfo(tenantId)

    return this.provider.createCustomerPortalSession({
      tenant: tenantInfo,
      returnUrl,
    })
  }

  /**
   * Process a webhook
   */
  async processWebhook(rawPayload: string, signature: string): Promise<WebhookResult> {
    // Verify signature first
    if (!this.provider.verifyWebhookSignature(rawPayload, signature)) {
      throw new Error('Invalid webhook signature')
    }

    return this.provider.handleWebhook({
      id: '', // Will be extracted from payload
      type: '', // Will be extracted from payload
      data: {},
      rawPayload,
      signature,
    })
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscription: Subscription): Promise<void> {
    if (!subscription.providerSubscriptionId || subscription.providerName !== this.provider.name) {
      throw new Error('Subscription is not managed by this payment provider')
    }

    // Cancel at the provider
    await this.provider.cancelSubscription(subscription.providerSubscriptionId)

    // The webhook will handle updating the local subscription status
  }

  /**
   * Get current subscription for a tenant
   */
  async getCurrentSubscription(tenantId: number): Promise<Subscription | null> {
    return Subscription.getActiveForTenant(tenantId)
  }

  /**
   * Check if tenant can manage billing
   */
  async canManageBilling(tenantId: number): Promise<boolean> {
    const paymentCustomer = await PaymentCustomer.findByTenant(tenantId, this.provider.name)
    return paymentCustomer !== null
  }

  /**
   * Get tenant info for payment operations
   */
  private async getTenantInfo(tenantId: number): Promise<TenantInfo> {
    const tenant = await Tenant.query().where('id', tenantId).preload('owner').firstOrFail()

    // Use the owner's email for billing
    if (!tenant.owner) {
      throw new Error(
        `Tenant ${tenant.id} has no owner. This is a data integrity issue that must be resolved.`
      )
    }

    return {
      tenantId: tenant.id,
      email: tenant.owner.email,
      name: tenant.name,
    }
  }
}

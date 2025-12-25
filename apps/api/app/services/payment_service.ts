import type {
  PaymentProvider,
  CheckoutSessionResult,
  CustomerPortalResult,
  WebhookResult,
  SubscriberInfo,
} from '#services/types/payment_provider'
import StripeProvider from '#services/providers/stripe_provider'
import User from '#models/user'
import Team from '#models/team'
import Price from '#models/price'
import Product from '#models/product'
import PaymentCustomer from '#models/payment_customer'
import Subscription from '#models/subscription'
import type { SubscriberType } from '#models/subscription'

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
   * Create a checkout session
   */
  async createCheckoutSession(
    subscriberType: SubscriberType,
    subscriberId: number,
    priceId: number,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    // Get subscriber info
    const subscriberInfo = await this.getSubscriberInfo(subscriberType, subscriberId)

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
      subscriber: subscriberInfo,
      priceId,
      successUrl,
      cancelUrl,
    })
  }

  /**
   * Create a customer portal session
   */
  async createCustomerPortalSession(
    subscriberType: SubscriberType,
    subscriberId: number,
    returnUrl: string
  ): Promise<CustomerPortalResult> {
    // Check if subscriber has a payment customer
    const paymentCustomer = await PaymentCustomer.findBySubscriber(
      subscriberType,
      subscriberId,
      this.provider.name
    )

    if (!paymentCustomer) {
      throw new Error('No billing account found. Please subscribe first.')
    }

    // Get subscriber info
    const subscriberInfo = await this.getSubscriberInfo(subscriberType, subscriberId)

    return this.provider.createCustomerPortalSession({
      subscriber: subscriberInfo,
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
   * Get current subscription for a subscriber
   */
  async getCurrentSubscription(
    subscriberType: SubscriberType,
    subscriberId: number
  ): Promise<Subscription | null> {
    if (subscriberType === 'user') {
      return Subscription.getActiveForUser(subscriberId)
    }
    return Subscription.getActiveForTeam(subscriberId)
  }

  /**
   * Check if subscriber can manage billing
   */
  async canManageBilling(subscriberType: SubscriberType, subscriberId: number): Promise<boolean> {
    const paymentCustomer = await PaymentCustomer.findBySubscriber(
      subscriberType,
      subscriberId,
      this.provider.name
    )
    return paymentCustomer !== null
  }

  /**
   * Get subscriber info for payment operations
   */
  private async getSubscriberInfo(
    subscriberType: SubscriberType,
    subscriberId: number
  ): Promise<SubscriberInfo> {
    if (subscriberType === 'user') {
      const user = await User.findOrFail(subscriberId)
      return {
        type: 'user',
        id: user.id,
        email: user.email,
        name: user.fullName ?? undefined,
      }
    }

    // For team, use the owner's info for billing
    const team = await Team.query().where('id', subscriberId).preload('owner').firstOrFail()

    return {
      type: 'team',
      id: team.id,
      email: team.owner.email,
      name: team.name,
    }
  }
}

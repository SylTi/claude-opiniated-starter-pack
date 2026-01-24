/**
 * Information about the tenant initiating a payment action
 * Tenant is the billing unit - no user-level subscriptions
 */
export interface TenantInfo {
  tenantId: number
  email: string
  name?: string
}

/**
 * Parameters for creating a checkout session
 */
export interface CheckoutSessionParams {
  tenant: TenantInfo
  priceId: number
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

/**
 * Result of creating a checkout session
 */
export interface CheckoutSessionResult {
  sessionId: string
  url: string
}

/**
 * Parameters for creating a customer portal session
 */
export interface CustomerPortalParams {
  tenant: TenantInfo
  returnUrl: string
}

/**
 * Result of creating a customer portal session
 */
export interface CustomerPortalResult {
  url: string
}

/**
 * Webhook event data from the payment provider
 */
export interface WebhookEvent {
  id: string
  type: string
  data: Record<string, unknown>
  rawPayload: string
  signature: string
}

/**
 * Result of processing a webhook event
 */
export interface WebhookResult {
  processed: boolean
  eventType: string
  message?: string
}

/**
 * Payment provider interface
 * All payment providers must implement this interface
 */
export interface PaymentProvider {
  /**
   * The name of the payment provider (e.g., 'stripe')
   */
  readonly name: string

  /**
   * Create a checkout session for a subscription
   */
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>

  /**
   * Create a customer portal session for managing billing
   */
  createCustomerPortalSession(params: CustomerPortalParams): Promise<CustomerPortalResult>

  /**
   * Process a webhook event from the payment provider
   */
  handleWebhook(event: WebhookEvent): Promise<WebhookResult>

  /**
   * Verify the signature of a webhook payload
   */
  verifyWebhookSignature(rawPayload: string, signature: string): boolean

  /**
   * Cancel a subscription at the payment provider
   */
  cancelSubscription(providerSubscriptionId: string): Promise<void>
}

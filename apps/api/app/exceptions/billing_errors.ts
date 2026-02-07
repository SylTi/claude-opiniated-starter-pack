/**
 * Custom error classes for billing operations.
 */

/**
 * Thrown when attempting to add credit with a different currency than the existing balance
 */
export class CurrencyMismatchError extends Error {
  readonly code = 'CURRENCY_MISMATCH' as const
  readonly expectedCurrency: string
  readonly receivedCurrency: string

  constructor(expectedCurrency: string, receivedCurrency: string) {
    super(`Currency mismatch: expected ${expectedCurrency}, got ${receivedCurrency}`)
    this.name = 'CurrencyMismatchError'
    this.expectedCurrency = expectedCurrency
    this.receivedCurrency = receivedCurrency
  }
}

/**
 * Type guard to check if error is CurrencyMismatchError
 */
export function isCurrencyMismatchError(error: unknown): error is CurrencyMismatchError {
  return error instanceof CurrencyMismatchError
}

/**
 * Thrown when a discount code has reached its usage limit
 */
export class DiscountCodeLimitReachedError extends Error {
  readonly code = 'DISCOUNT_CODE_LIMIT_REACHED' as const
  readonly discountCodeId: number
  readonly reason: 'global_limit' | 'tenant_limit'

  constructor(discountCodeId: number, reason: 'global_limit' | 'tenant_limit') {
    const message =
      reason === 'global_limit'
        ? 'Discount code has reached its maximum number of uses'
        : 'You have already used this discount code the maximum number of times'
    super(message)
    this.name = 'DiscountCodeLimitReachedError'
    this.discountCodeId = discountCodeId
    this.reason = reason
  }
}

/**
 * Type guard to check if error is DiscountCodeLimitReachedError
 */
export function isDiscountCodeLimitReachedError(
  error: unknown
): error is DiscountCodeLimitReachedError {
  return error instanceof DiscountCodeLimitReachedError
}

/**
 * Thrown when a payment provider is not properly configured (missing env vars)
 */
export class PaymentProviderConfigError extends Error {
  readonly code = 'PAYMENT_PROVIDER_CONFIG_ERROR' as const
  readonly provider: string
  readonly missingVar: string

  constructor(provider: string, missingVar: string) {
    super(`Payment provider "${provider}" is not configured: missing ${missingVar}`)
    this.name = 'PaymentProviderConfigError'
    this.provider = provider
    this.missingVar = missingVar
  }
}

/**
 * Type guard to check if error is PaymentProviderConfigError
 */
export function isPaymentProviderConfigError(error: unknown): error is PaymentProviderConfigError {
  return error instanceof PaymentProviderConfigError
}

/**
 * Thrown when a webhook signature verification fails
 */
export class WebhookVerificationError extends Error {
  readonly code = 'WEBHOOK_VERIFICATION_ERROR' as const
  readonly provider: string

  constructor(provider: string, detail?: string) {
    super(`Webhook signature verification failed for "${provider}"${detail ? `: ${detail}` : ''}`)
    this.name = 'WebhookVerificationError'
    this.provider = provider
  }
}

/**
 * Type guard to check if error is WebhookVerificationError
 */
export function isWebhookVerificationError(error: unknown): error is WebhookVerificationError {
  return error instanceof WebhookVerificationError
}

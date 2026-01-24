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

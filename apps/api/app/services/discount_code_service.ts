import DiscountCode from '#models/discount_code'
import DiscountCodeUsage from '#models/discount_code_usage'
import Price from '#models/price'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export interface ValidateDiscountCodeResult {
  valid: boolean
  discountCode?: DiscountCode
  originalAmount: number
  discountedAmount: number
  discountApplied: number
  message?: string
}

export default class DiscountCodeService {
  /**
   * Validate a discount code for a tenant (tenant is the billing unit)
   * @param code - Discount code
   * @param priceId - Price ID to validate against
   * @param tenantId - Which tenant is using the discount (billing context)
   */
  async validateCode(
    code: string,
    priceId: number,
    tenantId: number
  ): Promise<ValidateDiscountCodeResult> {
    const price = await Price.find(priceId)
    if (!price) {
      return {
        valid: false,
        originalAmount: 0,
        discountedAmount: 0,
        discountApplied: 0,
        message: 'Price not found',
      }
    }

    const discountCode = await DiscountCode.findByCode(code)
    if (!discountCode) {
      return {
        valid: false,
        originalAmount: price.unitAmount,
        discountedAmount: price.unitAmount,
        discountApplied: 0,
        message: 'Discount code not found',
      }
    }

    if (!discountCode.isActive) {
      return {
        valid: false,
        originalAmount: price.unitAmount,
        discountedAmount: price.unitAmount,
        discountApplied: 0,
        message: 'Discount code is inactive',
      }
    }

    if (discountCode.isExpired()) {
      return {
        valid: false,
        originalAmount: price.unitAmount,
        discountedAmount: price.unitAmount,
        discountApplied: 0,
        message: 'Discount code has expired',
      }
    }

    if (discountCode.maxUses !== null && discountCode.timesUsed >= discountCode.maxUses) {
      return {
        valid: false,
        originalAmount: price.unitAmount,
        discountedAmount: price.unitAmount,
        discountApplied: 0,
        message: 'Discount code has reached maximum uses',
      }
    }

    // Check tenant-based usage limits (tenant is the billing unit)
    const canBeUsed = await discountCode.canBeUsedByTenant(tenantId)
    if (!canBeUsed) {
      return {
        valid: false,
        originalAmount: price.unitAmount,
        discountedAmount: price.unitAmount,
        discountApplied: 0,
        message: 'This tenant has already used this discount code the maximum number of times',
      }
    }

    if (discountCode.minAmount !== null && price.unitAmount < discountCode.minAmount) {
      return {
        valid: false,
        originalAmount: price.unitAmount,
        discountedAmount: price.unitAmount,
        discountApplied: 0,
        message: `Minimum purchase amount of ${discountCode.minAmount / 100} ${discountCode.currency || price.currency} required`,
      }
    }

    if (
      discountCode.discountType === 'fixed' &&
      discountCode.currency &&
      discountCode.currency !== price.currency
    ) {
      return {
        valid: false,
        originalAmount: price.unitAmount,
        discountedAmount: price.unitAmount,
        discountApplied: 0,
        message: 'Discount code currency does not match price currency',
      }
    }

    const discountApplied = discountCode.calculateDiscount(price.unitAmount)
    const discountedAmount = Math.max(0, price.unitAmount - discountApplied)

    return {
      valid: true,
      discountCode,
      originalAmount: price.unitAmount,
      discountedAmount,
      discountApplied,
    }
  }

  /**
   * Record discount code usage
   * @param discountCodeId - Which discount code was used
   * @param tenantId - Which tenant used the discount (billing context)
   * @param userId - Who performed the action (audit trail)
   * @param checkoutSessionId - Optional checkout session reference
   * @param trx - Optional transaction with RLS context (strongly recommended)
   */
  async recordUsage(
    discountCodeId: number,
    tenantId: number,
    userId: number,
    checkoutSessionId?: string,
    trx?: TransactionClientContract
  ): Promise<DiscountCodeUsage> {
    return DiscountCodeUsage.recordUsage(discountCodeId, tenantId, userId, checkoutSessionId, trx)
  }

  /**
   * Get all usages of a discount code
   */
  async getUsages(discountCodeId: number): Promise<DiscountCodeUsage[]> {
    return DiscountCodeUsage.query()
      .where('discountCodeId', discountCodeId)
      .preload('user')
      .preload('tenant')
      .orderBy('usedAt', 'desc')
  }

  /**
   * Get all discount code usages by a tenant (billing context)
   */
  async getTenantUsages(tenantId: number): Promise<DiscountCodeUsage[]> {
    return DiscountCodeUsage.query()
      .where('tenantId', tenantId)
      .preload('discountCode')
      .preload('user')
      .orderBy('usedAt', 'desc')
  }

  /**
   * Get all discount code usages by a user (audit trail)
   * @deprecated For billing purposes, use getTenantUsages instead
   */
  async getUserUsages(userId: number): Promise<DiscountCodeUsage[]> {
    return DiscountCodeUsage.query()
      .where('userId', userId)
      .preload('discountCode')
      .preload('tenant')
      .orderBy('usedAt', 'desc')
  }
}

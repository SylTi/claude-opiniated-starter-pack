import DiscountCode from '#models/discount_code'
import DiscountCodeUsage from '#models/discount_code_usage'
import Price from '#models/price'

export interface ValidateDiscountCodeResult {
  valid: boolean
  discountCode?: DiscountCode
  originalAmount: number
  discountedAmount: number
  discountApplied: number
  message?: string
}

export default class DiscountCodeService {
  async validateCode(
    code: string,
    priceId: number,
    userId: number
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

    const canBeUsed = await discountCode.canBeUsedBy(userId)
    if (!canBeUsed) {
      return {
        valid: false,
        originalAmount: price.unitAmount,
        discountedAmount: price.unitAmount,
        discountApplied: 0,
        message: 'You have already used this discount code the maximum number of times',
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

  async recordUsage(
    discountCodeId: number,
    userId: number,
    checkoutSessionId?: string
  ): Promise<DiscountCodeUsage> {
    return DiscountCodeUsage.recordUsage(discountCodeId, userId, checkoutSessionId)
  }

  async getUsages(discountCodeId: number): Promise<DiscountCodeUsage[]> {
    return DiscountCodeUsage.query()
      .where('discountCodeId', discountCodeId)
      .preload('user')
      .orderBy('usedAt', 'desc')
  }

  async getUserUsages(userId: number): Promise<DiscountCodeUsage[]> {
    return DiscountCodeUsage.query()
      .where('userId', userId)
      .preload('discountCode')
      .orderBy('usedAt', 'desc')
  }
}

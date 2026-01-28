import Coupon from '#models/coupon'
import Tenant from '#models/tenant'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export interface RedeemCouponResult {
  success: boolean
  creditAmount: number
  currency: string
  newBalance: number
  message?: string
}

export default class CouponService {
  /**
   * Redeem a coupon for a tenant (tenant is the billing unit)
   * Uses transaction with row locking to prevent double-spending race conditions.
   *
   * NOTE: Caller is responsible for verifying user has permission (admin role).
   * This is enforced by tenant middleware at controller level.
   *
   * @param code - Coupon code
   * @param tenantId - Which tenant receives the credit (billing context)
   * @param userId - Who is performing the redemption (audit trail)
   * @param trx - Optional transaction with RLS context (strongly recommended)
   */
  async redeemCouponForTenant(
    code: string,
    tenantId: number,
    userId: number,
    trx?: TransactionClientContract
  ): Promise<RedeemCouponResult> {
    // Pre-flight checks (without locking - fast fail for invalid requests)
    const coupon = trx
      ? await Coupon.query({ client: trx }).where('code', code.toUpperCase()).first()
      : await Coupon.findByCode(code)

    if (!coupon) {
      return {
        success: false,
        creditAmount: 0,
        currency: 'usd',
        newBalance: 0,
        message: 'Coupon not found',
      }
    }

    // Quick check before expensive transaction (actual check happens inside transaction)
    if (!coupon.isRedeemable()) {
      const reason = !coupon.isActive
        ? 'Coupon is inactive'
        : coupon.isExpired()
          ? 'Coupon has expired'
          : 'Coupon has already been redeemed'
      return {
        success: false,
        creditAmount: 0,
        currency: coupon.currency,
        newBalance: 0,
        message: reason,
      }
    }

    const tenant = trx
      ? await Tenant.query({ client: trx }).where('id', tenantId).first()
      : await Tenant.find(tenantId)
    if (!tenant) {
      return {
        success: false,
        creditAmount: 0,
        currency: coupon.currency,
        newBalance: 0,
        message: 'Tenant not found',
      }
    }

    // Redeem the coupon with transaction + row locking (prevents race conditions)
    // The actual redeemable check is done again inside the transaction with a lock
    // Pass the existing transaction if provided (for RLS context)
    try {
      const newBalance = await coupon.redeemForTenant(tenantId, userId, trx)

      return {
        success: true,
        creditAmount: coupon.creditAmount,
        currency: coupon.currency,
        newBalance,
      }
    } catch (error) {
      // Handle race condition where coupon was redeemed between pre-check and transaction
      if (error instanceof Error && error.message === 'Coupon is not redeemable') {
        return {
          success: false,
          creditAmount: 0,
          currency: coupon.currency,
          newBalance: 0,
          message: 'Coupon has already been redeemed',
        }
      }
      throw error
    }
  }

  /**
   * Get tenant's credit balance
   */
  async getTenantBalance(tenantId: number): Promise<{ balance: number; currency: string }> {
    const tenant = await Tenant.findOrFail(tenantId)
    return tenant.getBalance()
  }
}

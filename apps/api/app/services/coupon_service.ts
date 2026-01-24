import Coupon from '#models/coupon'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'

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
   * @param code - Coupon code
   * @param tenantId - Which tenant receives the credit (billing context)
   * @param userId - Who is performing the redemption (audit trail)
   */
  async redeemCouponForTenant(
    code: string,
    tenantId: number,
    userId: number
  ): Promise<RedeemCouponResult> {
    const coupon = await Coupon.findByCode(code)

    if (!coupon) {
      return {
        success: false,
        creditAmount: 0,
        currency: 'usd',
        newBalance: 0,
        message: 'Coupon not found',
      }
    }

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

    const tenant = await Tenant.find(tenantId)
    if (!tenant) {
      return {
        success: false,
        creditAmount: 0,
        currency: coupon.currency,
        newBalance: 0,
        message: 'Tenant not found',
      }
    }

    // Check if user has permission to redeem for this tenant (owner or admin)
    const membership = await TenantMembership.query()
      .where('tenantId', tenantId)
      .where('userId', userId)
      .first()

    if (!membership || !membership.isAdmin()) {
      return {
        success: false,
        creditAmount: 0,
        currency: coupon.currency,
        newBalance: 0,
        message: 'Only tenant owners or admins can redeem coupons',
      }
    }

    // Redeem the coupon - tenantId for billing, userId for audit
    const newBalance = await coupon.redeemForTenant(tenantId, userId)

    return {
      success: true,
      creditAmount: coupon.creditAmount,
      currency: coupon.currency,
      newBalance,
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

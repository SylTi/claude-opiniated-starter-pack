import Coupon from '#models/coupon'
import User from '#models/user'
import Team from '#models/team'

export interface RedeemCouponResult {
  success: boolean
  creditAmount: number
  currency: string
  newBalance: number
  message?: string
}

export default class CouponService {
  async redeemCoupon(code: string, userId: number): Promise<RedeemCouponResult> {
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

    if (!coupon.isActive) {
      return {
        success: false,
        creditAmount: 0,
        currency: coupon.currency,
        newBalance: 0,
        message: 'Coupon is inactive',
      }
    }

    if (coupon.isExpired()) {
      return {
        success: false,
        creditAmount: 0,
        currency: coupon.currency,
        newBalance: 0,
        message: 'Coupon has expired',
      }
    }

    if (coupon.isRedeemed()) {
      return {
        success: false,
        creditAmount: 0,
        currency: coupon.currency,
        newBalance: 0,
        message: 'Coupon has already been redeemed',
      }
    }

    const user = await User.findOrFail(userId)

    await coupon.redeem(userId)
    const newBalance = await user.addCredit(coupon.creditAmount, coupon.currency)

    return {
      success: true,
      creditAmount: coupon.creditAmount,
      currency: coupon.currency,
      newBalance,
    }
  }

  async redeemCouponForTeam(
    code: string,
    teamId: number,
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

    const team = await Team.findOrFail(teamId)

    if (team.ownerId !== userId) {
      return {
        success: false,
        creditAmount: 0,
        currency: coupon.currency,
        newBalance: 0,
        message: 'Only team owners can redeem coupons for the team',
      }
    }

    await coupon.redeem(userId)
    const newBalance = await team.addCredit(coupon.creditAmount, coupon.currency)

    return {
      success: true,
      creditAmount: coupon.creditAmount,
      currency: coupon.currency,
      newBalance,
    }
  }

  async getUserBalance(userId: number): Promise<{ balance: number; currency: string }> {
    const user = await User.findOrFail(userId)
    return user.getBalance()
  }

  async getTeamBalance(teamId: number): Promise<{ balance: number; currency: string }> {
    const team = await Team.findOrFail(teamId)
    return team.getBalance()
  }
}

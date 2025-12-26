import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Coupon from '#models/coupon'
import CouponService from '#services/coupon_service'
import Team from '#models/team'

export default class CouponsController {
  /**
   * List all coupons (admin)
   * GET /api/v1/admin/coupons
   */
  async index({ response }: HttpContext): Promise<void> {
    const coupons = await Coupon.query().preload('redeemedByUser').orderBy('createdAt', 'desc')

    response.json({
      data: coupons.map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        creditAmount: coupon.creditAmount,
        currency: coupon.currency,
        expiresAt: coupon.expiresAt?.toISO() ?? null,
        isActive: coupon.isActive,
        redeemedByUserId: coupon.redeemedByUserId,
        redeemedByUserEmail: coupon.redeemedByUser?.email ?? null,
        redeemedAt: coupon.redeemedAt?.toISO() ?? null,
        createdAt: coupon.createdAt.toISO(),
        updatedAt: coupon.updatedAt?.toISO() ?? null,
      })),
    })
  }

  /**
   * Get a single coupon (admin)
   * GET /api/v1/admin/coupons/:id
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const coupon = await Coupon.query()
      .where('id', params.id)
      .preload('redeemedByUser')
      .firstOrFail()

    response.json({
      data: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        creditAmount: coupon.creditAmount,
        currency: coupon.currency,
        expiresAt: coupon.expiresAt?.toISO() ?? null,
        isActive: coupon.isActive,
        redeemedByUserId: coupon.redeemedByUserId,
        redeemedByUserEmail: coupon.redeemedByUser?.email ?? null,
        redeemedAt: coupon.redeemedAt?.toISO() ?? null,
        createdAt: coupon.createdAt.toISO(),
        updatedAt: coupon.updatedAt?.toISO() ?? null,
      },
    })
  }

  /**
   * Create a new coupon (admin)
   * POST /api/v1/admin/coupons
   */
  async store({ request, response }: HttpContext): Promise<void> {
    const data = request.only([
      'code',
      'description',
      'creditAmount',
      'currency',
      'expiresAt',
      'isActive',
    ])

    if (!data.code || data.creditAmount === undefined) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'code and creditAmount are required',
      })
    }

    if (data.creditAmount <= 0) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'creditAmount must be greater than 0',
      })
    }

    const existingCoupon = await Coupon.findByCode(data.code)
    if (existingCoupon) {
      return response.conflict({
        error: 'ConflictError',
        message: 'A coupon with this code already exists',
      })
    }

    const coupon = await Coupon.create({
      code: data.code.toUpperCase(),
      description: data.description ?? null,
      creditAmount: data.creditAmount,
      currency: data.currency?.toLowerCase() ?? 'usd',
      expiresAt: data.expiresAt ? DateTime.fromISO(data.expiresAt) : null,
      isActive: data.isActive ?? true,
    })

    response.created({
      data: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        creditAmount: coupon.creditAmount,
        currency: coupon.currency,
        expiresAt: coupon.expiresAt?.toISO() ?? null,
        isActive: coupon.isActive,
        redeemedByUserId: coupon.redeemedByUserId,
        redeemedAt: coupon.redeemedAt?.toISO() ?? null,
        createdAt: coupon.createdAt.toISO(),
        updatedAt: coupon.updatedAt?.toISO() ?? null,
      },
      message: 'Coupon created successfully',
    })
  }

  /**
   * Update a coupon (admin)
   * PUT /api/v1/admin/coupons/:id
   */
  async update({ params, request, response }: HttpContext): Promise<void> {
    const coupon = await Coupon.findOrFail(params.id)
    const data = request.only([
      'code',
      'description',
      'creditAmount',
      'currency',
      'expiresAt',
      'isActive',
    ])

    if (coupon.isRedeemed()) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Cannot update a redeemed coupon',
      })
    }

    if (data.code !== undefined) {
      const existingCoupon = await Coupon.findByCode(data.code)
      if (existingCoupon && existingCoupon.id !== coupon.id) {
        return response.conflict({
          error: 'ConflictError',
          message: 'A coupon with this code already exists',
        })
      }
      coupon.code = data.code.toUpperCase()
    }

    if (data.description !== undefined) coupon.description = data.description
    if (data.creditAmount !== undefined) coupon.creditAmount = data.creditAmount
    if (data.currency !== undefined) coupon.currency = data.currency?.toLowerCase() ?? 'usd'
    if (data.expiresAt !== undefined) {
      coupon.expiresAt = data.expiresAt ? DateTime.fromISO(data.expiresAt) : null
    }
    if (data.isActive !== undefined) coupon.isActive = data.isActive

    await coupon.save()

    response.json({
      data: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        creditAmount: coupon.creditAmount,
        currency: coupon.currency,
        expiresAt: coupon.expiresAt?.toISO() ?? null,
        isActive: coupon.isActive,
        redeemedByUserId: coupon.redeemedByUserId,
        redeemedAt: coupon.redeemedAt?.toISO() ?? null,
        createdAt: coupon.createdAt.toISO(),
        updatedAt: coupon.updatedAt?.toISO() ?? null,
      },
      message: 'Coupon updated successfully',
    })
  }

  /**
   * Delete a coupon (admin)
   * DELETE /api/v1/admin/coupons/:id
   */
  async destroy({ params, response }: HttpContext): Promise<void> {
    const coupon = await Coupon.findOrFail(params.id)
    await coupon.delete()

    response.json({
      message: 'Coupon deleted successfully',
    })
  }

  /**
   * Redeem a coupon (user)
   * POST /api/v1/billing/redeem-coupon
   */
  async redeem({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const { code, teamId } = request.only(['code', 'teamId'])

    if (!code) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'code is required',
      })
    }

    // Check team ownership before redemption
    if (teamId) {
      const team = await Team.find(teamId)
      if (!team) {
        return response.notFound({
          error: 'NotFound',
          message: 'Team not found',
        })
      }
      if (team.ownerId !== user.id) {
        return response.forbidden({
          error: 'Forbidden',
          message: 'Only team owners can redeem coupons for the team',
        })
      }
    }

    const service = new CouponService()

    let result
    if (teamId) {
      result = await service.redeemCouponForTeam(code, teamId, user.id)
    } else {
      result = await service.redeemCoupon(code, user.id)
    }

    if (!result.success) {
      return response.badRequest({
        error: 'RedemptionError',
        message: result.message ?? 'Failed to redeem coupon',
      })
    }

    response.json({
      data: {
        success: true,
        creditAmount: result.creditAmount,
        currency: result.currency,
        newBalance: result.newBalance,
      },
      message: `Successfully added ${result.creditAmount / 100} ${result.currency.toUpperCase()} to your balance`,
    })
  }

  /**
   * Get user's balance
   * GET /api/v1/billing/balance
   */
  async getBalance({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const teamId = request.input('teamId')

    const service = new CouponService()

    let balance
    if (teamId) {
      const team = await Team.find(teamId)
      if (!team || team.ownerId !== user.id) {
        return response.forbidden({
          error: 'Forbidden',
          message: 'Only team owners can view team balance',
        })
      }
      balance = await service.getTeamBalance(teamId)
    } else {
      balance = await service.getUserBalance(user.id)
    }

    response.json({
      data: balance,
    })
  }
}

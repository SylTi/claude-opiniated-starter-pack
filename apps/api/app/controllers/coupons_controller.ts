import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Coupon from '#models/coupon'
import CouponService from '#services/coupon_service'
import db from '@adonisjs/lucid/services/db'
import {
  createCouponValidator,
  updateCouponValidator,
  redeemCouponValidator,
  getBalanceValidator,
} from '#validators/coupon'
import { isCurrencyMismatchError } from '#exceptions/billing_errors'

export default class CouponsController {
  private isRowNotFound(error: unknown): boolean {
    return Boolean((error as { code?: string }).code === 'E_ROW_NOT_FOUND')
  }
  /**
   * List all coupons (admin)
   * GET /api/v1/admin/coupons
   */
  async index({ response }: HttpContext): Promise<void> {
    const coupons = await Coupon.query()
      .preload('redeemedByUser')
      .preload('redeemedForTenant')
      .orderBy('createdAt', 'desc')

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
        redeemedForTenantId: coupon.redeemedForTenantId,
        redeemedForTenantName: coupon.redeemedForTenant?.name ?? null,
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
      .preload('redeemedForTenant')
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
        redeemedForTenantId: coupon.redeemedForTenantId,
        redeemedForTenantName: coupon.redeemedForTenant?.name ?? null,
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
    const data = await request.validateUsing(createCouponValidator)

    // Use transaction to prevent race conditions
    const coupon = await db.transaction(async (trx) => {
      const code = data.code.toUpperCase()

      // Check if code exists within transaction
      const existingCoupon = await Coupon.query({ client: trx }).where('code', code).first()

      if (existingCoupon) {
        return null // Signal conflict
      }

      return await Coupon.create(
        {
          code,
          description: data.description ?? null,
          creditAmount: data.creditAmount,
          currency: data.currency?.toLowerCase() ?? 'usd',
          expiresAt: data.expiresAt ? DateTime.fromJSDate(data.expiresAt) : null,
          isActive: data.isActive ?? true,
        },
        { client: trx }
      )
    })

    if (!coupon) {
      return response.conflict({
        error: 'ConflictError',
        message: 'A coupon with this code already exists',
      })
    }

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
        redeemedForTenantId: coupon.redeemedForTenantId,
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
    const data = await request.validateUsing(updateCouponValidator)

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
      coupon.expiresAt = data.expiresAt ? DateTime.fromJSDate(data.expiresAt) : null
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
        redeemedForTenantId: coupon.redeemedForTenantId,
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
   * Redeem a coupon for a tenant (tenant is the billing unit)
   * POST /api/v1/billing/redeem-coupon
   */
  async redeem({
    request,
    response,
    auth,
    tenant: tenantCtx,
    tenantDb,
  }: HttpContext): Promise<void> {
    const user = auth.user!
    const { code, tenantId } = await request.validateUsing(redeemCouponValidator)

    // Tenant is required for redemption (tenant is the billing unit)
    if (!tenantId) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Tenant ID is required for coupon redemption',
      })
    }

    // Verify request tenantId matches the tenant context (set by middleware)
    if (!tenantCtx || tenantCtx.id !== tenantId) {
      return response.badRequest({
        error: 'TenantMismatch',
        message: 'Tenant ID in request does not match X-Tenant-ID header',
      })
    }

    // Membership already verified by tenant middleware; check admin role
    if (tenantCtx.membership.role !== 'owner' && tenantCtx.membership.role !== 'admin') {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Only tenant owners or admins can redeem coupons',
      })
    }

    const service = new CouponService()

    let result
    try {
      // Redeem for tenant - tenantId for billing, user.id for audit
      // Pass tenantDb transaction for RLS context
      result = await service.redeemCouponForTenant(code, tenantId, user.id, tenantDb)
    } catch (error) {
      if (this.isRowNotFound(error)) {
        return response.notFound({
          error: 'NotFound',
          message: 'Tenant not found',
        })
      }
      if (isCurrencyMismatchError(error)) {
        return response.badRequest({
          error: 'CurrencyMismatch',
          message: error.message,
        })
      }
      throw error
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
        tenantId,
      },
      message: `Successfully added ${result.creditAmount / 100} ${result.currency.toUpperCase()} to tenant balance`,
    })
  }

  /**
   * Get tenant's balance
   * GET /api/v1/billing/balance
   */
  async getBalance({ request, response, tenant: tenantCtx }: HttpContext): Promise<void> {
    const { tenantId } = await request.validateUsing(getBalanceValidator)

    // Tenant is required (tenant is the billing unit)
    if (!tenantId) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Tenant ID is required',
      })
    }

    // Verify request tenantId matches the tenant context (set by middleware)
    if (!tenantCtx || tenantCtx.id !== tenantId) {
      return response.badRequest({
        error: 'TenantMismatch',
        message: 'Tenant ID in request does not match X-Tenant-ID header',
      })
    }

    // Membership already verified by tenant middleware
    const service = new CouponService()

    let balance
    try {
      balance = await service.getTenantBalance(tenantId)
    } catch (error) {
      if (this.isRowNotFound(error)) {
        return response.notFound({
          error: 'NotFound',
          message: 'Tenant not found',
        })
      }
      throw error
    }

    response.json({
      data: {
        ...balance,
        tenantId,
      },
    })
  }
}

import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import DiscountCode from '#models/discount_code'
import DiscountCodeUsage from '#models/discount_code_usage'
import DiscountCodeService from '#services/discount_code_service'

export default class DiscountCodesController {
  /**
   * List all discount codes (admin)
   * GET /api/v1/admin/discount-codes
   */
  async index({ response }: HttpContext): Promise<void> {
    const discountCodes = await DiscountCode.query().orderBy('createdAt', 'desc')

    response.json({
      data: discountCodes.map((code) => ({
        id: code.id,
        code: code.code,
        description: code.description,
        discountType: code.discountType,
        discountValue: code.discountValue,
        currency: code.currency,
        minAmount: code.minAmount,
        maxUses: code.maxUses,
        maxUsesPerUser: code.maxUsesPerUser,
        timesUsed: code.timesUsed,
        expiresAt: code.expiresAt?.toISO() ?? null,
        isActive: code.isActive,
        createdAt: code.createdAt.toISO(),
        updatedAt: code.updatedAt?.toISO() ?? null,
      })),
    })
  }

  /**
   * Get a single discount code with usages (admin)
   * GET /api/v1/admin/discount-codes/:id
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const discountCode = await DiscountCode.findOrFail(params.id)
    const usages = await DiscountCodeUsage.query()
      .where('discountCodeId', discountCode.id)
      .preload('user')
      .orderBy('usedAt', 'desc')

    response.json({
      data: {
        id: discountCode.id,
        code: discountCode.code,
        description: discountCode.description,
        discountType: discountCode.discountType,
        discountValue: discountCode.discountValue,
        currency: discountCode.currency,
        minAmount: discountCode.minAmount,
        maxUses: discountCode.maxUses,
        maxUsesPerUser: discountCode.maxUsesPerUser,
        timesUsed: discountCode.timesUsed,
        expiresAt: discountCode.expiresAt?.toISO() ?? null,
        isActive: discountCode.isActive,
        createdAt: discountCode.createdAt.toISO(),
        updatedAt: discountCode.updatedAt?.toISO() ?? null,
        usages: usages.map((usage) => ({
          id: usage.id,
          userId: usage.userId,
          userEmail: usage.user?.email ?? null,
          usedAt: usage.usedAt.toISO(),
          checkoutSessionId: usage.checkoutSessionId,
        })),
      },
    })
  }

  /**
   * Create a new discount code (admin)
   * POST /api/v1/admin/discount-codes
   */
  async store({ request, response }: HttpContext): Promise<void> {
    const data = request.only([
      'code',
      'description',
      'discountType',
      'discountValue',
      'currency',
      'minAmount',
      'maxUses',
      'maxUsesPerUser',
      'expiresAt',
      'isActive',
    ])

    if (!data.code || !data.discountType || data.discountValue === undefined) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'code, discountType, and discountValue are required',
      })
    }

    if (!['percent', 'fixed'].includes(data.discountType)) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'discountType must be "percent" or "fixed"',
      })
    }

    if (data.discountType === 'percent' && (data.discountValue < 0 || data.discountValue > 100)) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Percentage discount must be between 0 and 100',
      })
    }

    const existingCode = await DiscountCode.findByCode(data.code)
    if (existingCode) {
      return response.conflict({
        error: 'ConflictError',
        message: 'A discount code with this code already exists',
      })
    }

    const discountCode = await DiscountCode.create({
      code: data.code.toUpperCase(),
      description: data.description ?? null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      currency: data.currency?.toLowerCase() ?? null,
      minAmount: data.minAmount ?? null,
      maxUses: data.maxUses ?? null,
      maxUsesPerUser: data.maxUsesPerUser ?? null,
      expiresAt: data.expiresAt ? DateTime.fromISO(data.expiresAt) : null,
      isActive: data.isActive ?? true,
      timesUsed: 0,
    })

    response.created({
      data: {
        id: discountCode.id,
        code: discountCode.code,
        description: discountCode.description,
        discountType: discountCode.discountType,
        discountValue: discountCode.discountValue,
        currency: discountCode.currency,
        minAmount: discountCode.minAmount,
        maxUses: discountCode.maxUses,
        maxUsesPerUser: discountCode.maxUsesPerUser,
        timesUsed: discountCode.timesUsed,
        expiresAt: discountCode.expiresAt?.toISO() ?? null,
        isActive: discountCode.isActive,
        createdAt: discountCode.createdAt.toISO(),
        updatedAt: discountCode.updatedAt?.toISO() ?? null,
      },
      message: 'Discount code created successfully',
    })
  }

  /**
   * Update a discount code (admin)
   * PUT /api/v1/admin/discount-codes/:id
   */
  async update({ params, request, response }: HttpContext): Promise<void> {
    const discountCode = await DiscountCode.findOrFail(params.id)
    const data = request.only([
      'code',
      'description',
      'discountType',
      'discountValue',
      'currency',
      'minAmount',
      'maxUses',
      'maxUsesPerUser',
      'expiresAt',
      'isActive',
    ])

    if (data.code !== undefined) {
      const existingCode = await DiscountCode.findByCode(data.code)
      if (existingCode && existingCode.id !== discountCode.id) {
        return response.conflict({
          error: 'ConflictError',
          message: 'A discount code with this code already exists',
        })
      }
      discountCode.code = data.code.toUpperCase()
    }

    if (data.description !== undefined) discountCode.description = data.description
    if (data.discountType !== undefined) discountCode.discountType = data.discountType
    if (data.discountValue !== undefined) discountCode.discountValue = data.discountValue
    if (data.currency !== undefined) discountCode.currency = data.currency?.toLowerCase() ?? null
    if (data.minAmount !== undefined) discountCode.minAmount = data.minAmount
    if (data.maxUses !== undefined) discountCode.maxUses = data.maxUses
    if (data.maxUsesPerUser !== undefined) discountCode.maxUsesPerUser = data.maxUsesPerUser
    if (data.expiresAt !== undefined) {
      discountCode.expiresAt = data.expiresAt ? DateTime.fromISO(data.expiresAt) : null
    }
    if (data.isActive !== undefined) discountCode.isActive = data.isActive

    await discountCode.save()

    response.json({
      data: {
        id: discountCode.id,
        code: discountCode.code,
        description: discountCode.description,
        discountType: discountCode.discountType,
        discountValue: discountCode.discountValue,
        currency: discountCode.currency,
        minAmount: discountCode.minAmount,
        maxUses: discountCode.maxUses,
        maxUsesPerUser: discountCode.maxUsesPerUser,
        timesUsed: discountCode.timesUsed,
        expiresAt: discountCode.expiresAt?.toISO() ?? null,
        isActive: discountCode.isActive,
        createdAt: discountCode.createdAt.toISO(),
        updatedAt: discountCode.updatedAt?.toISO() ?? null,
      },
      message: 'Discount code updated successfully',
    })
  }

  /**
   * Delete a discount code (admin)
   * DELETE /api/v1/admin/discount-codes/:id
   */
  async destroy({ params, response }: HttpContext): Promise<void> {
    const discountCode = await DiscountCode.findOrFail(params.id)
    await discountCode.delete()

    response.json({
      message: 'Discount code deleted successfully',
    })
  }

  /**
   * Validate a discount code (user)
   * POST /api/v1/billing/validate-discount-code
   */
  async validate({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const { code, priceId } = request.only(['code', 'priceId'])

    if (!code || !priceId) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'code and priceId are required',
      })
    }

    const service = new DiscountCodeService()
    const result = await service.validateCode(code, priceId, user.id)

    if (!result.valid) {
      return response.json({
        data: {
          valid: false,
          message: result.message ?? 'Invalid discount code',
          originalAmount: result.originalAmount,
          discountedAmount: result.discountedAmount,
          discountApplied: result.discountApplied,
        },
      })
    }

    response.json({
      data: {
        valid: true,
        discountCode: result.discountCode
          ? {
              id: result.discountCode.id,
              code: result.discountCode.code,
              description: result.discountCode.description,
              discountType: result.discountCode.discountType,
              discountValue: result.discountCode.discountValue,
              currency: result.discountCode.currency,
            }
          : null,
        originalAmount: result.originalAmount,
        discountedAmount: result.discountedAmount,
        discountApplied: result.discountApplied,
      },
    })
  }
}

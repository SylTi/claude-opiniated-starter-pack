import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import DiscountCode from '#models/discount_code'
import DiscountCodeUsage from '#models/discount_code_usage'
import DiscountCodeService from '#services/discount_code_service'
import db from '@adonisjs/lucid/services/db'
import {
  createDiscountCodeValidator,
  updateDiscountCodeValidator,
  validateDiscountCodeValidator,
} from '#validators/discount_code'

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
        maxUsesPerTenant: code.maxUsesPerTenant,
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
      .preload('tenant')
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
        maxUsesPerTenant: discountCode.maxUsesPerTenant,
        timesUsed: discountCode.timesUsed,
        expiresAt: discountCode.expiresAt?.toISO() ?? null,
        isActive: discountCode.isActive,
        createdAt: discountCode.createdAt.toISO(),
        updatedAt: discountCode.updatedAt?.toISO() ?? null,
        usages: usages.map((usage) => ({
          id: usage.id,
          tenantId: usage.tenantId,
          tenantName: usage.tenant?.name ?? null,
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
    const data = await request.validateUsing(createDiscountCodeValidator)

    // Validate percentage range
    if (data.discountType === 'percent' && data.discountValue > 100) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Percentage discount must be between 0 and 100',
      })
    }

    // Use transaction to prevent race conditions
    const discountCode = await db.transaction(async (trx) => {
      const existingCode = await DiscountCode.query({ client: trx })
        .where('code', data.code)
        .first()

      if (existingCode) {
        return null // Signal conflict
      }

      return await DiscountCode.create(
        {
          code: data.code, // Already transformed to uppercase by validator
          description: data.description ?? null,
          discountType: data.discountType,
          discountValue: data.discountValue,
          currency: data.currency?.toLowerCase() ?? null,
          minAmount: data.minAmount ?? null,
          maxUses: data.maxUses ?? null,
          maxUsesPerTenant: data.maxUsesPerTenant ?? null,
          expiresAt: data.expiresAt ? DateTime.fromJSDate(data.expiresAt) : null,
          isActive: data.isActive ?? true,
          timesUsed: 0,
        },
        { client: trx }
      )
    })

    if (!discountCode) {
      return response.conflict({
        error: 'ConflictError',
        message: 'A discount code with this code already exists',
      })
    }

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
        maxUsesPerTenant: discountCode.maxUsesPerTenant,
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
    const data = await request.validateUsing(updateDiscountCodeValidator)

    if (data.code !== undefined) {
      const existingCode = await DiscountCode.findByCode(data.code)
      if (existingCode && existingCode.id !== discountCode.id) {
        return response.conflict({
          error: 'ConflictError',
          message: 'A discount code with this code already exists',
        })
      }
      discountCode.code = data.code // Already transformed to uppercase by validator
    }

    if (data.description !== undefined) discountCode.description = data.description
    if (data.discountType !== undefined) discountCode.discountType = data.discountType
    if (data.discountValue !== undefined) discountCode.discountValue = data.discountValue
    if (data.currency !== undefined) discountCode.currency = data.currency?.toLowerCase() ?? null
    if (data.minAmount !== undefined) discountCode.minAmount = data.minAmount
    if (data.maxUses !== undefined) discountCode.maxUses = data.maxUses
    if (data.maxUsesPerTenant !== undefined) discountCode.maxUsesPerTenant = data.maxUsesPerTenant
    if (data.expiresAt !== undefined) {
      discountCode.expiresAt = data.expiresAt ? DateTime.fromJSDate(data.expiresAt) : null
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
        maxUsesPerTenant: discountCode.maxUsesPerTenant,
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
   * Validate a discount code for a tenant (tenant is the billing unit)
   * POST /api/v1/billing/validate-discount-code
   */
  async validate({ request, response, tenant }: HttpContext): Promise<void> {
    const { code, priceId, tenantId } = await request.validateUsing(validateDiscountCodeValidator)

    // Tenant is required for validation (tenant is the billing unit)
    if (!tenantId) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Tenant ID is required for discount code validation',
      })
    }

    // Verify request tenantId matches the tenant context (set by middleware)
    if (!tenant || tenant.id !== tenantId) {
      return response.badRequest({
        error: 'TenantMismatch',
        message: 'Tenant ID in request does not match X-Tenant-ID header',
      })
    }

    // Membership already verified by tenant middleware
    const service = new DiscountCodeService()
    const result = await service.validateCode(code, priceId, tenantId)

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

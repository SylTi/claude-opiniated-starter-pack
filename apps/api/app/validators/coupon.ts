import vine from '@vinejs/vine'

/**
 * Validator for creating a coupon
 */
export const createCouponValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(3).maxLength(50),
    description: vine.string().optional(),
    creditAmount: vine.number().min(1),
    currency: vine.string().fixedLength(3).optional(),
    expiresAt: vine.date().afterOrEqual('today').optional(),
    isActive: vine.boolean().optional(),
  })
)

/**
 * Validator for updating a coupon
 */
export const updateCouponValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(3).maxLength(50).optional(),
    description: vine.string().nullable().optional(),
    creditAmount: vine.number().min(1).optional(),
    currency: vine.string().fixedLength(3).optional(),
    expiresAt: vine.date().nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

/**
 * Validator for redeeming a coupon
 * Tenant is required (tenant is the billing unit)
 */
export const redeemCouponValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1),
    tenantId: vine.number().positive(),
  })
)

/**
 * Validator for getting balance
 * Tenant is required (tenant is the billing unit)
 */
export const getBalanceValidator = vine.compile(
  vine.object({
    tenantId: vine.number().positive(),
  })
)

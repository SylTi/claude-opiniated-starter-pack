import vine from '@vinejs/vine'

/**
 * Validator for creating a discount code
 */
export const createDiscountCodeValidator = vine.compile(
  vine.object({
    code: vine
      .string()
      .trim()
      .minLength(3)
      .maxLength(50)
      .transform((value) => value.toUpperCase()),
    description: vine.string().optional(),
    discountType: vine.enum(['percent', 'fixed']),
    discountValue: vine.number().min(0),
    currency: vine.string().fixedLength(3).optional(),
    minAmount: vine.number().min(0).optional(),
    maxUses: vine.number().min(1).optional(),
    maxUsesPerUser: vine.number().min(1).optional(),
    expiresAt: vine.date().afterOrEqual('today').optional(),
    isActive: vine.boolean().optional(),
  })
)

/**
 * Validator for updating a discount code
 */
export const updateDiscountCodeValidator = vine.compile(
  vine.object({
    code: vine
      .string()
      .trim()
      .minLength(3)
      .maxLength(50)
      .transform((value) => value.toUpperCase())
      .optional(),
    description: vine.string().nullable().optional(),
    discountType: vine.enum(['percent', 'fixed']).optional(),
    discountValue: vine.number().min(0).optional(),
    currency: vine.string().fixedLength(3).nullable().optional(),
    minAmount: vine.number().min(0).nullable().optional(),
    maxUses: vine.number().min(1).nullable().optional(),
    maxUsesPerUser: vine.number().min(1).nullable().optional(),
    expiresAt: vine.date().nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

/**
 * Validator for validating a discount code during checkout
 */
export const validateDiscountCodeValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1),
    priceId: vine.number().positive(),
  })
)

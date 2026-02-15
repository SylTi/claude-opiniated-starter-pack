import vine from '@vinejs/vine'

/**
 * Validator for creating a checkout session
 * Tenant is the billing unit - tenantId is required
 */
export const createCheckoutValidator = vine.compile(
  vine.object({
    priceId: vine.number().positive(),
    tenantId: vine.number().positive(),
    discountCode: vine.string().optional(),
  })
)

/**
 * Validator for creating a customer portal session
 */
export const createPortalValidator = vine.compile(
  vine.object({
    tenantId: vine.number().positive(),
    returnUrl: vine.string().url().maxLength(2048).optional(),
  })
)

/**
 * Validator for getting subscription details
 */
export const getSubscriptionValidator = vine.compile(
  vine.object({
    tenantId: vine.number().positive(),
  })
)

/**
 * Validator for canceling a subscription
 */
export const cancelSubscriptionValidator = vine.compile(
  vine.object({
    tenantId: vine.number().positive(),
  })
)

import vine from '@vinejs/vine'

/**
 * Validator for creating a checkout session
 */
export const createCheckoutValidator = vine.compile(
  vine.object({
    priceId: vine.number().positive(),
    discountCode: vine.string().optional(),
    subscriberType: vine.enum(['user', 'team']).optional(),
    subscriberId: vine.number().positive().optional(),
  })
)

/**
 * Validator for creating a customer portal session
 */
export const createPortalValidator = vine.compile(
  vine.object({
    returnUrl: vine.string().url().optional(),
    subscriberType: vine.enum(['user', 'team']).optional(),
    subscriberId: vine.number().positive().optional(),
  })
)

/**
 * Validator for getting subscription details
 */
export const getSubscriptionValidator = vine.compile(
  vine.object({
    subscriberType: vine.enum(['user', 'team']).optional(),
    subscriberId: vine.number().positive().optional(),
  })
)

/**
 * Validator for canceling a subscription
 */
export const cancelSubscriptionValidator = vine.compile(
  vine.object({
    subscriberType: vine.enum(['user', 'team']).optional(),
    subscriberId: vine.number().positive().optional(),
  })
)

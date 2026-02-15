import vine from '@vinejs/vine'

/**
 * Validator for pagination query params
 */
export const paginationValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

/**
 * Validator for updating a user's subscription tier (admin)
 */
export const updateUserTierValidator = vine.compile(
  vine.object({
    subscriptionTier: vine.string().minLength(1),
    subscriptionExpiresAt: vine.date().optional(),
  })
)

/**
 * Validator for updating a tenant's subscription tier (admin)
 */
export const updateTenantTierValidator = vine.compile(
  vine.object({
    subscriptionTier: vine.string().minLength(1),
    subscriptionExpiresAt: vine.date().optional(),
  })
)

/**
 * Validator for updating tenant quota overrides (admin)
 */
export const updateTenantQuotasValidator = vine.compile(
  vine.object({
    maxMembers: vine.number().min(1).nullable().optional(),
    maxPendingInvitations: vine.number().min(1).nullable().optional(),
    maxAuthTokensPerTenant: vine.number().min(1).nullable().optional(),
    maxAuthTokensPerUser: vine.number().min(1).nullable().optional(),
  })
)

/**
 * Validator for creating a subscription tier (admin)
 */
export const createTierValidator = vine.compile(
  vine.object({
    slug: vine.string().trim().minLength(1).maxLength(50),
    name: vine.string().trim().minLength(1).maxLength(100),
    description: vine.string().optional(),
    level: vine.number().min(0),
    maxTeamMembers: vine.number().min(1).optional(),
    priceMonthly: vine.number().min(0).optional(),
    yearlyDiscountPercent: vine.number().min(0).max(100).optional(),
    features: vine.object({}).allowUnknownProperties().optional(),
    isActive: vine.boolean().optional(),
  })
)

/**
 * Validator for updating a subscription tier (admin)
 */
export const updateTierValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100).optional(),
    description: vine.string().nullable().optional(),
    level: vine.number().min(0).optional(),
    maxTeamMembers: vine.number().min(1).nullable().optional(),
    priceMonthly: vine.number().min(0).nullable().optional(),
    yearlyDiscountPercent: vine.number().min(0).max(100).nullable().optional(),
    features: vine.object({}).allowUnknownProperties().nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

/**
 * Validator for creating a product (admin)
 */
export const createProductValidator = vine.compile(
  vine.object({
    tierId: vine.number().positive(),
    provider: vine.string().minLength(1),
    providerProductId: vine.string().minLength(1),
  })
)

/**
 * Validator for updating a product (admin)
 */
export const updateProductValidator = vine.compile(
  vine.object({
    providerProductId: vine.string().minLength(1).optional(),
  })
)

/**
 * Validator for listing prices (admin)
 */
export const listPricesValidator = vine.compile(
  vine.object({
    productId: vine.number().positive().optional(),
  })
)

/**
 * Validator for creating a price (admin)
 */
export const createPriceValidator = vine.compile(
  vine.object({
    productId: vine.number().positive(),
    provider: vine.string().minLength(1),
    providerPriceId: vine.string().minLength(1),
    interval: vine.enum(['month', 'year']),
    currency: vine.string().fixedLength(3),
    unitAmount: vine.number().min(0),
    taxBehavior: vine.enum(['inclusive', 'exclusive']).optional(),
    isActive: vine.boolean().optional(),
  })
)

/**
 * Validator for updating a price (admin)
 */
export const updatePriceValidator = vine.compile(
  vine.object({
    providerPriceId: vine.string().minLength(1).optional(),
    unitAmount: vine.number().min(0).optional(),
    taxBehavior: vine.enum(['inclusive', 'exclusive']).optional(),
    isActive: vine.boolean().optional(),
  })
)

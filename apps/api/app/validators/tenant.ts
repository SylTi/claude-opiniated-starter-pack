import vine from '@vinejs/vine'

/**
 * Validator for creating a tenant
 */
export const createTenantValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
  })
)

/**
 * Validator for updating a tenant
 */
export const updateTenantValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100).optional(),
  })
)

/**
 * Validator for adding a member to a tenant
 */
export const addMemberValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    role: vine.enum(['admin', 'member', 'viewer']).optional(),
  })
)

/**
 * Validator for updating a tenant member's role
 */
export const updateMemberRoleValidator = vine.compile(
  vine.object({
    role: vine.enum(['admin', 'member', 'viewer']),
  })
)

/**
 * Validator for sending a tenant invitation
 */
export const sendInvitationValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    role: vine.enum(['admin', 'member', 'viewer']).optional(),
  })
)

/**
 * Validator for updating tenant quota overrides
 */
export const updateTenantQuotasValidator = vine.compile(
  vine.object({
    maxMembers: vine.number().min(1).nullable().optional(),
    maxPendingInvitations: vine.number().min(1).nullable().optional(),
    maxAuthTokensPerTenant: vine.number().min(1).nullable().optional(),
    maxAuthTokensPerUser: vine.number().min(1).nullable().optional(),
  })
)

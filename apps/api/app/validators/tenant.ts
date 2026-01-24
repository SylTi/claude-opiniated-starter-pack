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
    role: vine.enum(['admin', 'member']).optional(),
  })
)

/**
 * Validator for updating a tenant member's role
 */
export const updateMemberRoleValidator = vine.compile(
  vine.object({
    role: vine.enum(['admin', 'member']),
  })
)

/**
 * Validator for sending a tenant invitation
 */
export const sendInvitationValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    role: vine.enum(['admin', 'member']).optional(),
  })
)

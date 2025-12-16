import vine from '@vinejs/vine'

/**
 * Validator for user registration
 */
export const registerValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(8).maxLength(128),
    fullName: vine.string().minLength(2).maxLength(255).optional(),
  })
)

/**
 * Validator for user login
 */
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string(),
    mfaCode: vine.string().fixedLength(6).optional(),
  })
)

/**
 * Validator for forgot password request
 */
export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
  })
)

/**
 * Validator for password reset
 */
export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string(),
    password: vine.string().minLength(8).maxLength(128),
    passwordConfirmation: vine.string().sameAs('password'),
  })
)

/**
 * Validator for MFA verification
 */
export const verifyMfaValidator = vine.compile(
  vine.object({
    code: vine.string().fixedLength(6),
  })
)

/**
 * Validator for profile update
 */
export const updateProfileValidator = vine.compile(
  vine.object({
    fullName: vine.string().minLength(2).maxLength(255).optional(),
    avatarUrl: vine.string().url().optional().nullable(),
  })
)

/**
 * Validator for password change
 */
export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string(),
    newPassword: vine.string().minLength(8).maxLength(128),
    newPasswordConfirmation: vine.string().sameAs('newPassword'),
  })
)

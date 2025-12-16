import { z } from 'zod'

/**
 * Validation schemas matching backend validators (apps/api/app/validators/auth.ts)
 * These must stay in sync with backend validation rules.
 */

/**
 * Register form validation
 * Backend: email (required, email), password (8-128), fullName (optional, 2-255)
 */
export const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  passwordConfirmation: z.string(),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Passwords don't match",
  path: ['passwordConfirmation'],
})

export type RegisterFormData = z.infer<typeof registerSchema>

/**
 * Login form validation
 * Backend: email (required, email), password (required), mfaCode (optional, 6 digits)
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Code must contain only digits')
    .optional()
    .or(z.literal('')),
})

export type LoginFormData = z.infer<typeof loginSchema>

/**
 * Forgot password form validation
 * Backend: email (required, email)
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

/**
 * Reset password form validation
 * Backend: password (8-128), passwordConfirmation (same as password)
 */
export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  passwordConfirmation: z.string(),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Passwords don't match",
  path: ['passwordConfirmation'],
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

/**
 * MFA code validation
 * Backend: code (exactly 6 digits)
 */
export const mfaCodeSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Code must contain only digits'),
})

export type MfaCodeFormData = z.infer<typeof mfaCodeSchema>

/**
 * Profile update form validation
 * Backend: fullName (optional, 2-255), avatarUrl (optional, valid URL or null)
 */
export const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be at most 255 characters')
    .optional()
    .or(z.literal('')),
  avatarUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

export type ProfileFormData = z.infer<typeof profileSchema>

/**
 * Change password form validation
 * Backend: currentPassword (required), newPassword (8-128), newPasswordConfirmation (same as newPassword)
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  newPasswordConfirmation: z.string(),
}).refine((data) => data.newPassword === data.newPasswordConfirmation, {
  message: "Passwords don't match",
  path: ['newPasswordConfirmation'],
})

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

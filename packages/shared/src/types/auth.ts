/**
 * Auth request/response types for API communication
 */

// Register
export interface RegisterRequestDTO {
  email: string
  password: string
  fullName?: string
}

export interface RegisterResponseDTO {
  id: number
  email: string
  fullName: string | null
  role: string
  emailVerified: boolean
}

// Forgot Password
export interface ForgotPasswordRequestDTO {
  email: string
}

// Reset Password
export interface ResetPasswordRequestDTO {
  token: string
  password: string
  passwordConfirmation: string
}

// Change Password
export interface ChangePasswordRequestDTO {
  currentPassword: string
  newPassword: string
  newPasswordConfirmation: string
}

// MFA Enable
export interface MfaEnableRequestDTO {
  code: string
  secret: string
  backupCodes: string[]
}

// MFA Verify
export interface MfaVerifyRequestDTO {
  code: string
}

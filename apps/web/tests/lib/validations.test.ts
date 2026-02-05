import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mfaCodeSchema,
  profileSchema,
  changePasswordSchema,
} from '@/lib/validations'

describe('validation schemas essentials', () => {
  it('register schema accepts valid payload', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
      fullName: 'John Doe',
    })
    expect(result.success).toBe(true)
  })

  it('register schema rejects password mismatch', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      passwordConfirmation: 'different123',
    })
    expect(result.success).toBe(false)
  })

  it('login schema accepts optional MFA and rejects invalid code', () => {
    const ok = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      mfaCode: '123456',
    })
    const bad = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
      mfaCode: 'abc',
    })

    expect(ok.success).toBe(true)
    expect(bad.success).toBe(false)
  })

  it('forgot password schema rejects malformed email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'bad-email' }).success).toBe(false)
  })

  it('reset password schema enforces confirmation match', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'newpassword123',
      passwordConfirmation: 'wrong',
    })
    expect(result.success).toBe(false)
  })

  it('mfa code schema accepts 6 digits only', () => {
    expect(mfaCodeSchema.safeParse({ code: '123456' }).success).toBe(true)
    expect(mfaCodeSchema.safeParse({ code: '12a456' }).success).toBe(false)
  })

  it('profile schema accepts empty payload and rejects overly long fullName', () => {
    expect(profileSchema.safeParse({}).success).toBe(true)
    expect(profileSchema.safeParse({ fullName: 'A'.repeat(256) }).success).toBe(false)
  })

  it('change password schema enforces new password confirmation', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'password123',
      newPassword: 'newpassword123',
      newPasswordConfirmation: 'different123',
    })
    expect(result.success).toBe(false)
  })
})

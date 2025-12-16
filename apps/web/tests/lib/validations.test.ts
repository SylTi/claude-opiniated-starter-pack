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

describe('Form Validation Schemas', () => {
  describe('registerSchema', () => {
    it('accepts valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        passwordConfirmation: 'password123',
        fullName: 'John Doe',
      })
      expect(result.success).toBe(true)
    })

    it('accepts registration without fullName (optional)', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        passwordConfirmation: 'password123',
      })
      expect(result.success).toBe(true)
    })

    it('accepts empty fullName', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        passwordConfirmation: 'password123',
        fullName: '',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
        passwordConfirmation: 'password123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email')
        expect(result.error.issues[0].message).toBe('Invalid email address')
      }
    })

    it('rejects empty email', () => {
      const result = registerSchema.safeParse({
        email: '',
        password: 'password123',
        passwordConfirmation: 'password123',
      })
      expect(result.success).toBe(false)
    })

    it('rejects password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
        passwordConfirmation: 'short',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password')
        expect(result.error.issues[0].message).toBe('Password must be at least 8 characters')
      }
    })

    it('rejects password longer than 128 characters', () => {
      const longPassword = 'a'.repeat(129)
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: longPassword,
        passwordConfirmation: longPassword,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password')
        expect(result.error.issues[0].message).toBe('Password must be at most 128 characters')
      }
    })

    it('rejects mismatched passwords', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        passwordConfirmation: 'different123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('passwordConfirmation')
        expect(result.error.issues[0].message).toBe("Passwords don't match")
      }
    })

    it('rejects fullName shorter than 2 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        passwordConfirmation: 'password123',
        fullName: 'A',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('fullName')
        expect(result.error.issues[0].message).toBe('Name must be at least 2 characters')
      }
    })

    it('rejects fullName longer than 255 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        passwordConfirmation: 'password123',
        fullName: 'A'.repeat(256),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('fullName')
        expect(result.error.issues[0].message).toBe('Name must be at most 255 characters')
      }
    })

    it('accepts password with exactly 8 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: '12345678',
        passwordConfirmation: '12345678',
      })
      expect(result.success).toBe(true)
    })

    it('accepts password with exactly 128 characters', () => {
      const password = 'a'.repeat(128)
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password,
        passwordConfirmation: password,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('loginSchema', () => {
    it('accepts valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      })
      expect(result.success).toBe(true)
    })

    it('accepts login with MFA code', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        mfaCode: '123456',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid',
        password: 'password123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email')
      }
    })

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password')
        expect(result.error.issues[0].message).toBe('Password is required')
      }
    })

    it('rejects MFA code with wrong length', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        mfaCode: '12345',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('mfaCode')
      }
    })

    it('rejects MFA code with non-digits', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        mfaCode: '12345a',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('mfaCode')
        expect(result.error.issues[0].message).toBe('Code must contain only digits')
      }
    })

    it('accepts empty MFA code (optional)', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        mfaCode: '',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('forgotPasswordSchema', () => {
    it('accepts valid email', () => {
      const result = forgotPasswordSchema.safeParse({
        email: 'test@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = forgotPasswordSchema.safeParse({
        email: 'invalid',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email address')
      }
    })

    it('rejects empty email', () => {
      const result = forgotPasswordSchema.safeParse({
        email: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('resetPasswordSchema', () => {
    it('accepts valid reset password data', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'newpassword123',
        passwordConfirmation: 'newpassword123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects password shorter than 8 characters', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'short',
        passwordConfirmation: 'short',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at least 8 characters')
      }
    })

    it('rejects password longer than 128 characters', () => {
      const longPassword = 'a'.repeat(129)
      const result = resetPasswordSchema.safeParse({
        password: longPassword,
        passwordConfirmation: longPassword,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at most 128 characters')
      }
    })

    it('rejects mismatched passwords', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'password123',
        passwordConfirmation: 'different123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Passwords don't match")
      }
    })
  })

  describe('mfaCodeSchema', () => {
    it('accepts valid 6-digit code', () => {
      const result = mfaCodeSchema.safeParse({
        code: '123456',
      })
      expect(result.success).toBe(true)
    })

    it('rejects code with less than 6 digits', () => {
      const result = mfaCodeSchema.safeParse({
        code: '12345',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Code must be 6 digits')
      }
    })

    it('rejects code with more than 6 digits', () => {
      const result = mfaCodeSchema.safeParse({
        code: '1234567',
      })
      expect(result.success).toBe(false)
    })

    it('rejects code with non-digit characters', () => {
      const result = mfaCodeSchema.safeParse({
        code: '12345a',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Code must contain only digits')
      }
    })

    it('rejects code with spaces', () => {
      const result = mfaCodeSchema.safeParse({
        code: '123 56',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty code', () => {
      const result = mfaCodeSchema.safeParse({
        code: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('profileSchema', () => {
    it('accepts valid profile data', () => {
      const result = profileSchema.safeParse({
        fullName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      })
      expect(result.success).toBe(true)
    })

    it('accepts empty fullName (optional)', () => {
      const result = profileSchema.safeParse({
        fullName: '',
        avatarUrl: '',
      })
      expect(result.success).toBe(true)
    })

    it('accepts missing fields (all optional)', () => {
      const result = profileSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects fullName shorter than 2 characters', () => {
      const result = profileSchema.safeParse({
        fullName: 'A',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name must be at least 2 characters')
      }
    })

    it('rejects fullName longer than 255 characters', () => {
      const result = profileSchema.safeParse({
        fullName: 'A'.repeat(256),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name must be at most 255 characters')
      }
    })

    it('rejects invalid URL for avatarUrl', () => {
      const result = profileSchema.safeParse({
        fullName: 'John Doe',
        avatarUrl: 'not-a-url',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Must be a valid URL')
      }
    })

    it('accepts valid HTTP URL', () => {
      const result = profileSchema.safeParse({
        avatarUrl: 'http://example.com/avatar.png',
      })
      expect(result.success).toBe(true)
    })

    it('accepts valid HTTPS URL', () => {
      const result = profileSchema.safeParse({
        avatarUrl: 'https://example.com/avatar.png',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('changePasswordSchema', () => {
    it('accepts valid change password data', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
        newPasswordConfirmation: 'newpassword123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty current password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: '',
        newPassword: 'newpassword123',
        newPasswordConfirmation: 'newpassword123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Current password is required')
      }
    })

    it('rejects new password shorter than 8 characters', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword',
        newPassword: 'short',
        newPasswordConfirmation: 'short',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at least 8 characters')
      }
    })

    it('rejects new password longer than 128 characters', () => {
      const longPassword = 'a'.repeat(129)
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword',
        newPassword: longPassword,
        newPasswordConfirmation: longPassword,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at most 128 characters')
      }
    })

    it('rejects mismatched new passwords', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
        newPasswordConfirmation: 'different123',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Passwords don't match")
      }
    })

    it('accepts current password of any length', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'a',
        newPassword: 'newpassword123',
        newPasswordConfirmation: 'newpassword123',
      })
      expect(result.success).toBe(true)
    })
  })
})

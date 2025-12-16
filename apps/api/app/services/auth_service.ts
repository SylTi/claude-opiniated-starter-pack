import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import PasswordResetToken from '#models/password_reset_token'
import EmailVerificationToken from '#models/email_verification_token'
import LoginHistory from '#models/login_history'
import type { LoginMethod } from '#models/login_history'

interface RegisterData {
  email: string
  password: string
  fullName?: string
}

interface LoginResult {
  user: User
  requiresMfa: boolean
}

export default class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<User> {
    const user = await User.create({
      email: data.email,
      password: data.password,
      fullName: data.fullName || null,
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    // Create email verification token
    await this.createEmailVerificationToken(user)

    return user
  }

  /**
   * Attempt to login a user with email and password
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await User.verifyCredentials(email, password)

    return {
      user,
      requiresMfa: user.mfaEnabled,
    }
  }

  /**
   * Record a login attempt in history
   */
  async recordLoginAttempt(
    userId: number,
    method: LoginMethod,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    failureReason?: string
  ): Promise<void> {
    await LoginHistory.create({
      userId,
      loginMethod: method,
      success,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      failureReason: failureReason || null,
    })
  }

  /**
   * Create a password reset token
   */
  async createPasswordResetToken(user: User): Promise<string> {
    // Delete any existing tokens for this user
    await PasswordResetToken.query().where('user_id', user.id).delete()

    const token = randomBytes(32).toString('hex')
    const expiresAt = DateTime.now().plus({ hours: 1 })

    await PasswordResetToken.create({
      userId: user.id,
      token,
      expiresAt,
    })

    return token
  }

  /**
   * Verify and use a password reset token
   */
  async verifyPasswordResetToken(token: string): Promise<User | null> {
    const resetToken = await PasswordResetToken.query()
      .where('token', token)
      .preload('user')
      .first()

    if (!resetToken || resetToken.isExpired()) {
      return null
    }

    return resetToken.user
  }

  /**
   * Reset user password using token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await this.verifyPasswordResetToken(token)

    if (!user) {
      return false
    }

    user.password = newPassword
    await user.save()

    // Delete the used token
    await PasswordResetToken.query().where('token', token).delete()

    return true
  }

  /**
   * Create an email verification token
   */
  async createEmailVerificationToken(user: User): Promise<string> {
    // Delete any existing tokens for this user
    await EmailVerificationToken.query().where('user_id', user.id).delete()

    const token = randomBytes(32).toString('hex')
    const expiresAt = DateTime.now().plus({ hours: 24 })

    await EmailVerificationToken.create({
      userId: user.id,
      token,
      expiresAt,
    })

    return token
  }

  /**
   * Verify email using token
   */
  async verifyEmail(token: string): Promise<boolean> {
    const verificationToken = await EmailVerificationToken.query()
      .where('token', token)
      .preload('user')
      .first()

    if (!verificationToken || verificationToken.isExpired()) {
      return false
    }

    const user = verificationToken.user
    user.emailVerified = true
    user.emailVerifiedAt = DateTime.now()
    await user.save()

    // Delete the used token
    await EmailVerificationToken.query().where('token', token).delete()

    return true
  }

  /**
   * Change user password
   */
  async changePassword(user: User, currentPassword: string, newPassword: string): Promise<boolean> {
    // Verify current password
    if (user.password) {
      const isValid = await hash.verify(user.password, currentPassword)
      if (!isValid) {
        return false
      }
    }

    user.password = newPassword
    await user.save()

    return true
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return User.findBy('email', email)
  }

  /**
   * Get user login history
   */
  async getLoginHistory(userId: number, limit: number = 10): Promise<LoginHistory[]> {
    return LoginHistory.query().where('user_id', userId).orderBy('created_at', 'desc').limit(limit)
  }
}

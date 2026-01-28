import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import PasswordResetToken from '#models/password_reset_token'
import EmailVerificationToken from '#models/email_verification_token'
import LoginHistory from '#models/login_history'
import type { LoginMethod } from '#models/login_history'
import { systemOps } from '#services/system_operation_service'

interface RegisterData {
  email: string
  password: string
  fullName?: string
}

interface LoginResult {
  user: User
  requiresMfa: boolean
}

interface RegisterResult {
  user: User
  verificationToken: string
}

export default class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<RegisterResult> {
    const user = await User.create({
      email: data.email,
      password: data.password,
      fullName: data.fullName || null,
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    // Create email verification token
    const verificationToken = await this.createEmailVerificationToken(user)

    return { user, verificationToken }
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
   *
   * Uses system RLS context because login history is recorded during
   * public authentication flows before user context is established.
   */
  async recordLoginAttempt(
    userId: number,
    method: LoginMethod,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    failureReason?: string,
    tenantId?: number | null
  ): Promise<void> {
    await systemOps.withSystemContext(async (trx) => {
      await LoginHistory.create(
        {
          userId,
          tenantId: tenantId ?? null,
          loginMethod: method,
          success,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          failureReason: failureReason || null,
        },
        { client: trx }
      )
    })
  }

  /**
   * Create a password reset token
   * Returns the plaintext token to send via email (hash is stored in DB)
   */
  async createPasswordResetToken(user: User): Promise<string> {
    // Delete any existing tokens for this user
    await PasswordResetToken.query().where('user_id', user.id).delete()

    const { plainToken, hashedToken } = PasswordResetToken.generateToken()
    const expiresAt = DateTime.now().plus({ hours: 1 })

    await PasswordResetToken.create({
      userId: user.id,
      token: hashedToken,
      expiresAt,
    })

    return plainToken
  }

  /**
   * Verify and use a password reset token
   * Accepts the plaintext token, hashes it internally for lookup
   */
  async verifyPasswordResetToken(token: string): Promise<User | null> {
    const resetToken = await PasswordResetToken.findByPlainToken(token)

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

    // Delete the used token (hash it for lookup)
    await PasswordResetToken.deleteByPlainToken(token)

    return true
  }

  /**
   * Create an email verification token
   * Returns the plaintext token to send via email (hash is stored in DB)
   */
  async createEmailVerificationToken(user: User): Promise<string> {
    // Delete any existing tokens for this user
    await EmailVerificationToken.query().where('user_id', user.id).delete()

    const { plainToken, hashedToken } = EmailVerificationToken.generateToken()
    const expiresAt = DateTime.now().plus({ hours: 24 })

    await EmailVerificationToken.create({
      userId: user.id,
      token: hashedToken,
      expiresAt,
    })

    return plainToken
  }

  /**
   * Verify email using token
   * Accepts the plaintext token, hashes it internally for lookup
   */
  async verifyEmail(token: string): Promise<boolean> {
    const verificationToken = await EmailVerificationToken.findByPlainToken(token)

    if (!verificationToken || verificationToken.isExpired()) {
      return false
    }

    const user = verificationToken.user
    user.emailVerified = true
    user.emailVerifiedAt = DateTime.now()
    await user.save()

    // Delete the used token (hash it for lookup)
    await EmailVerificationToken.deleteByPlainToken(token)

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
   * Get user login history (uses default connection, no RLS)
   */
  async getLoginHistory(userId: number, limit: number = 10): Promise<LoginHistory[]> {
    return LoginHistory.query().where('user_id', userId).orderBy('created_at', 'desc').limit(limit)
  }

  /**
   * Get user login history with RLS context
   *
   * Uses the provided transaction client which has app.user_id set.
   * The RLS policy allows users to see their own login history (user_id = app_current_user_id()).
   */
  async getLoginHistoryWithClient(
    userId: number,
    client: Awaited<ReturnType<typeof import('@adonisjs/lucid/services/db').default.transaction>>,
    limit: number = 10
  ): Promise<LoginHistory[]> {
    return LoginHistory.query({ client })
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
  }
}

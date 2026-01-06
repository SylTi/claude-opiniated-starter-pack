import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  updateProfileValidator,
  changePasswordValidator,
} from '#validators/auth'
import AuthService from '#services/auth_service'
import MailService from '#services/mail_service'
import CookieSigningService from '#services/cookie_signing_service'
import TeamInvitation from '#models/team_invitation'
import TeamMember from '#models/team_member'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'

export default class AuthController {
  private authService = new AuthService()
  private mailService = new MailService()
  private cookieSigning = new CookieSigningService()

  private serializeTier(tier: SubscriptionTier) {
    return {
      id: tier.id,
      slug: tier.slug,
      name: tier.name,
      description: null,
      level: tier.level,
      maxTeamMembers: tier.maxTeamMembers,
      priceMonthly: tier.priceMonthly,
      yearlyDiscountPercent: tier.yearlyDiscountPercent,
      features: tier.features,
      isActive: tier.isActive,
    }
  }

  private async getEffectiveTier(userId: number, currentTeamId: number | null) {
    if (currentTeamId) {
      const teamSubscription = await Subscription.getActiveForTeam(currentTeamId)
      if (teamSubscription?.tier) {
        return teamSubscription.tier
      }
    }

    const userSubscription = await Subscription.getActiveForUser(userId)
    if (userSubscription?.tier) {
      return userSubscription.tier
    }

    return SubscriptionTier.getFreeTier()
  }

  /**
   * Register a new user
   * POST /api/v1/auth/register
   *
   * Security: Returns generic response to prevent user enumeration.
   * Adds random timing delay to prevent timing-based attacks.
   */
  async register({ request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(registerValidator)

    // Add random delay (100-300ms) to prevent timing-based enumeration
    const delay = 100 + Math.random() * 200
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Check if email already exists - but don't reveal this to the user
    const existingUser = await this.authService.findByEmail(data.email)
    if (existingUser) {
      // Return same generic response as successful registration
      // to prevent email enumeration attacks
      response.created({
        message: 'Registration initiated. Please check your email to verify your account.',
      })
      return
    }

    // Check for valid invitation if token is provided
    let invitation: TeamInvitation | null = null
    if (data.invitationToken) {
      invitation = await TeamInvitation.query()
        .where('token', data.invitationToken)
        .preload('team', (query) => {
          query.preload('members')
        })
        .first()

      if (!invitation) {
        response.badRequest({
          error: 'InvalidInvitation',
          message: 'Invalid invitation token',
        })
        return
      }

      if (!invitation.isValid()) {
        response.badRequest({
          error: 'InvalidInvitation',
          message: invitation.isExpired()
            ? 'This invitation has expired'
            : `This invitation has been ${invitation.status}`,
        })
        return
      }

      // Verify email matches invitation
      if (invitation.email.toLowerCase() !== data.email.toLowerCase()) {
        response.badRequest({
          error: 'EmailMismatch',
          message: 'Your email does not match the invitation email',
        })
        return
      }

      // Check team member limit
      if (!(await invitation.team.canAddMember(invitation.team.members.length))) {
        response.badRequest({
          error: 'LimitReached',
          message: 'This team has reached its member limit',
        })
        return
      }
    }

    const { user, verificationToken } = await this.authService.register(data)

    // Auto-join team if there's a valid invitation
    let joinedTeam = null
    if (invitation) {
      // Add user to team
      await TeamMember.create({
        userId: user.id,
        teamId: invitation.teamId,
        role: invitation.role,
      })

      // Update user's current team
      user.currentTeamId = invitation.teamId
      await user.save()

      // Mark invitation as accepted
      invitation.status = 'accepted'
      await invitation.save()

      joinedTeam = {
        id: invitation.team.id,
        name: invitation.team.name,
        slug: invitation.team.slug,
        role: invitation.role,
      }
    }

    // Send verification email (non-blocking, don't fail registration if email fails)
    this.mailService
      .sendVerificationEmail(user.email, verificationToken, user.fullName ?? undefined)
      .catch((err) => logger.error({ err }, 'Failed to send verification email'))

    // For new registrations with invitation, we can be more specific
    // since the invitation token already proves the user was invited
    if (joinedTeam) {
      response.created({
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          currentTeamId: user.currentTeamId,
          joinedTeam,
          emailVerified: user.emailVerified,
        },
        message: `Registration successful. You have been added to team "${joinedTeam.name}".`,
      })
      return
    }

    // Generic response for regular registration to prevent enumeration
    response.created({
      message: 'Registration initiated. Please check your email to verify your account.',
    })
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login({ request, response, auth }: HttpContext): Promise<void> {
    const { email, password, mfaCode } = await request.validateUsing(loginValidator)
    const ipAddress = request.ip()
    const userAgent = request.header('user-agent')

    try {
      const { user, requiresMfa } = await this.authService.login(email, password)

      // If MFA is enabled, verify the code
      if (requiresMfa) {
        if (!mfaCode) {
          response.ok({
            data: { requiresMfa: true },
            message: 'MFA code required',
          })
          return
        }

        // Import MFA service and verify
        const mfaModule = await import('#services/mfa_service')
        const MfaService = mfaModule.default
        const mfaService = new MfaService()

        const isValidMfa = await mfaService.verifyUserMfa(user, mfaCode)
        if (!isValidMfa) {
          await this.authService.recordLoginAttempt(
            user.id,
            'mfa',
            false,
            ipAddress,
            userAgent,
            'Invalid MFA code'
          )
          response.unauthorized({
            error: 'InvalidMfaCode',
            message: 'Invalid MFA code',
          })
          return
        }
      }

      // Login the user
      await auth.use('web').login(user)

      // Set signed user info cookie for frontend middleware optimization
      // This avoids API calls on every admin route request
      // Uses JWT (jose) - only contains role, no PII
      const signedUserInfo = await this.cookieSigning.sign({ role: user.role })
      response.cookie('user-info', signedUserInfo, {
        httpOnly: false, // Must be readable by Next.js middleware (server-side)
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 2 * 60 * 60, // 2 hours, matches session age
        path: '/',
      })

      // Record successful login
      await this.authService.recordLoginAttempt(
        user.id,
        requiresMfa ? 'mfa' : 'password',
        true,
        ipAddress,
        userAgent
      )

      // Load current team if exists
      if (user.currentTeamId) {
        await user.load('currentTeam')
      }

      const effectiveTier = await this.getEffectiveTier(user.id, user.currentTeamId)

      response.ok({
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          balance: user.balance,
          balanceCurrency: user.balanceCurrency,
          currentTeamId: user.currentTeamId,
          currentTeam: user.currentTeam
            ? {
                id: user.currentTeam.id,
                name: user.currentTeam.name,
                slug: user.currentTeam.slug,
              }
            : null,
          effectiveSubscriptionTier: this.serializeTier(effectiveTier),
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt.toISO(),
          updatedAt: user.updatedAt?.toISO() ?? null,
          subscription: null,
        },
        message: 'Login successful',
      })
    } catch (error) {
      // Try to find user to record failed attempt
      const user = await this.authService.findByEmail(email)
      if (user) {
        await this.authService.recordLoginAttempt(
          user.id,
          'password',
          false,
          ipAddress,
          userAgent,
          'Invalid credentials'
        )
      }

      response.unauthorized({
        error: 'InvalidCredentials',
        message: 'Invalid email or password',
      })
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  async logout({ response, auth }: HttpContext): Promise<void> {
    await auth.use('web').logout()

    // Clear the user info cookie
    response.clearCookie('user-info')

    response.ok({
      message: 'Logout successful',
    })
  }

  /**
   * Get current authenticated user
   * GET /api/v1/auth/me
   */
  async me({ response, auth }: HttpContext): Promise<void> {
    const user = auth.user!

    // Load current team if exists
    if (user.currentTeamId) {
      await user.load('currentTeam')
    }

    const effectiveTier = await this.getEffectiveTier(user.id, user.currentTeamId)

    response.ok({
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        balance: user.balance,
        balanceCurrency: user.balanceCurrency,
        currentTeamId: user.currentTeamId,
        currentTeam: user.currentTeam
          ? {
              id: user.currentTeam.id,
              name: user.currentTeam.name,
              slug: user.currentTeam.slug,
            }
          : null,
        effectiveSubscriptionTier: this.serializeTier(effectiveTier),
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISO(),
        updatedAt: user.updatedAt?.toISO() ?? null,
        subscription: null,
      },
    })
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword({ request, response }: HttpContext): Promise<void> {
    const { email } = await request.validateUsing(forgotPasswordValidator)

    const user = await this.authService.findByEmail(email)

    // Always return success to prevent email enumeration
    if (user) {
      const token = await this.authService.createPasswordResetToken(user)
      // Send password reset email (non-blocking)
      this.mailService
        .sendPasswordResetEmail(user.email, token, user.fullName ?? undefined)
        .catch((err) => logger.error({ err }, 'Failed to send password reset email'))
    }

    response.ok({
      message: 'If an account exists with this email, you will receive a password reset link.',
    })
  }

  /**
   * Reset password using token
   * POST /api/v1/auth/reset-password
   */
  async resetPassword({ request, response }: HttpContext): Promise<void> {
    const { token, password } = await request.validateUsing(resetPasswordValidator)

    const success = await this.authService.resetPassword(token, password)

    if (!success) {
      response.badRequest({
        error: 'InvalidToken',
        message: 'Invalid or expired password reset token',
      })
      return
    }

    response.ok({
      message: 'Password has been reset successfully',
    })
  }

  /**
   * Verify email using token
   * GET /api/v1/auth/verify-email/:token
   */
  async verifyEmail({ params, response }: HttpContext): Promise<void> {
    const { token } = params

    const success = await this.authService.verifyEmail(token)

    if (!success) {
      response.badRequest({
        error: 'InvalidToken',
        message: 'Invalid or expired verification token',
      })
      return
    }

    response.ok({
      message: 'Email verified successfully',
    })
  }

  /**
   * Resend email verification
   * POST /api/v1/auth/resend-verification
   */
  async resendVerification({ response, auth }: HttpContext): Promise<void> {
    const user = auth.user!

    if (user.emailVerified) {
      response.badRequest({
        error: 'AlreadyVerified',
        message: 'Email is already verified',
      })
      return
    }

    const token = await this.authService.createEmailVerificationToken(user)
    // Send verification email (non-blocking)
    this.mailService
      .sendVerificationEmail(user.email, token, user.fullName ?? undefined)
      .catch((err) => logger.error({ err }, 'Failed to send verification email'))

    response.ok({
      message: 'Verification email has been sent',
    })
  }

  /**
   * Update user profile
   * PUT /api/v1/auth/profile
   */
  async updateProfile({ request, response, auth }: HttpContext): Promise<void> {
    const data = await request.validateUsing(updateProfileValidator)
    const user = auth.user!

    if (data.fullName !== undefined) {
      user.fullName = data.fullName
    }
    if (data.avatarUrl !== undefined) {
      user.avatarUrl = data.avatarUrl
    }

    await user.save()

    response.ok({
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        avatarUrl: user.avatarUrl,
      },
      message: 'Profile updated successfully',
    })
  }

  /**
   * Change password
   * PUT /api/v1/auth/password
   */
  async changePassword({ request, response, auth }: HttpContext): Promise<void> {
    const { currentPassword, newPassword } = await request.validateUsing(changePasswordValidator)
    const user = auth.user!

    const success = await this.authService.changePassword(user, currentPassword, newPassword)

    if (!success) {
      response.badRequest({
        error: 'InvalidPassword',
        message: 'Current password is incorrect',
      })
      return
    }

    response.ok({
      message: 'Password changed successfully',
    })
  }

  /**
   * Get login history
   * GET /api/v1/auth/login-history
   */
  async loginHistory({ response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const history = await this.authService.getLoginHistory(user.id)

    response.ok({
      data: history.map((entry) => ({
        id: entry.id,
        loginMethod: entry.loginMethod,
        success: entry.success,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        failureReason: entry.failureReason,
        createdAt: entry.createdAt,
      })),
    })
  }
}

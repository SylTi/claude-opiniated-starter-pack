import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import string from '@adonisjs/core/helpers/string'
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
import TenantInvitation from '#models/tenant_invitation'
import TenantMembership from '#models/tenant_membership'
import Tenant from '#models/tenant'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'
import { TENANT_ROLES } from '#constants/roles'

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

  /**
   * Get effective tier for a tenant (tenant is the billing unit)
   */
  private async getEffectiveTier(tenantId: number | null) {
    if (tenantId) {
      const tenantSubscription = await Subscription.getActiveForTenant(tenantId)
      if (tenantSubscription?.tier) {
        return tenantSubscription.tier
      }
    }

    return SubscriptionTier.getFreeTier()
  }

  /**
   * Register a new user
   * POST /api/v1/auth/register
   *
   * Creates a personal tenant for every new user.
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
    let invitation: TenantInvitation | null = null
    if (data.invitationToken) {
      invitation = await TenantInvitation.query()
        .where('token', data.invitationToken)
        .preload('tenant', (query) => {
          query.preload('memberships')
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

      // Check tenant member limit
      if (!(await invitation.tenant.canAddMember(invitation.tenant.memberships.length))) {
        response.badRequest({
          error: 'LimitReached',
          message: 'This tenant has reached its member limit',
        })
        return
      }
    }

    const { user, verificationToken } = await this.authService.register(data)

    // Create personal tenant for every user (tenant is the billing unit)
    const personalTenantSlug = `personal-${string.slug(user.email.split('@')[0]).toLowerCase()}-${string.random(4).toLowerCase()}`
    const personalTenant = await Tenant.create({
      name: user.fullName || user.email.split('@')[0],
      slug: personalTenantSlug,
      type: 'personal',
      ownerId: user.id,
      balance: 0,
      balanceCurrency: 'usd',
    })

    // Add user as owner of their personal tenant
    await TenantMembership.create({
      userId: user.id,
      tenantId: personalTenant.id,
      role: TENANT_ROLES.OWNER,
    })

    // Set personal tenant as current tenant
    user.currentTenantId = personalTenant.id

    // Auto-join tenant if there's a valid invitation
    let joinedTenant = null
    if (invitation) {
      // Add user to invited tenant
      await TenantMembership.create({
        userId: user.id,
        tenantId: invitation.tenantId,
        role: invitation.role,
      })

      // Update user's current tenant to the invited one
      user.currentTenantId = invitation.tenantId

      // Mark invitation as accepted
      invitation.status = 'accepted'
      await invitation.save()

      joinedTenant = {
        id: invitation.tenant.id,
        name: invitation.tenant.name,
        slug: invitation.tenant.slug,
        role: invitation.role,
      }
    }

    await user.save()

    // Send verification email (non-blocking, don't fail registration if email fails)
    this.mailService
      .sendVerificationEmail(user.email, verificationToken, user.fullName ?? undefined)
      .catch((err) => logger.error({ err }, 'Failed to send verification email'))

    // For new registrations with invitation, we can be more specific
    // since the invitation token already proves the user was invited
    if (joinedTenant) {
      response.created({
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          currentTenantId: user.currentTenantId,
          personalTenantId: personalTenant.id,
          joinedTenant,
          emailVerified: user.emailVerified,
        },
        message: `Registration successful. You have been added to tenant "${joinedTenant.name}".`,
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

      // Load current tenant if exists
      if (user.currentTenantId) {
        await user.load('currentTenant')
      }

      const effectiveTier = await this.getEffectiveTier(user.currentTenantId)

      response.ok({
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          currentTenantId: user.currentTenantId,
          currentTenant: user.currentTenant
            ? {
                id: user.currentTenant.id,
                name: user.currentTenant.name,
                slug: user.currentTenant.slug,
                type: user.currentTenant.type,
                balance: user.currentTenant.balance,
                balanceCurrency: user.currentTenant.balanceCurrency,
              }
            : null,
          effectiveSubscriptionTier: this.serializeTier(effectiveTier),
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt.toISO(),
          updatedAt: user.updatedAt?.toISO() ?? null,
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

    // Load current tenant if exists
    if (user.currentTenantId) {
      await user.load('currentTenant')
    }

    const effectiveTier = await this.getEffectiveTier(user.currentTenantId)

    response.ok({
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        currentTenantId: user.currentTenantId,
        currentTenant: user.currentTenant
          ? {
              id: user.currentTenant.id,
              name: user.currentTenant.name,
              slug: user.currentTenant.slug,
              type: user.currentTenant.type,
              balance: user.currentTenant.balance,
              balanceCurrency: user.currentTenant.balanceCurrency,
            }
          : null,
        effectiveSubscriptionTier: this.serializeTier(effectiveTier),
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISO(),
        updatedAt: user.updatedAt?.toISO() ?? null,
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

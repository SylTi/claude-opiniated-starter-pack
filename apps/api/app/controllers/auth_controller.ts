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
import User from '#models/user'
import { TENANT_ROLES, type TenantRole } from '#constants/roles'
import { AuditContext } from '#services/audit_context'
import { AUDIT_EVENT_TYPES } from '#constants/audit_events'
import { systemOps } from '#services/system_operation_service'
import { hookRegistry } from '@saas/plugins-core'
import { tenantQuotaService } from '#services/tenant_quota_service'

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
   *
   * Uses system RLS context because:
   * - This is called during login/me where no tenant context is set
   * - Tier data is not security-sensitive (just determines features)
   * - The subscription policy requires either system bypass or tenant_id match
   */
  private async getEffectiveTier(tenantId: number | null) {
    if (tenantId) {
      // Use system context to bypass RLS for subscription lookup
      const tenantSubscription = await systemOps.withSystemContext(async (trx) => {
        return Subscription.getActiveForTenant(tenantId, trx)
      })
      if (tenantSubscription?.tier) {
        return tenantSubscription.tier
      }
    }

    // Free tier lookup also needs system context for consistency
    return systemOps.withSystemContext(async (trx) => {
      return SubscriptionTier.getFreeTier(trx)
    })
  }

  /**
   * Register a new user
   * POST /api/v1/auth/register
   *
   * Creates a personal tenant for every new user.
   * Security: Returns generic response to prevent user enumeration.
   * Adds random timing delay to prevent timing-based attacks.
   *
   * Uses system RLS context for invitation lookup and tenant/membership creation
   * since this is a public endpoint without authenticated user context.
   */
  async register(ctx: HttpContext): Promise<void> {
    const { request, response } = ctx
    const audit = new AuditContext(ctx)
    const data = await request.validateUsing(registerValidator)

    // Add random delay (100-300ms) to prevent timing-based enumeration
    const delay = 100 + Math.random() * 200
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Check if email already exists - but don't reveal this to the user
    // User table doesn't have RLS, so no system context needed
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
    // Uses system context because tenant_invitations has RLS
    let invitationData: {
      id: number
      tenantId: number
      email: string
      role: TenantRole
      status: string
      expiresAt: Date | null
      tenantName: string
      tenantSlug: string
      memberCount: number
    } | null = null

    if (data.invitationToken) {
      invitationData = await systemOps.withSystemContext(async (trx) => {
        const invitation = await TenantInvitation.query({ client: trx })
          .where('token', data.invitationToken!)
          .preload('tenant', (query) => {
            query.preload('memberships')
          })
          .first()

        if (!invitation) {
          return null
        }

        return {
          id: invitation.id,
          tenantId: invitation.tenantId,
          email: invitation.email,
          role: invitation.role as TenantRole,
          status: invitation.status,
          expiresAt: invitation.expiresAt?.toJSDate() ?? null,
          tenantName: invitation.tenant.name,
          tenantSlug: invitation.tenant.slug,
          memberCount: invitation.tenant.memberships.length,
        }
      })

      if (!invitationData) {
        response.badRequest({
          error: 'InvalidInvitation',
          message: 'Invalid invitation token',
        })
        return
      }

      // Check if invitation is valid
      const isExpired = invitationData.expiresAt && new Date() > invitationData.expiresAt
      if (invitationData.status !== 'pending') {
        response.badRequest({
          error: 'InvalidInvitation',
          message: `This invitation has been ${invitationData.status}`,
        })
        return
      }
      if (isExpired) {
        response.badRequest({
          error: 'InvalidInvitation',
          message: 'This invitation has expired',
        })
        return
      }

      // Verify email matches invitation
      if (invitationData.email.toLowerCase() !== data.email.toLowerCase()) {
        response.badRequest({
          error: 'EmailMismatch',
          message: 'Your email does not match the invitation email',
        })
        return
      }

      // Check tenant member limit (need to load tier to check)
      const canAddMember = await systemOps.withSystemContext(async (trx) => {
        const tenant = await Tenant.query({ client: trx })
          .where('id', invitationData!.tenantId)
          .first()
        if (!tenant) return false
        const limits = await tenantQuotaService.getEffectiveLimits(tenant, trx)
        return !tenantQuotaService.willExceed(limits.members, invitationData!.memberCount, 1)
      })

      if (!canAddMember) {
        response.badRequest({
          error: 'LimitReached',
          message: 'This tenant has reached its member limit',
        })
        return
      }
    }

    // Register user (User table doesn't have RLS)
    const { user, verificationToken } = await this.authService.register(data)

    // Create personal tenant and memberships using system context
    // because tenants and tenant_memberships have RLS
    const { personalTenant, joinedTenant } = await systemOps.withSystemContext(async (trx) => {
      // Create personal tenant for every user (tenant is the billing unit)
      const personalTenantSlug = `personal-${string.slug(user.email.split('@')[0]).toLowerCase()}-${string.random(4).toLowerCase()}`
      const newPersonalTenant = await Tenant.create(
        {
          name: user.fullName || user.email.split('@')[0],
          slug: personalTenantSlug,
          type: 'personal',
          ownerId: user.id,
          balance: 0,
          balanceCurrency: 'usd',
        },
        { client: trx }
      )

      // Add user as owner of their personal tenant
      await TenantMembership.create(
        {
          userId: user.id,
          tenantId: newPersonalTenant.id,
          role: TENANT_ROLES.OWNER,
        },
        { client: trx }
      )

      // Set personal tenant as current tenant
      let currentTenantId = newPersonalTenant.id
      let joined: { id: number; name: string; slug: string; role: string } | null = null

      // Auto-join tenant if there's a valid invitation
      if (invitationData) {
        // Add user to invited tenant
        await TenantMembership.create(
          {
            userId: user.id,
            tenantId: invitationData.tenantId,
            role: invitationData.role,
          },
          { client: trx }
        )

        // Update user's current tenant to the invited one
        currentTenantId = invitationData.tenantId

        // Mark invitation as accepted
        await TenantInvitation.query({ client: trx })
          .where('id', invitationData.id)
          .update({ status: 'accepted' })

        joined = {
          id: invitationData.tenantId,
          name: invitationData.tenantName,
          slug: invitationData.tenantSlug,
          role: invitationData.role,
        }
      }

      // Update user's current tenant (User table doesn't have RLS but we're in transaction)
      await User.query({ client: trx }).where('id', user.id).update({
        current_tenant_id: currentTenantId,
      })
      user.currentTenantId = currentTenantId

      return { personalTenant: newPersonalTenant, joinedTenant: joined }
    })

    // Send verification email (non-blocking, don't fail registration if email fails)
    this.mailService
      .sendVerificationEmail(user.email, verificationToken, user.fullName ?? undefined)
      .catch((err) => logger.error({ err }, 'Failed to send verification email'))

    // Emit plugin hooks for personal tenant creation and registration
    hookRegistry
      .doAction('team:created', { tenantId: personalTenant.id, ownerId: user.id, type: 'personal' })
      .catch(() => {})
    hookRegistry
      .doAction('auth:registered', {
        userId: user.id,
        email: user.email,
        tenantId: personalTenant.id,
      })
      .catch(() => {})

    // For new registrations with invitation, we can be more specific
    // since the invitation token already proves the user was invited
    if (joinedTenant) {
      // Emit audit event for registration with invitation
      audit.emitWithActor(
        AUDIT_EVENT_TYPES.AUTH_REGISTER,
        audit.createUserActor(user.id),
        { type: 'user', id: user.id },
        { joinedTenantId: joinedTenant.id }
      )

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

    // Emit audit event for successful registration
    audit.emitWithActor(AUDIT_EVENT_TYPES.AUTH_REGISTER, audit.createUserActor(user.id), {
      type: 'user',
      id: user.id,
    })

    // Generic response for regular registration to prevent enumeration
    response.created({
      message: 'Registration initiated. Please check your email to verify your account.',
    })
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(ctx: HttpContext): Promise<void> {
    const { request, response, auth } = ctx
    const audit = new AuditContext(ctx)
    const { email, password, mfaCode } = await request.validateUsing(loginValidator)
    const ipAddress = request.ip()
    const userAgent = request.header('user-agent')

    try {
      const { user, requiresMfa } = await this.authService.login(email, password)

      // Check SSO break-glass: If user's current tenant has SSO-only mode,
      // check if password login is allowed for this user (enterprise feature)
      if (user.currentTenantId) {
        try {
          // @ts-ignore - Enterprise feature: module may not exist on public repo
          const ssoModule = await import('#services/sso/index')
          const isPasswordAllowed = await ssoModule.ssoService.isPasswordLoginAllowed(
            user,
            user.currentTenantId
          )
          if (!isPasswordAllowed) {
            // User must use SSO - return SSO redirect info
            const { default: env } = await import('#start/env')
            const baseUrl = env.get('APP_URL', 'http://localhost:3333')
            const ssoStartUrl = `${baseUrl}/api/v1/auth/sso/${user.currentTenantId}/start`

            return response.forbidden({
              error: 'SsoRequired',
              message: 'This tenant requires SSO login. Please use SSO to sign in.',
              ssoUrl: ssoStartUrl,
              tenantId: user.currentTenantId,
            })
          }
        } catch {
          // SSO module not available — password login always allowed
        }
      }

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
        if (isValidMfa) {
          hookRegistry.doAction('auth:mfa_verified', { userId: user.id }).catch(() => {})
        }
        if (!isValidMfa) {
          await this.authService.recordLoginAttempt(
            user.id,
            'mfa',
            false,
            ipAddress,
            userAgent,
            'Invalid MFA code'
          )

          // Emit audit event for failed MFA
          audit.emitWithActor(
            AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILURE,
            audit.createUserActor(user.id),
            { type: 'user', id: user.id },
            { reason: 'invalid_mfa_code' }
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
        sameSite: 'lax', // Match session cookie setting for OAuth compatibility
        maxAge: 2 * 60 * 60, // 2 hours, matches session age
        path: '/',
        // In dev, set domain to localhost for cross-port cookie sharing (Next.js on 3000, API on 3333)
        ...(process.env.NODE_ENV === 'production' ? {} : { domain: 'localhost' }),
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

      // Emit audit event for successful login
      audit.emitWithActor(
        AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
        audit.createUserActor(user.id),
        { type: 'user', id: user.id },
        { mfaUsed: requiresMfa }
      )

      // Emit plugin hook for login
      hookRegistry
        .doAction('auth:logged_in', {
          userId: user.id,
          method: requiresMfa ? 'mfa' : 'password',
          tenantId: user.currentTenantId,
        })
        .catch(() => {})

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

        // Emit audit event for failed login
        audit.emitWithActor(
          AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILURE,
          audit.createUserActor(user.id),
          { type: 'user', id: user.id },
          { reason: 'invalid_credentials' }
        )
      } else {
        // Emit audit event for failed login with unknown user
        audit.emit(AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILURE, undefined, {
          reason: 'user_not_found',
        })
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
  async logout(ctx: HttpContext): Promise<void> {
    const { response, auth } = ctx
    const audit = new AuditContext(ctx)
    const userId = auth.user?.id

    await auth.use('web').logout()

    // Clear the user info cookie
    response.clearCookie('user-info')

    // Emit audit event for logout
    if (userId) {
      audit.emitWithActor(AUDIT_EVENT_TYPES.AUTH_LOGOUT, audit.createUserActor(userId), {
        type: 'user',
        id: userId,
      })
      hookRegistry.doAction('auth:logged_out', { userId }).catch(() => {})
    }

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
  async forgotPassword(ctx: HttpContext): Promise<void> {
    const { request, response } = ctx
    const audit = new AuditContext(ctx)
    const { email } = await request.validateUsing(forgotPasswordValidator)

    const user = await this.authService.findByEmail(email)

    // Always return success to prevent email enumeration
    if (user) {
      const token = await this.authService.createPasswordResetToken(user)
      // Send password reset email (non-blocking)
      this.mailService
        .sendPasswordResetEmail(user.email, token, user.fullName ?? undefined)
        .catch((err) => logger.error({ err }, 'Failed to send password reset email'))

      // Emit audit event for password reset request
      audit.emitWithActor(
        AUDIT_EVENT_TYPES.AUTH_PASSWORD_RESET_REQUEST,
        audit.createUserActor(user.id),
        { type: 'user', id: user.id }
      )
    }

    response.ok({
      message: 'If an account exists with this email, you will receive a password reset link.',
    })
  }

  /**
   * Reset password using token
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(ctx: HttpContext): Promise<void> {
    const { request, response } = ctx
    const audit = new AuditContext(ctx)
    const { token, password } = await request.validateUsing(resetPasswordValidator)

    // First verify the token to get user for audit logging
    const user = await this.authService.verifyPasswordResetToken(token)

    const success = await this.authService.resetPassword(token, password)

    if (!success) {
      response.badRequest({
        error: 'InvalidToken',
        message: 'Invalid or expired password reset token',
      })
      return
    }

    // Emit audit event for password reset
    if (user) {
      audit.emitWithActor(AUDIT_EVENT_TYPES.AUTH_PASSWORD_RESET, audit.createUserActor(user.id), {
        type: 'user',
        id: user.id,
      })
      hookRegistry.doAction('auth:password_reset', { userId: user.id }).catch(() => {})
    }

    response.ok({
      message: 'Password has been reset successfully',
    })
  }

  /**
   * Verify email using token
   * GET /api/v1/auth/verify-email/:token
   */
  async verifyEmail(ctx: HttpContext): Promise<void> {
    const { params, response } = ctx
    const audit = new AuditContext(ctx)
    const { token } = params

    // Get token details before verification for audit logging
    // Use findByPlainToken which hashes the token before lookup
    const emailVerificationTokenModule = await import('#models/email_verification_token')
    const EmailVerificationToken = emailVerificationTokenModule.default
    const verificationToken = await EmailVerificationToken.findByPlainToken(token)

    const success = await this.authService.verifyEmail(token)

    if (!success) {
      response.badRequest({
        error: 'InvalidToken',
        message: 'Invalid or expired verification token',
      })
      return
    }

    // Emit audit event for email verification
    if (verificationToken?.user) {
      audit.emitWithActor(
        AUDIT_EVENT_TYPES.AUTH_EMAIL_VERIFY,
        audit.createUserActor(verificationToken.user.id),
        { type: 'user', id: verificationToken.user.id }
      )
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
  async changePassword(ctx: HttpContext): Promise<void> {
    const { request, response, auth } = ctx
    const audit = new AuditContext(ctx)
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

    // Emit audit event for password change
    audit.emit(AUDIT_EVENT_TYPES.AUTH_PASSWORD_CHANGE, { type: 'user', id: user.id })

    response.ok({
      message: 'Password changed successfully',
    })
  }

  /**
   * Get login history
   * GET /api/v1/auth/login-history
   *
   * Uses ctx.authDb to query with RLS context (app.user_id is set).
   * The RLS policy allows users to see their own login history across all tenants.
   */
  async loginHistory({ response, auth, authDb }: HttpContext): Promise<void> {
    const user = auth.user!

    // Use authDb for RLS-aware query (user_id = app_current_user_id())
    // If authDb is not available (shouldn't happen with authContext middleware), fall back to service
    const history = authDb
      ? await this.authService.getLoginHistoryWithClient(user.id, authDb)
      : await this.authService.getLoginHistory(user.id)

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

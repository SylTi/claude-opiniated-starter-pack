import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import env from '#start/env'
import User from '#models/user'
import OAuthAccount from '#models/oauth_account'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import AuthService from '#services/auth_service'
import { USER_ROLES, TENANT_ROLES } from '#constants/roles'

// Supported providers (must match ally config)
type SupportedProvider = 'google' | 'github'

export default class OAuthController {
  private authService = new AuthService()
  private frontendUrl = env.get('FRONTEND_URL')

  /**
   * Redirect to OAuth provider
   * GET /api/v1/auth/oauth/:provider/redirect
   */
  async redirect({ ally, params, response }: HttpContext): Promise<void> {
    const provider = params.provider

    if (!this.isValidProvider(provider)) {
      response.badRequest({
        error: 'InvalidProvider',
        message: `Invalid OAuth provider: ${provider}`,
      })
      return
    }

    const redirectUrl = await ally.use(provider).redirectUrl()
    response.redirect(redirectUrl)
  }

  /**
   * Handle OAuth callback
   * GET /api/v1/auth/oauth/:provider/callback
   */
  async callback({ ally, params, auth, response, request }: HttpContext): Promise<void> {
    const provider = params.provider

    if (!this.isValidProvider(provider)) {
      return this.redirectWithError(response, 'Invalid OAuth provider')
    }

    const oauth = ally.use(provider)

    // Check for errors
    if (oauth.accessDenied()) {
      return this.redirectWithError(response, 'Access was denied')
    }

    if (oauth.stateMisMatch()) {
      return this.redirectWithError(response, 'Request expired. Please try again')
    }

    if (oauth.hasError()) {
      return this.redirectWithError(response, oauth.getError() || 'Authentication failed')
    }

    try {
      const oauthUser = await oauth.user()
      const { user, isNewUser } = await this.findOrCreateUser(oauthUser, provider)

      // Record login attempt
      await this.authService.recordLoginAttempt(
        user.id,
        provider,
        true,
        request.ip(),
        request.header('user-agent')
      )

      // Login the user
      await auth.use('web').login(user)

      // Redirect to frontend with success
      const redirectUrl = new URL('/auth/callback', this.frontendUrl)
      redirectUrl.searchParams.set('success', 'true')
      redirectUrl.searchParams.set('isNewUser', isNewUser.toString())
      response.redirect(redirectUrl.toString())
    } catch (error) {
      logger.error({ err: error }, 'OAuth callback error')
      return this.redirectWithError(response, 'Authentication failed')
    }
  }

  /**
   * Link OAuth account to existing user
   * GET /api/v1/auth/oauth/:provider/link
   */
  async link({ ally, params, auth, response }: HttpContext): Promise<void> {
    const provider = params.provider
    const user = auth.user!

    if (!this.isValidProvider(provider)) {
      response.badRequest({
        error: 'InvalidProvider',
        message: `Invalid OAuth provider: ${provider}`,
      })
      return
    }

    // Check if already linked
    const existingAccount = await OAuthAccount.query()
      .where('user_id', user.id)
      .where('provider', provider)
      .first()

    if (existingAccount) {
      response.badRequest({
        error: 'AlreadyLinked',
        message: `Your account is already linked to ${provider}`,
      })
      return
    }

    const redirectUrl = await ally.use(provider).redirectUrl()
    response.redirect(redirectUrl)
  }

  /**
   * Handle OAuth link callback
   * GET /api/v1/auth/oauth/:provider/link/callback
   */
  async linkCallback({ ally, params, auth, response }: HttpContext): Promise<void> {
    const provider = params.provider
    const user = auth.user!

    if (!this.isValidProvider(provider)) {
      return this.redirectWithError(response, 'Invalid OAuth provider')
    }

    const oauth = ally.use(provider)

    if (oauth.accessDenied() || oauth.stateMisMatch() || oauth.hasError()) {
      return this.redirectWithError(response, 'Failed to link account')
    }

    try {
      const oauthUser = await oauth.user()

      // Check if this OAuth account is already linked to another user
      const existingAccount = await OAuthAccount.query()
        .where('provider', provider)
        .where('provider_user_id', oauthUser.id)
        .first()

      if (existingAccount && existingAccount.userId !== user.id) {
        return this.redirectWithError(response, 'This account is already linked to another user')
      }

      // Create the link
      const expiresAt =
        'expiresAt' in oauthUser.token && oauthUser.token.expiresAt
          ? DateTime.fromJSDate(oauthUser.token.expiresAt)
          : null

      await OAuthAccount.create({
        userId: user.id,
        provider,
        providerUserId: oauthUser.id,
        email: oauthUser.email,
        name: oauthUser.name,
        avatarUrl: oauthUser.avatarUrl,
        accessToken: oauthUser.token.token,
        refreshToken: 'refreshToken' in oauthUser.token ? oauthUser.token.refreshToken : null,
        tokenExpiresAt: expiresAt,
      })

      // Redirect to frontend with success
      const redirectUrl = new URL('/profile/settings', this.frontendUrl)
      redirectUrl.searchParams.set('success', 'true')
      redirectUrl.searchParams.set('provider', provider)
      response.redirect(redirectUrl.toString())
    } catch (error) {
      logger.error({ err: error }, 'OAuth link callback error')
      return this.redirectWithError(response, 'Failed to link account')
    }
  }

  /**
   * Unlink OAuth account
   * DELETE /api/v1/auth/oauth/:provider/unlink
   */
  async unlink({ params, auth, response }: HttpContext): Promise<void> {
    const provider = params.provider
    const user = auth.user!

    if (!this.isValidProvider(provider)) {
      response.badRequest({
        error: 'InvalidProvider',
        message: `Invalid OAuth provider: ${provider}`,
      })
      return
    }

    // Check if user has a password or other OAuth accounts
    const oauthAccounts = await OAuthAccount.query().where('user_id', user.id)
    const hasPassword = user.password !== null

    if (!hasPassword && oauthAccounts.length <= 1) {
      response.badRequest({
        error: 'CannotUnlink',
        message: 'You must have at least one login method. Set a password first.',
      })
      return
    }

    await OAuthAccount.query().where('user_id', user.id).where('provider', provider).delete()

    response.ok({
      message: `${provider} account has been unlinked`,
    })
  }

  /**
   * Get linked OAuth accounts
   * GET /api/v1/auth/oauth/accounts
   */
  async accounts({ auth, response }: HttpContext): Promise<void> {
    const user = auth.user!
    const accounts = await OAuthAccount.query().where('user_id', user.id)

    response.ok({
      data: accounts.map((account) => ({
        provider: account.provider,
        email: account.email,
        name: account.name,
        avatarUrl: account.avatarUrl,
        linkedAt: account.createdAt,
      })),
    })
  }

  /**
   * Find or create user from OAuth data
   * Security: Only links accounts when email is verified by the OAuth provider
   */
  private async findOrCreateUser(
    oauthUser: {
      id: string
      email: string | null
      emailVerificationState: 'verified' | 'unverified' | 'unsupported'
      name: string | null
      avatarUrl: string | null
      token: { token: string; refreshToken?: string | null; expiresAt?: Date | null }
    },
    provider: SupportedProvider
  ): Promise<{ user: User; isNewUser: boolean }> {
    // First, check if we have an existing OAuth account
    const existingOAuth = await OAuthAccount.query()
      .where('provider', provider)
      .where('provider_user_id', oauthUser.id)
      .preload('user')
      .first()

    if (existingOAuth) {
      // Update tokens
      existingOAuth.accessToken = oauthUser.token.token
      existingOAuth.refreshToken = oauthUser.token.refreshToken || null
      existingOAuth.tokenExpiresAt = oauthUser.token.expiresAt
        ? DateTime.fromJSDate(oauthUser.token.expiresAt)
        : null
      await existingOAuth.save()

      return { user: existingOAuth.user, isNewUser: false }
    }

    // Check if a user exists with this email
    // SECURITY: Only link to existing accounts if the OAuth provider verified the email
    // This prevents account takeover via unverified OAuth emails (e.g., GitHub allows unverified emails)
    const email = oauthUser.email
    const isEmailVerified = oauthUser.emailVerificationState === 'verified'

    if (email && isEmailVerified) {
      const existingUser = await User.findBy('email', email)

      if (existingUser) {
        // Link OAuth account to existing user (safe: email is verified by provider)
        await OAuthAccount.create({
          userId: existingUser.id,
          provider,
          providerUserId: oauthUser.id,
          email: oauthUser.email,
          name: oauthUser.name,
          avatarUrl: oauthUser.avatarUrl,
          accessToken: oauthUser.token.token,
          refreshToken: oauthUser.token.refreshToken || null,
          tokenExpiresAt: oauthUser.token.expiresAt
            ? DateTime.fromJSDate(oauthUser.token.expiresAt)
            : null,
        })

        // Update avatar if not set
        if (!existingUser.avatarUrl && oauthUser.avatarUrl) {
          existingUser.avatarUrl = oauthUser.avatarUrl
          await existingUser.save()
        }

        return { user: existingUser, isNewUser: false }
      }
    }

    // Create new user with personal tenant (wrapped in transaction for consistency)
    // SECURITY: Only mark email as verified if the OAuth provider verified it
    const newUser = await db.transaction(async (trx) => {
      const user = await User.create(
        {
          email: email || `${provider}_${oauthUser.id}@oauth.local`,
          fullName: oauthUser.name,
          avatarUrl: oauthUser.avatarUrl,
          role: USER_ROLES.USER,
          emailVerified: isEmailVerified,
          password: null, // No password for OAuth-only users
          mfaEnabled: false,
        },
        { client: trx }
      )

      // Create personal tenant for the user (matching registration behavior)
      const personalTenant = await Tenant.create(
        {
          name: oauthUser.name || email?.split('@')[0] || `User ${user.id}`,
          slug: `personal-${user.id}-${Date.now()}`,
          type: 'personal',
          ownerId: user.id,
          balance: 0,
          balanceCurrency: 'usd',
        },
        { client: trx }
      )

      // Add user as owner of personal tenant
      await TenantMembership.create(
        {
          userId: user.id,
          tenantId: personalTenant.id,
          role: TENANT_ROLES.OWNER,
        },
        { client: trx }
      )

      // Set user's current tenant
      user.currentTenantId = personalTenant.id
      await user.useTransaction(trx).save()

      // Create OAuth account link
      await OAuthAccount.create(
        {
          userId: user.id,
          provider,
          providerUserId: oauthUser.id,
          email: oauthUser.email,
          name: oauthUser.name,
          avatarUrl: oauthUser.avatarUrl,
          accessToken: oauthUser.token.token,
          refreshToken: oauthUser.token.refreshToken || null,
          tokenExpiresAt: oauthUser.token.expiresAt
            ? DateTime.fromJSDate(oauthUser.token.expiresAt)
            : null,
        },
        { client: trx }
      )

      return user
    })

    return { user: newUser, isNewUser: true }
  }

  /**
   * Check if provider is valid
   */
  private isValidProvider(provider: string): provider is SupportedProvider {
    return ['google', 'github'].includes(provider)
  }

  /**
   * Redirect to frontend with error
   */
  private redirectWithError(response: HttpContext['response'], message: string): void {
    const redirectUrl = new URL('/auth/callback', this.frontendUrl)
    redirectUrl.searchParams.set('error', message)
    response.redirect(redirectUrl.toString())
  }
}

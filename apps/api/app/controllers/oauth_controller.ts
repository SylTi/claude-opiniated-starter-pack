import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import env from '#start/env'
import User from '#models/user'
import OAuthAccount from '#models/oauth_account'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import AuthService from '#services/auth_service'
import CookieSigningService from '#services/cookie_signing_service'
import { USER_ROLES, TENANT_ROLES } from '#constants/roles'
import { systemOps } from '#services/system_operation_service'
import { hookRegistry } from '@saas/plugins-core'

// Supported providers (must match ally config)
type SupportedProvider = 'google' | 'github'

// Session key for storing callback URLs keyed by OAuth state
const OAUTH_CALLBACKS_KEY = 'oauth_callbacks'

// Maximum number of pending OAuth flows to prevent session bloat
// (session store is cookie-based, so total size must stay small).
const MAX_PENDING_OAUTH_FLOWS = 3

// Maximum callback URL length to prevent session cookie bloat attacks.
const MAX_CALLBACK_URL_LENGTH = 512

export default class OAuthController {
  private authService = new AuthService()
  private cookieSigning = new CookieSigningService()
  private frontendUrl = env.get('FRONTEND_URL')

  /**
   * Redirect to OAuth provider
   * GET /api/v1/auth/oauth/:provider/redirect
   *
   * Accepts optional callbackUrl query param to redirect user after OAuth completes.
   * Uses OAuth state parameter as key to support concurrent flows (multiple tabs/windows).
   *
   * Flow:
   * 1. Generate OAuth redirect URL (includes unique state parameter)
   * 2. Extract state from redirect URL
   * 3. Store callbackUrl in session keyed by state
   * 4. On callback, state from query params looks up the correct callbackUrl
   *
   * This works because OAuth state is unique per flow and survives the redirect
   * through the OAuth provider - no cookies needed for flow identification.
   */
  async redirect({ ally, params, response, request, session }: HttpContext): Promise<void> {
    const provider = params.provider

    if (!this.isValidProvider(provider)) {
      response.badRequest({
        error: 'InvalidProvider',
        message: `Invalid OAuth provider: ${provider}`,
      })
      return
    }

    // Generate OAuth redirect URL - this creates a unique state parameter
    const oauthRedirectUrl = await ally.use(provider).redirectUrl()

    // Extract state from the redirect URL - this is our unique flow identifier
    const state = this.extractStateFromUrl(oauthRedirectUrl)

    if (state) {
      const callbackUrl = request.input('callbackUrl')
      if (callbackUrl && typeof callbackUrl === 'string') {
        // Security: Only allow relative paths to prevent open redirect
        // Also block backslash to prevent path traversal (matches frontend validation)
        // Limit length to prevent oversized session cookies (session is cookie-backed).
        if (
          callbackUrl.length <= MAX_CALLBACK_URL_LENGTH &&
          callbackUrl.startsWith('/') &&
          !callbackUrl.startsWith('//') &&
          !callbackUrl.includes('\\')
        ) {
          // Get or initialize the callbacks map in session
          const callbacks = (session.get(OAUTH_CALLBACKS_KEY) as Record<string, string>) || {}

          // Limit entries to prevent session bloat from abandoned flows
          this.limitCallbackEntries(callbacks)

          // Store callback URL keyed by OAuth state
          callbacks[state] = callbackUrl
          session.put(OAUTH_CALLBACKS_KEY, callbacks)
        }
      }
    }

    response.redirect(oauthRedirectUrl)
  }

  /**
   * Extract state parameter from OAuth redirect URL.
   */
  private extractStateFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url)
      return parsed.searchParams.get('state')
    } catch {
      return null
    }
  }

  /**
   * Limit callback entries to prevent session bloat from abandoned OAuth flows.
   * Removes oldest entries (FIFO) when limit is exceeded.
   */
  private limitCallbackEntries(callbacks: Record<string, string>): void {
    const keys = Object.keys(callbacks)
    if (keys.length >= MAX_PENDING_OAUTH_FLOWS) {
      // Remove oldest entries (first in object iteration order)
      const toRemove = keys.slice(0, keys.length - MAX_PENDING_OAUTH_FLOWS + 1)
      for (const key of toRemove) {
        delete callbacks[key]
      }
    }
  }

  /**
   * Retrieve callback URL using OAuth state as key (without consuming).
   * Used to peek at the callback URL before OAuth validation completes.
   *
   * @param state - OAuth state parameter from callback
   * @param session - HTTP session
   * @returns The callback URL if found, undefined otherwise
   */
  private getCallbackUrl(
    state: string | null,
    session: HttpContext['session']
  ): string | undefined {
    if (!state) {
      return undefined
    }

    const callbacks = (session.get(OAUTH_CALLBACKS_KEY) as Record<string, string>) || {}
    return callbacks[state]
  }

  /**
   * Consume (remove) callback URL entry from session.
   * Called only after OAuth validation succeeds to prevent losing the entry on failures.
   *
   * @param state - OAuth state parameter from callback
   * @param session - HTTP session
   */
  private consumeCallbackUrl(state: string | null, session: HttpContext['session']): void {
    if (!state) {
      return
    }

    const callbacks = (session.get(OAUTH_CALLBACKS_KEY) as Record<string, string>) || {}
    if (callbacks[state]) {
      delete callbacks[state]
      session.put(OAUTH_CALLBACKS_KEY, callbacks)
    }
  }

  /**
   * Handle OAuth callback
   * GET /api/v1/auth/oauth/:provider/callback
   *
   * Uses OAuth state from query params to look up the correct callbackUrl.
   *
   * LIMITATION: Concurrent OAuth flows for the SAME provider are not fully supported.
   * Ally uses a single state cookie per provider (e.g., google_oauth_state), so
   * starting OAuth in tab B overwrites tab A's state. Tab A will fail with
   * stateMisMatch() error. Different providers can run concurrently.
   *
   * The callbackUrl mapping by state ensures that when a flow succeeds, it gets
   * the correct callback URL for that specific flow.
   */
  async callback({ ally, params, auth, response, request, session }: HttpContext): Promise<void> {
    const provider = params.provider

    // Get OAuth state from query params
    const state = request.input('state') as string | null

    if (!this.isValidProvider(provider)) {
      return this.redirectWithError(response, 'Invalid OAuth provider')
    }

    const oauth = ally.use(provider)

    // Check for errors - don't consume callbackUrl yet so retry can preserve it
    if (oauth.accessDenied()) {
      return this.redirectWithError(response, 'Access was denied')
    }

    if (oauth.stateMisMatch()) {
      // This happens when: (1) session expired, (2) user started OAuth in another tab
      // for the same provider (overwrites state cookie), or (3) potential CSRF attack.
      // Guide user to retry from a single tab.
      // Note: callbackUrl is preserved in session for retry attempts
      return this.redirectWithError(
        response,
        'Session expired or interrupted. Please close other login tabs and try again.'
      )
    }

    if (oauth.hasError()) {
      return this.redirectWithError(response, oauth.getError() || 'Authentication failed')
    }

    // Retrieve callbackUrl (but don't consume yet - wait for oauth.user() to succeed)
    const callbackUrl = this.getCallbackUrl(state, session)

    try {
      const oauthUser = await oauth.user()
      const { user, isNewUser } = await this.findOrCreateUser(oauthUser, provider)

      // OAuth flow fully succeeded - now safe to consume the callbackUrl
      this.consumeCallbackUrl(state, session)

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

      // Emit plugin hooks
      hookRegistry
        .doAction('auth:logged_in', {
          userId: user.id,
          method: provider,
          tenantId: user.currentTenantId,
        })
        .catch(() => {})

      if (isNewUser) {
        hookRegistry
          .doAction('auth:registered', {
            userId: user.id,
            email: user.email,
            tenantId: user.currentTenantId,
          })
          .catch(() => {})
      }

      // Redirect to frontend with success (callbackUrl already retrieved at start of method)
      const redirectUrl = new URL('/auth/callback', this.frontendUrl)
      redirectUrl.searchParams.set('success', 'true')
      redirectUrl.searchParams.set('isNewUser', isNewUser.toString())
      if (callbackUrl) {
        redirectUrl.searchParams.set('callbackUrl', callbackUrl)
      }
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

    // Find and delete via instance method to ensure RLS hooks apply
    const accountToUnlink = await OAuthAccount.query()
      .where('user_id', user.id)
      .where('provider', provider)
      .first()

    if (accountToUnlink) {
      await accountToUnlink.delete()
    }

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
   *
   * Uses system RLS context for tenant/membership creation since this is a
   * public OAuth callback without authenticated user context.
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
    // First, check if we have an existing OAuth account (oauth_accounts has no RLS)
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

    // Check if a user exists with this email (users table has no RLS)
    // SECURITY: Only link to existing accounts if the OAuth provider verified the email
    // This prevents account takeover via unverified OAuth emails (e.g., GitHub allows unverified emails)
    const email = oauthUser.email
    const isEmailVerified = oauthUser.emailVerificationState === 'verified'

    if (email && isEmailVerified) {
      const existingUser = await User.findBy('email', email)

      if (existingUser) {
        // Link OAuth account to existing user (safe: email is verified by provider)
        // oauth_accounts has no RLS
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

    // Create new user with personal tenant using system context
    // SECURITY: Only mark email as verified if the OAuth provider verified it
    // Uses system context because tenants and tenant_memberships have RLS
    const newUser = await systemOps.withSystemContext(async (trx) => {
      // Create user (users table has no RLS)
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

      // Create personal tenant for the user (tenants has RLS - system context allows this)
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

      // Add user as owner of personal tenant (tenant_memberships has RLS)
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

      // Create OAuth account link (oauth_accounts has no RLS)
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

      // Emit plugin hook for personal tenant creation (inside transaction closure for access to personalTenant)
      hookRegistry
        .doAction('team:created', {
          tenantId: user.currentTenantId!,
          ownerId: user.id,
          type: 'personal',
        })
        .catch(() => {})

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

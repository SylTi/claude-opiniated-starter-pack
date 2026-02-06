/**
 * Server-side Authentication Utilities
 *
 * These functions are for use in Server Components and Server Actions only.
 * They make direct API calls to verify user state from the database.
 *
 * ## Security Policy
 *
 * ### API URL Configuration
 * - PRODUCTION: Requires explicit `API_URL` env var (server-only, not NEXT_PUBLIC_)
 * - DEVELOPMENT: Falls back to localhost:3333 if no API_URL is set
 * - The URL is strictly validated against TRUSTED_API_ORIGINS
 * - In production, untrusted origins cause a hard failure unless
 *   TRUST_UNLISTED_API_ORIGINS=true is explicitly set (operator override)
 *
 * ### Cookie Forwarding
 * - Only AUTH_COOKIE_NAMES are forwarded to the API (not all cookies)
 * - This prevents accidental leakage of unrelated cookies (analytics, etc.)
 * - The API URL must match TRUSTED_API_ORIGINS, or TRUST_UNLISTED_API_ORIGINS=true must be set
 *
 * ### Timeout Policy
 * - Auth verification has a 5-second timeout to prevent request hangs
 * - On timeout, returns null (unauthenticated) to fail safely
 */

import { cookies } from 'next/headers'

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Session cookie name from environment.
 * Defaults to 'adonis-session' to match AdonisJS backend config.
 * Set AUTH_SESSION_COOKIE_NAME env var to override if backend config changes.
 */
const SESSION_COOKIE_NAME = process.env.AUTH_SESSION_COOKIE_NAME ?? 'adonis-session'

/**
 * Cookie names that are always forwarded to the API.
 * SECURITY: Only auth-related cookies should be forwarded.
 *
 * The session cookie name is configurable via AUTH_SESSION_COOKIE_NAME env var.
 */
const AUTH_COOKIE_NAMES = new Set([
  SESSION_COOKIE_NAME, // Primary session cookie (from env or default 'adonis-session')
  'session',           // Generic session cookie
  'user-info',         // Signed user info cookie
  '__session',         // Alternative session cookie name
  'auth_token',        // JWT token cookie (if used)
  'refresh_token',     // Refresh token cookie (if used)
])

/**
 * Check if a cookie name looks like an AdonisJS session data cookie.
 * AdonisJS stores session data in a cookie named with the session ID
 * (alphanumeric string, typically 20+ characters).
 */
function isSessionDataCookie(name: string): boolean {
  // Session IDs are alphanumeric, typically 20-40 characters
  // Exclude known non-session cookies
  const knownNonSession = new Set([
    'notarium-theme',
    'tenant_id',
    '__next_hmr_refresh_hash__',
    'XSRF-TOKEN',
  ])
  if (knownNonSession.has(name)) {
    return false
  }
  // Match alphanumeric strings of 15+ characters (session IDs)
  return /^[a-z0-9]{15,}$/i.test(name)
}

/**
 * Trusted API origins for cookie forwarding.
 * SECURITY: Cookies will only be sent to these exact origins unless
 * TRUST_UNLISTED_API_ORIGINS=true is explicitly set.
 *
 * In production:
 * - If API_URL is not in this list AND TRUST_UNLISTED_API_ORIGINS is not set, throws an error.
 * - If TRUST_UNLISTED_API_ORIGINS=true, logs a warning but allows the request (operator trust).
 */
const TRUSTED_API_ORIGINS = new Set([
  'http://localhost:3333',
  'http://127.0.0.1:3333',
  // Add production origins here, e.g.:
  // 'https://api.yourdomain.com',
  // 'https://backend.yourdomain.com',
])

/**
 * Timeout for auth verification requests in milliseconds.
 */
const AUTH_FETCH_TIMEOUT_MS = 5000

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Check if a URL is a trusted API origin.
 */
function isTrustedOrigin(url: string): boolean {
  try {
    const parsed = new URL(url)
    const origin = `${parsed.protocol}//${parsed.host}`
    return TRUSTED_API_ORIGINS.has(origin)
  } catch {
    return false
  }
}

/**
 * Get the API base URL for server-side requests.
 *
 * SECURITY:
 * - Production REQUIRES explicit API_URL env var (hard failure if missing)
 * - Development allows localhost fallback
 * - URL must be in TRUSTED_API_ORIGINS, or TRUST_UNLISTED_API_ORIGINS=true
 *   must be set to allow untrusted origins (production only)
 *
 * @throws Error if API_URL is missing in production or origin is untrusted
 *         without explicit TRUST_UNLISTED_API_ORIGINS=true override
 */
function getApiBaseUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production'

  // In production, API_URL is REQUIRED (no fallback to localhost)
  if (isProduction) {
    const apiUrl = process.env.API_URL

    if (!apiUrl) {
      console.error('[auth] FATAL: API_URL env var is required in production')
      throw new Error('API_URL environment variable is required in production')
    }

    // Validate URL format
    try {
      new URL(apiUrl)
    } catch {
      console.error('[auth] FATAL: API_URL is not a valid URL:', apiUrl)
      throw new Error('API_URL is not a valid URL')
    }

    // Strict origin enforcement in production
    // SECURITY: Prevents accidental cookie leakage to untrusted origins
    if (!isTrustedOrigin(apiUrl)) {
      const trustUnlisted = process.env.TRUST_UNLISTED_API_ORIGINS === 'true'

      if (!trustUnlisted) {
        console.error(
          `[auth] FATAL: API_URL "${apiUrl}" is not in TRUSTED_API_ORIGINS. ` +
          'Add this origin to TRUSTED_API_ORIGINS or set TRUST_UNLISTED_API_ORIGINS=true to bypass.'
        )
        throw new Error(
          `API_URL origin is not trusted. Add to TRUSTED_API_ORIGINS or set TRUST_UNLISTED_API_ORIGINS=true.`
        )
      }

      // Explicit opt-in to untrusted origin - warn but allow
      console.warn(
        `[auth] API_URL "${apiUrl}" is not in TRUSTED_API_ORIGINS. ` +
        'Proceeding because TRUST_UNLISTED_API_ORIGINS=true. Ensure this origin is trusted.'
      )
    }

    return apiUrl
  }

  // Development: prefer API_URL, fall back to localhost
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'

  // Validate URL format
  try {
    new URL(url)
  } catch {
    console.error('[auth] Invalid API URL:', url)
    throw new Error('Invalid API URL configuration')
  }

  return url
}

// Initialize at module load - will throw if misconfigured
const API_BASE_URL = getApiBaseUrl()

// ============================================================================
// Cookie Handling
// ============================================================================

/**
 * Build a cookie header string containing only auth-related cookies.
 *
 * SECURITY: Only forwards cookies in AUTH_COOKIE_NAMES plus AdonisJS
 * session data cookies to prevent leaking unrelated cookies.
 *
 * @param allCookies - All cookies from the request
 * @returns Cookie header string or null if no auth cookies present
 */
function buildAuthCookieHeader(
  allCookies: Array<{ name: string; value: string }>
): string | null {
  const authCookies = allCookies.filter((c) =>
    AUTH_COOKIE_NAMES.has(c.name) || isSessionDataCookie(c.name)
  )

  if (authCookies.length === 0) {
    return null
  }

  return authCookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

// ============================================================================
// Types
// ============================================================================

/**
 * Subscription tier data for nav context
 */
interface SubscriptionTierInfo {
  level: number
}

/**
 * User data returned from the API auth/me endpoint.
 * Extended to support server-side nav context building.
 */
export interface ServerUser {
  id: number
  email: string
  fullName: string | null
  role: 'admin' | 'user' | 'guest'
  emailVerified: boolean
  mfaEnabled: boolean
  avatarUrl: string | null
  // Nav context fields
  currentTenantId: number | null
  effectiveSubscriptionTier?: SubscriptionTierInfo
  // Future: entitlements, abilities from API
}

/**
 * Valid roles for runtime validation.
 */
const VALID_ROLES = new Set(['admin', 'user', 'guest'])

/**
 * Validate and parse API response data as ServerUser.
 * SECURITY: Runtime validation prevents trusting malformed API responses.
 *
 * @param data - Raw data from API response
 * @returns Validated ServerUser or null if validation fails
 */
function validateServerUser(data: unknown): ServerUser | null {
  if (!data || typeof data !== 'object') {
    console.error('[validateServerUser] Invalid data: not an object')
    return null
  }

  const user = data as Record<string, unknown>

  // Required fields validation
  if (typeof user.id !== 'number') {
    console.error('[validateServerUser] Invalid id: not a number')
    return null
  }

  if (typeof user.email !== 'string' || !user.email.includes('@')) {
    console.error('[validateServerUser] Invalid email')
    return null
  }

  if (typeof user.role !== 'string' || !VALID_ROLES.has(user.role)) {
    console.error('[validateServerUser] Invalid role:', user.role)
    return null
  }

  // Build validated user object with type coercion for optional fields
  const validatedUser: ServerUser = {
    id: user.id,
    email: user.email,
    fullName: typeof user.fullName === 'string' ? user.fullName : null,
    role: user.role as 'admin' | 'user' | 'guest',
    emailVerified: Boolean(user.emailVerified),
    mfaEnabled: Boolean(user.mfaEnabled),
    avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : null,
    currentTenantId: typeof user.currentTenantId === 'number' ? user.currentTenantId : null,
  }

  // Optional: effectiveSubscriptionTier
  if (user.effectiveSubscriptionTier && typeof user.effectiveSubscriptionTier === 'object') {
    const tier = user.effectiveSubscriptionTier as Record<string, unknown>
    if (typeof tier.level === 'number') {
      validatedUser.effectiveSubscriptionTier = { level: tier.level }
    }
  }

  return validatedUser
}

// ============================================================================
// Auth Verification
// ============================================================================

/**
 * Verify user's current role from the database.
 *
 * This function makes a server-side call to the API to get the user's
 * current role directly from the database, bypassing any cached cookie claims.
 *
 * Use this for sensitive operations where stale role data is unacceptable.
 *
 * SECURITY:
 * - Only auth cookies are forwarded (not all cookies)
 * - Request has a timeout to prevent hangs
 * - Returns null on any error (fail-closed)
 *
 * @returns The user data with their current role, or null if not authenticated
 */
export async function verifyUserFromApi(): Promise<ServerUser | null> {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  // Build cookie header with only auth cookies
  const cookieHeader = buildAuthCookieHeader(allCookies)

  if (!cookieHeader) {
    return null
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
      // Don't cache this request - we need fresh data
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    // SECURITY: Validate API response shape before using in authz decisions
    // Don't trust API JSON with a direct cast - validate at runtime
    return validateServerUser(data.data)
  } catch (error) {
    clearTimeout(timeoutId)

    // Distinguish timeout from other errors for logging
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[verifyUserFromApi] Request timed out after', AUTH_FETCH_TIMEOUT_MS, 'ms')
    } else {
      console.error('[verifyUserFromApi] Failed to verify user:', error)
    }

    return null
  }
}

// ============================================================================
// Nav Context Building
// ============================================================================

/**
 * Build navigation context from verified server user.
 *
 * SECURITY: This function builds the auth context server-side from verified
 * API data. Do NOT use client-supplied auth context for permission filtering.
 *
 * @param user - Verified user from verifyUserFromApi()
 * @returns Navigation context for permission filtering
 */
export function buildNavContextFromUser(user: ServerUser): {
  tenantId: string | null
  userId: string
  entitlements: Set<string>
  userRole: 'user' | 'admin' | 'guest'
  tierLevel: number
  hasMultipleTenants: boolean
} {
  // Build entitlements from role
  const entitlements = new Set<string>()
  if (user.role === 'admin') {
    entitlements.add('admin')
  }

  return {
    tenantId: user.currentTenantId ? String(user.currentTenantId) : null,
    userId: String(user.id),
    entitlements,
    userRole: user.role,
    tierLevel: user.effectiveSubscriptionTier?.level ?? 0,
    // TODO: hasMultipleTenants should come from API
    // For now, default to false - safer than assuming
    hasMultipleTenants: false,
  }
}

'use server'

/**
 * Server-side Navigation Actions
 *
 * Provides server-side navigation building with centralized permission filtering.
 *
 * Per spec §6.1:
 * - Permission filtering is centralized and server-side
 * - The skeleton applies final filtering based on entitlements
 *
 * Per spec §5.3:
 * - Collision detection is boot-fatal
 * - Collisions after filters must fail boot
 *
 * Build order (per spec §8.2):
 * baseline → filters → mandatory → sort → collision check → permission filter
 *
 * ARCHITECTURE: API is Single Source of Truth for Navigation
 * ----------------------------------------------------------
 * The API backend (`GET /api/v1/navigation/model`) is the single source of truth
 * for navigation composition. This ensures:
 * 1. Hooks registered in the API runtime (PluginBootService) are properly applied
 * 2. Full pipeline validation (including post-hook collision detection) happens
 * 3. No split-brain between API and web runtimes
 *
 * The web fetches composed navigation from the API. Local fallback is only used
 * when the API call fails (for resilience, not for normal operation).
 */

import type { NavModel, NavContext } from '@saas/plugins-core'
import {
  designRegistry,
  buildNavModel,
  applyPermissionFilter,
  applySorting,
  ensureMandatoryItems,
  assertNoIdCollisions,
} from '@saas/plugins-core'
import { loadMainAppDesign } from '@saas/config/main-app'
import { createDefaultNavModel } from './build-nav-model'
import { verifyUserFromApi, buildNavContextFromUser } from '@/lib/server/auth'
import { cookies } from 'next/headers'

/**
 * DEPRECATED: Client-supplied context is no longer trusted for auth fields.
 * Kept for backwards compatibility during transition.
 *
 * Auth-sensitive fields (entitlements, abilities, userRole) are now
 * verified server-side via verifyUserFromApi().
 */
export interface SerializableNavContext {
  // NON-AUTH fields that can still come from client (UI preferences only)
  tenantId?: string | null  // Used for UI hints only, re-verified server-side
  tenantPlanId?: string     // Used for UI hints only

  // DEPRECATED: Auth fields below are ignored - verified server-side instead
  userId?: string
  entitlements?: string[]
  userRole?: 'user' | 'admin' | 'guest' | null
  isTenantAdmin?: boolean
  hasMultipleTenants?: boolean
  abilities?: Record<string, boolean>
  tierLevel?: number
}

/**
 * Build NavContext from server-verified user data.
 *
 * SECURITY: Auth-sensitive fields come from API verification, not client.
 * Client-supplied values are only used for non-auth UI hints.
 */
function buildVerifiedNavContext(
  verifiedContext: ReturnType<typeof buildNavContextFromUser>,
  clientHints?: SerializableNavContext
): NavContext {
  return {
    ...verifiedContext,
    // Allow client to provide planId hint (non-auth, for UI purposes)
    tenantPlanId: clientHints?.tenantPlanId,
    // Use verified data for all auth-sensitive fields
    entitlements: verifiedContext.entitlements,
    abilities: undefined, // TODO: Pre-compute abilities server-side if needed
  }
}

/**
 * Server navigation build result.
 */
export interface ServerNavResult {
  /** Navigation model (permission-filtered) */
  nav: NavModel
  /** Design ID if available */
  designId: string | null
  /** Whether running in safe mode */
  isSafeMode: boolean
}

/**
 * Check if running in safe mode.
 * Uses server-only environment variable (not NEXT_PUBLIC_).
 */
function isSafeMode(): boolean {
  return process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true'
}

/**
 * Ensure design is registered in the server runtime.
 * Lazily registers the main-app design if not already registered.
 */
async function ensureDesignRegistered(): Promise<void> {
  if (!designRegistry.has()) {
    const design = await loadMainAppDesign()
    if (!designRegistry.has()) {
      designRegistry.register(design)
    }
  }
}

/**
 * Trusted API origins for cookie forwarding.
 * SECURITY: Cookies will only be sent to these exact origins unless
 * TRUST_UNLISTED_API_ORIGINS=true is explicitly set.
 */
const TRUSTED_API_ORIGINS = new Set([
  'http://localhost:3333',
  'http://127.0.0.1:3333',
  // Add production origins here
])

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
 * Validate URL format.
 * @throws Error if URL is malformed
 */
function validateUrlFormat(url: string, source: string): void {
  try {
    new URL(url)
  } catch {
    throw new Error(`${source} is not a valid URL: ${url}`)
  }
}

/**
 * Get the API base URL for server-side requests.
 *
 * SECURITY:
 * - Production REQUIRES explicit API_URL env var
 * - URL format is validated to prevent malformed URLs
 * - URL must be in TRUSTED_API_ORIGINS, or TRUST_UNLISTED_API_ORIGINS=true
 */
function getApiBaseUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    const apiUrl = process.env.API_URL
    if (!apiUrl) {
      throw new Error('API_URL environment variable is required in production')
    }

    // Validate URL format
    validateUrlFormat(apiUrl, 'API_URL')

    // Strict origin enforcement in production
    if (!isTrustedOrigin(apiUrl)) {
      const trustUnlisted = process.env.TRUST_UNLISTED_API_ORIGINS === 'true'
      if (!trustUnlisted) {
        console.error(
          `[nav] FATAL: API_URL "${apiUrl}" is not in TRUSTED_API_ORIGINS. ` +
            'Add this origin to TRUSTED_API_ORIGINS or set TRUST_UNLISTED_API_ORIGINS=true.'
        )
        throw new Error('API_URL origin is not trusted')
      }
      console.warn(`[nav] API_URL "${apiUrl}" is not in TRUSTED_API_ORIGINS but allowed via override`)
    }

    return apiUrl
  }

  // Development: prefer API_URL, fall back to localhost
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'
  validateUrlFormat(url, 'API URL')
  return url
}

/**
 * Timeout for API fetch in milliseconds.
 */
const NAV_FETCH_TIMEOUT_MS = 5000

/**
 * Cookie names that are always forwarded to the API.
 */
const AUTH_COOKIE_NAMES = new Set([
  process.env.AUTH_SESSION_COOKIE_NAME ?? 'adonis-session',
  'session',
  'user-info',
  '__session',
  'auth_token',
  'refresh_token',
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
    'saas-theme',
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
 * Build auth cookie header from request cookies.
 * Includes named auth cookies and AdonisJS session data cookies.
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

/**
 * Result type for API fetch with detailed status.
 */
type FetchNavResult =
  | { status: 'success'; data: ServerNavResult }
  | { status: 'unauthenticated' }
  | { status: 'api_error'; code?: number }

/**
 * Fetch navigation model from the API.
 *
 * The API is the single source of truth for navigation composition.
 * It runs the full pipeline including hooks registered in the API runtime.
 *
 * @returns Detailed result indicating success, unauthenticated, or API error
 */
async function fetchNavFromApi(): Promise<FetchNavResult> {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const cookieHeader = buildAuthCookieHeader(allCookies)

  if (!cookieHeader) {
    return { status: 'unauthenticated' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), NAV_FETCH_TIMEOUT_MS)

  try {
    const apiUrl = getApiBaseUrl()
    const response = await fetch(`${apiUrl}/api/v1/navigation/model`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.status === 401 || response.status === 403) {
      // User not authenticated or session expired
      return { status: 'unauthenticated' }
    }

    if (!response.ok) {
      console.warn(`[nav:api] API returned ${response.status}`)
      return { status: 'api_error', code: response.status }
    }

    const json = await response.json()
    const data = json.data as ServerNavResult | undefined

    if (!data || !data.nav) {
      console.warn('[nav:api] Invalid response structure')
      return { status: 'api_error' }
    }

    return { status: 'success', data }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[nav:api] Request timed out')
    } else {
      console.warn('[nav:api] Fetch failed:', error instanceof Error ? error.message : error)
    }

    return { status: 'api_error' }
  }
}

/**
 * Build navigation server-side with centralized permission filtering.
 *
 * ARCHITECTURE: API is Single Source of Truth
 * -------------------------------------------
 * This function first tries to fetch navigation from the API endpoint
 * (`GET /api/v1/navigation/model`), which is the single source of truth.
 * The API runs the full pipeline including hooks registered by plugins.
 *
 * Local fallback is only used when the API call fails (for resilience).
 * The fallback skips hooks (they're not available in Next.js runtime).
 *
 * SECURITY: Auth context is verified server-side via API.
 * Client-supplied auth fields are IGNORED to prevent privilege escalation.
 *
 * @param clientHints - Optional client hints for UI preferences (auth fields ignored)
 * @returns Server navigation result with permission-filtered nav
 * @throws Error if collision detected (boot-fatal per spec §5.3)
 * @throws Error if user not authenticated
 */
export async function buildNavigationServerSide(
  clientHints?: SerializableNavContext
): Promise<ServerNavResult> {
  const safeMode = isSafeMode()

  // Safe mode: use simple local build (no hooks, no API)
  if (safeMode) {
    const verifiedUser = await verifyUserFromApi()
    if (!verifiedUser) {
      throw new Error('User not authenticated')
    }

    const verifiedContext = buildNavContextFromUser(verifiedUser)
    const context = buildVerifiedNavContext(verifiedContext, clientHints)

    const defaultNav = createDefaultNavModel(context)
    const withMandatory = ensureMandatoryItems(defaultNav, context)
    const sorted = applySorting(withMandatory)
    assertNoIdCollisions(sorted)
    const filtered = applyPermissionFilter(sorted, context.entitlements, context.abilities)

    return {
      nav: filtered,
      designId: null,
      isSafeMode: true,
    }
  }

  // PRIMARY: Fetch from API (single source of truth with full hook pipeline)
  // Per spec §8.2, the full pipeline (baseline → filters → ...) MUST run.
  // The API is the only runtime where hooks are registered.
  const apiResult = await fetchNavFromApi()

  if (apiResult.status === 'success') {
    return apiResult.data
  }

  // Handle unauthenticated users - return guest navigation
  if (apiResult.status === 'unauthenticated') {
    await ensureDesignRegistered()
    const design = designRegistry.get()

    // Build guest context with minimal permissions
    const guestContext: NavContext = {
      userId: undefined,
      tenantId: null,
      entitlements: new Set<string>(),
      userRole: 'guest',
      isTenantAdmin: false,
      hasMultipleTenants: false,
      tenantPlanId: clientHints?.tenantPlanId,
      tierLevel: 0,
    }

    // Build navigation using design's contribution (if available)
    const baseNav = design
      ? await buildNavModel({ design, context: guestContext, skipHooks: true })
      : createDefaultNavModel(guestContext)
    const withMandatory = ensureMandatoryItems(baseNav, guestContext)
    const sorted = applySorting(withMandatory)
    assertNoIdCollisions(sorted)
    // Apply permission filter - guest has no entitlements, so most items will be filtered
    const filtered = applyPermissionFilter(sorted, guestContext.entitlements, guestContext.abilities)

    return {
      nav: filtered,
      designId: design?.designId ?? null,
      isSafeMode: false,
    }
  }

  // API unavailable - per spec, we cannot skip the hooks stage for authenticated users
  // Throwing here ensures we don't violate the required pipeline order
  console.error('[nav] API unavailable - cannot build navigation without hook pipeline')
  throw new Error(
    'Navigation service unavailable. The API must be running for navigation to work correctly.'
  )
}

/**
 * Validate navigation for collisions.
 *
 * Per spec §5.3: Collision detection is boot-fatal.
 * This function is provided for edge cases where additional validation
 * is needed, but primary collision detection happens in buildNavigationServerSide.
 *
 * @param nav - Navigation model to validate
 * @throws Error if collision detected
 */
export async function validateNavigationCollisions(nav: NavModel): Promise<void> {
  assertNoIdCollisions(nav)
}

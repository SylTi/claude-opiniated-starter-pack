/**
 * Plugin Apps Layout
 *
 * Layout for plugin UIs hosted at /apps/[pluginId].
 * Ensures authentication and authorization before rendering plugin UI.
 *
 * SECURITY: Role verification uses server-side API call to ensure fresh role data.
 * This prevents stale-role authorization where a downgraded user retains access.
 */

import { type ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect, notFound, forbidden } from 'next/navigation'
import { verifyUserFromApi } from '@/lib/server/auth'
import { loadClientPluginManifest } from '@saas/config/plugins/client'
import type { PluginManifest, PluginRequiredRole } from '@saas/plugins-core'

interface PluginLayoutProps {
  children: ReactNode
  params: Promise<{
    pluginId: string
  }>
}

/**
 * Role hierarchy for access control.
 * Higher index = more privileged.
 */
const ROLE_HIERARCHY: Record<PluginRequiredRole, number> = {
  guest: 0,
  user: 1,
  admin: 2,
}

/**
 * Valid roles that can be in the user cookie.
 */
const VALID_USER_ROLES = new Set<string>(['admin', 'user', 'guest'])


/**
 * Check if a role string is valid.
 */
function isValidRole(role: string): boolean {
  return VALID_USER_ROLES.has(role)
}

/**
 * Check if user has access to a plugin based on its accessControl config.
 * Returns false for unknown roles regardless of plugin config.
 */
function hasPluginAccess(manifest: PluginManifest, userRole: string): boolean {
  // Reject unknown roles globally before policy evaluation
  if (!isValidRole(userRole)) {
    console.warn(`[PluginLayout] Unknown user role "${userRole}" - denying access`)
    return false
  }

  const requiredRole = manifest.accessControl?.requiredRole
  if (!requiredRole) {
    // No access control = any valid authenticated user
    return true
  }

  return ROLE_HIERARCHY[userRole as PluginRequiredRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Get the full request path from headers for callback URL preservation.
 *
 * Next.js App Router layouts don't have direct access to the current URL path.
 * This function extracts it from available headers with multiple fallback strategies:
 *
 * 1. x-url / x-middleware-request-url: Set by Next.js middleware (most reliable)
 * 2. x-invoke-path: Internal Next.js header for server actions
 * 3. next-url: Set by Next.js in some RSC contexts
 * 4. x-forwarded-url: Common proxy header (e.g., Vercel, Cloudflare)
 * 5. referer: Works for same-origin navigation (not direct hits)
 * 6. Fallback: Base plugin path `/apps/{pluginId}`
 *
 * For guaranteed deep link preservation, add middleware that sets x-pathname.
 */
async function getCallbackUrl(pluginId: string): Promise<string> {
  const fallbackUrl = `/apps/${pluginId}`
  const expectedPrefix = `/apps/${pluginId}`

  /**
   * Check if a path matches the expected plugin path.
   * SECURITY: Uses exact-or-subpath boundary check to prevent
   * `/apps/notes-malicious` from matching pluginId=notes.
   *
   * Valid matches:
   * - `/apps/notes` (exact match)
   * - `/apps/notes/` (with trailing slash)
   * - `/apps/notes/123/edit` (subpath)
   *
   * Invalid matches:
   * - `/apps/notes-malicious` (different plugin)
   * - `/apps/notebook` (different plugin)
   */
  const isValidPluginPath = (path: string): boolean => {
    return path === expectedPrefix || path.startsWith(expectedPrefix + '/')
  }

  /**
   * Extract pathname from a full URL string.
   * Returns null if URL is invalid or doesn't match expected plugin path.
   */
  const extractPathname = (urlString: string): string | null => {
    try {
      // Handle both full URLs and path-only values
      const url = urlString.startsWith('http')
        ? new URL(urlString)
        : new URL(urlString, 'http://localhost')
      if (isValidPluginPath(url.pathname)) {
        // Include search params if present for full callback preservation
        return url.search ? `${url.pathname}${url.search}` : url.pathname
      }
    } catch {
      // Invalid URL format
    }
    return null
  }

  try {
    const headerStore = await headers()

    // Priority 1: Full URL headers (most reliable for direct hits)
    const fullUrlHeaders = ['x-url', 'x-middleware-request-url', 'x-forwarded-url']
    for (const headerName of fullUrlHeaders) {
      const value = headerStore.get(headerName)
      if (value) {
        const pathname = extractPathname(value)
        if (pathname) return pathname
      }
    }

    // Priority 2: Path-only headers (may include query strings like /apps/notes?tab=general)
    const pathHeaders = ['x-invoke-path', 'next-url', 'x-pathname']
    for (const headerName of pathHeaders) {
      const value = headerStore.get(headerName)
      if (value) {
        // Parse out query string for validation, but preserve it in result
        const queryIndex = value.indexOf('?')
        const pathPart = queryIndex >= 0 ? value.slice(0, queryIndex) : value
        if (isValidPluginPath(pathPart)) {
          return value // Return full value including query string
        }
      }
    }

    // Priority 3: Referer header (works for navigation, not direct hits)
    const referer = headerStore.get('referer')
    if (referer) {
      const pathname = extractPathname(referer)
      if (pathname) return pathname
    }
  } catch {
    // Headers unavailable, use fallback
  }

  return fallbackUrl
}

/**
 * Plugin layout component.
 * Wraps plugin UIs with authentication and authorization checks.
 *
 * SECURITY: Uses API verification as the authoritative check.
 * The user-info cookie is only used as a fast-path hint for FOUC prevention.
 * If user-info cookie is missing but session cookie is valid, the API check
 * will still work.
 */
export default async function PluginLayout({
  children,
  params,
}: PluginLayoutProps): Promise<React.ReactElement> {
  const { pluginId } = await params

  // Build callback URL - attempts to preserve full nested path via headers
  const callbackUrl = await getCallbackUrl(pluginId)

  // Verify plugin exists first (before auth checks)
  const manifest = await loadClientPluginManifest(pluginId)
  if (!manifest) {
    notFound()
  }

  // main-app is not accessible via /apps route - it's the core design
  if (manifest.tier === 'main-app') {
    notFound()
  }

  // Authorization: Verify user's current role from the database
  // This is the authoritative check - works even if user-info cookie is missing
  // as long as session cookie is valid. This prevents stale-role attacks.
  const currentUser = await verifyUserFromApi()

  if (!currentUser) {
    // No valid session - redirect to login
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  // Check if user meets plugin's access requirements using fresh role from DB
  if (!hasPluginAccess(manifest, currentUser.role)) {
    // Return 403 Forbidden - renders forbidden.tsx
    forbidden()
  }

  return <>{children}</>
}

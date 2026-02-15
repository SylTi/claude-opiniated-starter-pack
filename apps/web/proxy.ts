import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_FETCH_TIMEOUT_MS = 3000

const TRUSTED_API_ORIGINS = new Set([
  'http://localhost:3333',
  'http://127.0.0.1:3333',
  // Add production origins here, e.g.:
  // 'https://api.yourdomain.com',
])

const AUTH_COOKIE_NAMES = new Set([
  process.env.AUTH_SESSION_COOKIE_NAME ?? 'adonis-session',
  'session',
  'user-info',
  '__session',
  'auth_token',
  'refresh_token',
])

/**
 * Public routes that don't require authentication
 */
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/tenant/invite',
]

/**
 * Routes that require admin role
 */
const adminRoutes = ['/admin']

type UserRole = 'admin' | 'user' | 'guest'

function isSessionDataCookie(name: string): boolean {
  const knownNonSession = new Set(['theme', 'tenant_id', '__next_hmr_refresh_hash__', 'XSRF-TOKEN'])
  if (knownNonSession.has(name)) {
    return false
  }
  return /^[a-z0-9]{15,}$/i.test(name)
}

function isTrustedOrigin(url: string): boolean {
  try {
    const parsed = new URL(url)
    const origin = `${parsed.protocol}//${parsed.host}`
    return TRUSTED_API_ORIGINS.has(origin)
  } catch {
    return false
  }
}

function getApiBaseUrl(): string | null {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    const apiUrl = process.env.API_URL
    if (!apiUrl) {
      console.error('[proxy] API_URL environment variable is required in production')
      return null
    }

    try {
      new URL(apiUrl)
    } catch {
      console.error('[proxy] API_URL is not a valid URL')
      return null
    }

    if (!isTrustedOrigin(apiUrl)) {
      const trustUnlisted = process.env.TRUST_UNLISTED_API_ORIGINS === 'true'
      if (!trustUnlisted) {
        console.error(
          `[proxy] API_URL "${apiUrl}" is not in TRUSTED_API_ORIGINS. ` +
            'Add this origin to TRUSTED_API_ORIGINS or set TRUST_UNLISTED_API_ORIGINS=true.'
        )
        return null
      }
    }

    return apiUrl
  }

  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'
  try {
    new URL(url)
    return url
  } catch {
    console.error('[proxy] Invalid API URL configuration')
    return null
  }
}

/**
 * Check if path matches any of the given routes
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

/**
 * Check if path is a static asset or API route
 */
function isStaticOrApi(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // Files with extensions (favicon.ico, etc.)
  )
}

function buildAuthCookieHeader(request: NextRequest): string | null {
  const authCookies = request.cookies
    .getAll()
    .filter((cookie) => AUTH_COOKIE_NAMES.has(cookie.name) || isSessionDataCookie(cookie.name))

  if (authCookies.length === 0) {
    return null
  }

  return authCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}

function parseRoleFromAuthMeResponse(payload: unknown): UserRole | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeData = (payload as { data?: unknown }).data
  if (!maybeData || typeof maybeData !== 'object') {
    return null
  }

  const role = (maybeData as { role?: unknown }).role
  if (role === 'admin' || role === 'user' || role === 'guest') {
    return role
  }

  return null
}

async function getVerifiedRole(request: NextRequest): Promise<UserRole | null> {
  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) {
    return null
  }

  const cookieHeader = buildAuthCookieHeader(request)
  if (!cookieHeader) {
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as unknown
    return parseRoleFromAuthMeResponse(payload)
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url)
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`
  loginUrl.searchParams.set('returnTo', returnTo)
  return NextResponse.redirect(loginUrl)
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Skip static assets and API routes
  if (isStaticOrApi(pathname)) {
    return NextResponse.next()
  }

  // Skip public routes
  if (matchesRoute(pathname, publicRoutes)) {
    return NextResponse.next()
  }

  // Verify session and role directly from backend source of truth.
  const role = await getVerifiedRole(request)
  if (!role) {
    return redirectToLogin(request)
  }

  if (matchesRoute(pathname, adminRoutes) && role !== 'admin') {
    // Not an admin, redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
}

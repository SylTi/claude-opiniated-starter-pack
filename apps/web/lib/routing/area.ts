import type { ShellArea } from '@saas/plugins-core'

const AUTH_ROUTE_PREFIXES = [
  '/auth',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const

function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

export function detectShellArea(pathname: string): ShellArea {
  if (matchesRoutePrefix(pathname, '/admin')) {
    return 'admin'
  }

  if (AUTH_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix))) {
    return 'auth'
  }

  return 'app'
}

export function isAuthAreaPath(pathname: string): boolean {
  return detectShellArea(pathname) === 'auth'
}

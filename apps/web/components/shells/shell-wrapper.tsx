'use client'

/**
 * Shell Wrapper Component
 *
 * Wraps children with the appropriate shell based on design and area.
 * Implements fallback behavior: if design shell crashes, uses default.
 *
 * Per spec: Shell override failures should log an incident and fall back
 * to the area-appropriate default shell, never crash the app.
 */

import { type ReactNode, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useDesign } from '@/contexts/design-context'
import { useNavigation } from '@/contexts/navigation-context'
import { getShellForArea } from '@/lib/theme/get-shell-for-area'
import { DefaultAppShell } from './default-app-shell'
import { DefaultAdminShell } from './default-admin-shell'
import { DefaultAuthShell } from './default-auth-shell'
import type { ShellArea } from '@saas/plugins-core'
import type { NavModelWithIcons } from '@/lib/nav/types'
import type { NavContext } from '@saas/plugins-core'

/**
 * Props for ShellWrapper.
 */
interface ShellWrapperProps {
  children: ReactNode
  /** The area to render shell for */
  area?: ShellArea
}

/**
 * Auth route prefixes.
 * All routes under (auth) group should be detected as auth area.
 */
const AUTH_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

/**
 * Check if pathname matches a route prefix with proper boundary.
 * Matches exact path or path followed by / (subpath).
 * Prevents /admin from matching /administer.
 */
function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

/**
 * Detect area from pathname.
 *
 * Uses proper boundary matching to prevent:
 * - /administer from matching admin area
 * - /login-help from matching auth area
 */
function detectArea(pathname: string): ShellArea {
  if (matchesRoutePrefix(pathname, '/admin')) {
    return 'admin'
  }
  if (AUTH_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix))) {
    return 'auth'
  }
  return 'app'
}

/**
 * Default shell component type.
 */
type DefaultShellComponent = React.ComponentType<{
  nav: NavModelWithIcons
  navContext: NavContext
  children: ReactNode
  pathname?: string
}>

/**
 * Get the default shell component for a given area.
 * Each area has its own default fallback shell.
 */
function getDefaultShellForArea(area: ShellArea): DefaultShellComponent {
  switch (area) {
    case 'admin':
      return DefaultAdminShell
    case 'auth':
      return DefaultAuthShell
    case 'app':
    default:
      return DefaultAppShell
  }
}

/**
 * Shell wrapper component.
 * Renders children within the appropriate shell based on design and area.
 *
 * Handles ALL areas (app, admin, auth) with proper design override support:
 * - Applies area-specific theme tokens
 * - Uses design.adminOverride.shell or design.authOverride.shell when available
 * - Falls back to area-appropriate default shells
 *
 * Safe mode behavior:
 * - When in safe mode, uses area-appropriate default shell
 * - Design shells are not rendered to prevent crashes
 *
 * Fallback behavior:
 * - If design shell throws, logs incident and uses area-appropriate default
 * - App remains accessible even if design is broken
 */
export function ShellWrapper({
  children,
  area: explicitArea,
}: ShellWrapperProps): React.ReactElement {
  const pathname = usePathname()
  const { design, isSafeMode } = useDesign()
  const { nav, navContext, isLoading } = useNavigation()

  // Determine area from explicit prop or pathname
  // Area tokens are now applied synchronously in DesignProvider
  // based on pathname, eliminating flicker on client-side navigation
  const area = explicitArea ?? detectArea(pathname)

  // Render the default shell for safe mode/loading states
  // Using explicit conditionals instead of dynamic component reference
  // to satisfy react-hooks/static-components rule
  const renderDefaultShell = (shellChildren: ReactNode): React.ReactElement => {
    const shellProps = { nav, navContext, pathname, children: shellChildren }
    switch (area) {
      case 'admin':
        return <DefaultAdminShell {...shellProps} />
      case 'auth':
        return <DefaultAuthShell {...shellProps} />
      case 'app':
      default:
        return <DefaultAppShell {...shellProps} />
    }
  }

  // Use memoized shell to prevent unnecessary re-renders
  const shell = useMemo(() => {
    // In safe mode or while loading, use area-appropriate default shell
    if (isSafeMode || isLoading) {
      return renderDefaultShell(children)
    }

    // Get the correct default shell for this area (used by getShellForArea)
    const DefaultShell = getDefaultShellForArea(area)

    // Use getShellForArea which handles design shell selection and fallback
    // This will use design.adminOverride.shell, design.authOverride.shell,
    // or fall back to DefaultShell based on area
    return getShellForArea({
      area,
      design,
      DefaultShell,
      nav,
      navContext,
      children,
      pathname,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderDefaultShell is stable within render
  }, [area, design, nav, navContext, children, pathname, isSafeMode, isLoading])

  return <>{shell}</>
}

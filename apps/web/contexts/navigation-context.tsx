'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { NavContext } from '@saas/plugins-core'
import type { NavModelWithIcons, NavSectionWithIcons } from '@/lib/nav/types'
import { createMinimalNavModel, toNavModelWithIcons } from '@/lib/nav/build-nav-model'
import { buildNavigationServerSide, type SerializableNavContext } from '@/lib/nav/actions'
import { useAuth } from './auth-context'

/**
 * Navigation context value.
 */
interface NavigationContextType {
  /** Complete navigation model with icons */
  nav: NavModelWithIcons

  /** Navigation context data */
  navContext: NavContext

  /** Whether navigation is loading */
  isLoading: boolean

  /** Refresh navigation model */
  refreshNav: () => void

  /** Error from navigation build (if any) */
  error?: string
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

/**
 * Props for NavigationProvider.
 */
interface NavigationProviderProps {
  children: ReactNode

  /** Optional click handlers for onClick items */
  onClickHandlers?: Record<string, () => void | Promise<void>>
}

/**
 * Provider for navigation system.
 *
 * Architecture per spec §6.1, §5.3, and §8.2:
 *
 * Server-side (via buildNavigationServerSide):
 * - baseline → mandatory → sort → collision check → permission filter
 *
 * Client-side:
 * - Receives fully-built nav from server
 * - Converts to React components (icons)
 *
 * This ensures:
 * 1. Permission filtering is centralized server-side (spec §6.1)
 * 2. Collision detection is boot-fatal on the server (spec §5.3)
 *
 * NOTE: Hooks are skipped in the Next.js runtime because they're registered
 * by the API backend's PluginBootService (AdonisJS), not in Next.js.
 * For hook-based nav extensions, the API should compose and expose nav.
 *
 * Safe mode behavior:
 * - When safe mode is enabled, uses default nav only
 * - Design-provided navigation is skipped
 * - Ensures core navigation remains accessible
 */
export function NavigationProvider({
  children,
  onClickHandlers,
}: NavigationProviderProps): React.ReactElement {
  const { user, logout } = useAuth()
  const [nav, setNav] = useState<NavModelWithIcons>({ main: [], admin: [], userMenu: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  // Boot-fatal errors are stored here and thrown during render
  // This ensures error boundaries can catch them (throwing in useEffect doesn't propagate)
  const [fatalError, setFatalError] = useState<Error | null>(null)

  // Extract only the user fields we need for navContext
  // This prevents navContext from changing when user object reference changes
  // but the relevant fields haven't changed (e.g., after refreshUser)
  const userRole = user?.role ?? null
  const userCurrentTenantId = user?.currentTenantId ?? null
  const userTierLevel = user?.effectiveSubscriptionTier?.level ?? 0

  // Build navigation context from user state
  // Depends on specific fields, not the entire user object, to prevent
  // unnecessary rebuilds when user reference changes but data is same
  // TODO: hasMultipleTenants should come from API (e.g., user.tenants.length > 1)
  // Currently defaults to false; TenantSwitcher component handles its own visibility
  const navContext = useMemo((): NavContext => {
    return {
      userRole,
      entitlements: new Set<string>(userRole === 'admin' ? ['admin'] : []),
      tenantId: userCurrentTenantId ? String(userCurrentTenantId) : null,
      tierLevel: userTierLevel,
      // Default to false - the switch-tenant nav item won't show unless API provides this
      // This is safer than assuming admins have multiple tenants
      hasMultipleTenants: false,
    }
  }, [userRole, userCurrentTenantId, userTierLevel])

  // Default click handlers
  const defaultHandlers = useMemo(() => ({
    logout: async () => {
      await logout()
      window.location.href = '/login'
    },
    switchTenant: () => {
      // This could open a tenant switcher modal
      console.log('Switch tenant clicked')
    },
    ...onClickHandlers,
  }), [logout, onClickHandlers])

  // Build navigation model
  const buildNav = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      // Pass only non-auth hints to server action
      // SECURITY: Auth context is now verified server-side, not trusted from client
      const clientHints: SerializableNavContext = {
        tenantId: navContext.tenantId,
        tenantPlanId: navContext.tenantPlanId,
        // NOTE: Auth fields (entitlements, userRole, abilities) are intentionally
        // NOT sent - server verifies these from the session cookie
      }

      // Get server-side nav (collision-checked, permission-filtered)
      // Per spec §5.3: collision detection is boot-fatal and happens on the server
      // Per spec §6.1: permission filtering is centralized server-side
      // SECURITY: Auth verification happens server-side via verifyUserFromApi()
      const serverResult = await buildNavigationServerSide(clientHints)

      // Convert to React components (icons)
      const builtNav = toNavModelWithIcons(serverResult.nav, defaultHandlers)
      setNav(builtNav)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[NavigationProvider] Error building nav:', err)

      // Check if this is a collision error (boot-fatal per spec §5.3)
      // Collision errors contain specific keywords from assertNoIdCollisions
      const isCollisionError = errorMessage.includes('collision') ||
        errorMessage.includes('duplicate') ||
        errorMessage.includes('Duplicate nav')

      if (isCollisionError) {
        // Boot-fatal: store error to throw during render
        // Throwing in async/useEffect doesn't propagate to error boundary
        // Setting state and throwing in render does
        const error = err instanceof Error ? err : new Error(errorMessage)
        setFatalError(error)
        setError(errorMessage)
        return // Don't continue, will throw in render
      }

      // Non-fatal errors: fallback to minimal auth-neutral nav
      // SECURITY: Do NOT use client-derived navContext here as it could re-show
      // privileged links when server verification fails
      setError(errorMessage)
      setNav(toNavModelWithIcons(createMinimalNavModel(), defaultHandlers))
    } finally {
      setIsLoading(false)
    }
  }, [navContext, defaultHandlers])

  // Rebuild nav when dependencies change
  useEffect(() => {
    buildNav()
  }, [buildNav])

  // Boot-fatal errors must be thrown during render for error boundaries to catch them
  // This is the React-idiomatic way to propagate async errors to error boundaries
  if (fatalError) {
    throw fatalError
  }

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo<NavigationContextType>(
    () => ({
      nav,
      navContext,
      isLoading,
      refreshNav: buildNav,
      error,
    }),
    [nav, navContext, isLoading, buildNav, error]
  )

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}

/**
 * Hook to access navigation context.
 */
export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}

/**
 * Hook to get a specific nav section by ID.
 */
export function useNavSection(sectionId: string): NavSectionWithIcons | undefined {
  const { nav } = useNavigation()

  return useMemo(() => {
    // Search in all areas
    for (const sections of [nav.main, nav.admin, nav.userMenu]) {
      const section = sections.find((s) => s.id === sectionId)
      if (section) return section
    }
    return undefined
  }, [nav, sectionId])
}

/**
 * Hook to get main navigation sections.
 */
export function useMainNav(): NavSectionWithIcons[] {
  const { nav } = useNavigation()
  return nav.main
}

/**
 * Hook to get admin navigation sections.
 */
export function useAdminNav(): NavSectionWithIcons[] {
  const { nav } = useNavigation()
  return nav.admin
}

/**
 * Hook to get user menu sections.
 */
export function useUserMenuNav(): NavSectionWithIcons[] {
  const { nav } = useNavigation()
  return nav.userMenu
}

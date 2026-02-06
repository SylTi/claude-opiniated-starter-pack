'use client'

/**
 * Design Context
 *
 * Provides design system (theme tokens, shells) to the application.
 * Loads design from main-app plugin if available.
 */

import {
  createContext,
  useContext,
  useCallback,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { AppDesign, ThemeTokens, ShellArea } from '@saas/plugins-core'
import { applyThemeTokens, getDefaultThemeTokens } from '@/lib/theme/apply-theme-tokens'
import { getTokensForArea } from '@/lib/theme/get-shell-for-area'

/**
 * Get pathname from window.location (client-side only).
 * Returns '/' on server.
 */
function getPathnameSnapshot(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname
}

/**
 * Server snapshot for useSyncExternalStore.
 */
function getServerPathnameSnapshot(): string {
  return '/'
}

/**
 * Subscribe to pathname changes.
 * Uses a MutationObserver on document.body to detect URL changes
 * since Next.js doesn't fire popstate on client-side navigation.
 */
function subscribeToPathname(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  // Listen for popstate (browser back/forward)
  window.addEventListener('popstate', callback)

  // Use MutationObserver to detect client-side navigation
  // Next.js updates the DOM on navigation, which we can detect
  let lastPathname = window.location.pathname
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPathname) {
      lastPathname = window.location.pathname
      callback()
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    window.removeEventListener('popstate', callback)
    observer.disconnect()
  }
}

/**
 * Hook to get current pathname without depending on Next.js router context.
 * Works both inside and outside RouterProvider (e.g., in tests).
 *
 * Uses useSyncExternalStore for safe subscription to pathname changes.
 */
function usePathnameSafe(): string {
  return useSyncExternalStore(
    subscribeToPathname,
    getPathnameSnapshot,
    getServerPathnameSnapshot
  )
}

/**
 * Check if running in safe mode from client-side env var.
 *
 * Uses NEXT_PUBLIC_SAFE_MODE because this is a client component.
 * Server components and actions use SAFE_MODE instead.
 *
 * NOTE: For consistent safe mode behavior, prefer using serverSafeMode prop
 * which is set based on the server's SAFE_MODE check. The client env var
 * is a fallback for cases where server status isn't available.
 */
function isClientSafeMode(): boolean {
  if (typeof window === 'undefined') return false
  return process.env.NEXT_PUBLIC_SAFE_MODE === '1' || process.env.NEXT_PUBLIC_SAFE_MODE === 'true'
}

/**
 * Auth route prefixes for area detection.
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
 * Used to initialize correct area tokens on first render (no flicker).
 *
 * Uses proper boundary matching to prevent:
 * - /administer from matching admin area
 * - /login-help from matching auth area
 */
function detectAreaFromPathname(pathname: string): ShellArea {
  if (matchesRoutePrefix(pathname, '/admin')) {
    return 'admin'
  }
  if (AUTH_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix))) {
    return 'auth'
  }
  return 'app'
}

/**
 * Design context value.
 */
interface DesignContextType {
  /** Current design (null if using defaults or safe mode) */
  design: AppDesign | null

  /** Current theme tokens */
  themeTokens: ThemeTokens

  /** Whether design is loaded */
  isLoaded: boolean

  /** Whether using default design */
  isDefault: boolean

  /** Whether running in safe mode */
  isSafeMode: boolean

  /** Apply tokens for a specific area */
  applyAreaTokens: (area: ShellArea) => void
}

const DesignContext = createContext<DesignContextType | undefined>(undefined)

/**
 * Props for DesignProvider.
 */
interface DesignProviderProps {
  children: ReactNode

  /** Optional design to use (if not provided, uses defaults) */
  design?: AppDesign | null

  /** Initial area for token application */
  initialArea?: ShellArea

  /**
   * Server-side safe mode status.
   * When true, overrides client-side check to ensure consistency.
   * This should come from the server's SAFE_MODE env var check.
   */
  serverSafeMode?: boolean
}

/**
 * Provider for design system.
 * Applies theme tokens and provides design to children.
 *
 * Safe mode behavior:
 * - When safe mode is enabled, design overrides are disabled
 * - Default theme tokens are always used
 * - This ensures the app remains accessible even if design crashes
 *
 * Safe mode sources (in priority order):
 * 1. serverSafeMode prop (from server's SAFE_MODE check - most reliable)
 * 2. NEXT_PUBLIC_SAFE_MODE env var (client-side fallback)
 *
 * For consistent behavior, NavigationProvider passes serverSafeMode
 * from buildNavigationServerSide() result.
 */
export function DesignProvider({
  children,
  design = null,
  initialArea,
  serverSafeMode,
}: DesignProviderProps): React.ReactElement {
  // Derive area synchronously from pathname on every render
  // This prevents flicker during client-side navigation by ensuring
  // tokens are computed before paint (no useState/useEffect delay)
  // Uses usePathnameSafe which doesn't require RouterProvider context
  const pathname = usePathnameSafe()

  // Area is always derived fresh - initialArea prop overrides pathname detection
  // This is synchronous, so tokens update in the same render pass as navigation
  const currentArea = initialArea ?? detectAreaFromPathname(pathname)

  // isLoaded is now always true since tokens are computed synchronously via useMemo.
  // CSS vars are applied before paint via useLayoutEffect, so no loading delay.
  const isLoaded = true

  // Server safe mode takes precedence over client-side check
  // This ensures consistency when SAFE_MODE is set server-side but
  // NEXT_PUBLIC_SAFE_MODE is not set client-side
  const safeMode = serverSafeMode ?? isClientSafeMode()

  // Compute tokens synchronously with useMemo - no render delay
  // This ensures token values are available immediately during render
  const themeTokens = useMemo((): ThemeTokens => {
    if (safeMode) {
      return getDefaultThemeTokens()
    }
    if (design) {
      try {
        return design.appTokens()
      } catch (error) {
        console.error('[DesignProvider] Error getting app tokens:', error)
        return getDefaultThemeTokens()
      }
    }
    return getDefaultThemeTokens()
  }, [design, safeMode])

  // Apply tokens for a specific area - now a no-op since area is derived from pathname
  // Kept for API compatibility; if explicit area override needed, pass initialArea prop
  // Memoized with useCallback to prevent context value from changing
  const applyAreaTokens = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_area: ShellArea): void => {
      // No-op: area is now derived synchronously from pathname
      // For explicit area overrides, pass initialArea prop to DesignProvider
    },
    []
  )

  // Apply CSS variables to document BEFORE paint using useLayoutEffect
  // This prevents visual flicker during client-side navigation
  useLayoutEffect(() => {
    if (safeMode) {
      console.log('[DesignProvider] Safe mode enabled - using default tokens')
    }

    // 1. Apply base tokens to document FIRST
    applyThemeTokens(themeTokens)

    // 2. Apply area-specific token overrides on TOP of base tokens
    // This ensures area overrides are not overwritten by base tokens
    if (!safeMode && design) {
      const areaTokens = getTokensForArea(design, currentArea)
      if (areaTokens && typeof document !== 'undefined') {
        const root = document.documentElement
        for (const [key, value] of Object.entries(areaTokens)) {
          // Keys from getTokensForArea already include -- prefix for CSS vars
          // Apply directly to document
          root.style.setProperty(key, value)
        }
      }
    }
  }, [themeTokens, design, currentArea, safeMode])

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo<DesignContextType>(
    () => ({
      design: safeMode ? null : design,
      themeTokens,
      isLoaded,
      isDefault: design === null || safeMode,
      isSafeMode: safeMode,
      applyAreaTokens,
    }),
    [design, themeTokens, isLoaded, safeMode, applyAreaTokens]
  )

  return (
    <DesignContext.Provider value={value}>
      {children}
    </DesignContext.Provider>
  )
}

/**
 * Hook to access design context.
 */
export function useDesign(): DesignContextType {
  const context = useContext(DesignContext)
  if (context === undefined) {
    throw new Error('useDesign must be used within a DesignProvider')
  }
  return context
}

/**
 * Hook to access just theme tokens.
 */
export function useThemeTokens(): ThemeTokens {
  const { themeTokens } = useDesign()
  return themeTokens
}

/**
 * Hook to check if in safe mode.
 */
export function useSafeMode(): boolean {
  const { isSafeMode } = useDesign()
  return isSafeMode
}

/**
 * Framework Context Types and Consumer Hook
 *
 * This module defines the interface for framework primitives that the
 * skeleton provides to plugins. The actual context is created and
 * provided by the skeleton (e.g., Next.js app).
 *
 * Plugins can use useFramework() to access these primitives in their
 * AppProviders component.
 */

import { createContext, useContext, type ComponentType, type ReactNode } from 'react'

/**
 * Router adapter interface.
 * Abstracts framework-specific router for plugins.
 */
export interface RouterAdapter {
  push: (path: string) => void
  replace: (path: string) => void
  back: () => void
  refresh: () => void
  pathname: string
  searchParams: URLSearchParams
}

/**
 * Link component props interface.
 */
export interface FrameworkLinkProps {
  href: string
  children: ReactNode
  className?: string
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  onClick?: (e: React.MouseEvent) => void
}

/**
 * Image component props interface.
 */
export interface FrameworkImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  fill?: boolean
}

/**
 * Theme bridge interface.
 * Lets the skeleton expose theme control to plugins in a framework-agnostic way.
 */
export interface ThemeBridge {
  /** Get current theme identifier (e.g., 'light', 'dark', 'sepia'). */
  getTheme: () => string
  /** Set active theme identifier. */
  setTheme: (theme: string) => void
  /** Toggle theme when host supports a default cycle. */
  toggleTheme?: () => void
  /** Optional discovery of available theme identifiers. */
  listThemes?: () => string[]
  /** Subscribe to theme changes. Returns an unsubscribe function. */
  subscribe: (listener: (theme: string) => void) => () => void
}

/**
 * Auth bridge interface.
 * Lets the skeleton expose authentication state to plugins in a framework-agnostic way.
 */
export interface AuthBridge {
  /** Current authenticated user, or null if not logged in / still loading. */
  user: { id: number; email: string; fullName: string | null; role: string } | null
  /** Whether the auth state is still being resolved. */
  isLoading: boolean
  /** Convenience flag: true when user is non-null. */
  isAuthenticated: boolean
}

/**
 * Framework context value.
 * Provided by skeleton, consumed by plugins.
 */
export interface FrameworkContextValue {
  /** Router adapter for navigation */
  router: RouterAdapter
  /** Link component adapter */
  Link: ComponentType<FrameworkLinkProps>
  /** Image component adapter */
  Image: ComponentType<FrameworkImageProps>
  /** Theme bridge adapter */
  theme: ThemeBridge
  /** Auth bridge adapter (optional — absent in standalone / safe-mode) */
  auth?: AuthBridge
}

/**
 * Framework context.
 * Created here so both skeleton and plugins can reference the same context.
 * Skeleton provides the value, plugins consume it.
 */
export const FrameworkContext = createContext<FrameworkContextValue | null>(null)

/**
 * Hook to access framework context.
 * Returns null if used outside FrameworkProvider (e.g., in standalone mode).
 *
 * Plugins should handle null gracefully for standalone/safe-mode scenarios.
 */
export function useFramework(): FrameworkContextValue | null {
  return useContext(FrameworkContext)
}

/**
 * Hook to access framework context (throws if unavailable).
 * Use this in components that require framework primitives.
 */
export function useFrameworkRequired(): FrameworkContextValue {
  const context = useContext(FrameworkContext)
  if (!context) {
    throw new Error('useFrameworkRequired must be used within a FrameworkProvider')
  }
  return context
}

/**
 * Hook to access auth state from the framework context.
 * Returns a safe default (loading, no user) when outside a FrameworkProvider.
 *
 * Plugins should use this instead of importing the host app's auth context directly.
 */
export function usePluginAuth(): AuthBridge {
  const fw = useContext(FrameworkContext)
  if (!fw?.auth) {
    return { user: null, isLoading: true, isAuthenticated: false }
  }
  return fw.auth
}

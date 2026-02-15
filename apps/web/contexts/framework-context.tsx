'use client'

/**
 * Framework Context
 *
 * Provides Next.js framework primitives to plugins in a framework-agnostic way.
 * Plugins can use the useFramework() hook from @saas/plugins-core to get routing
 * and component adapters.
 *
 * This enables plugins to stay framework-independent while running in Next.js.
 *
 * The context itself is defined in @saas/plugins-core so that plugins can import
 * the same context object without a direct dependency on the SaaS app.
 */

import { useContext, useMemo, useRef, useCallback, type ReactNode } from 'react'
import { useRouter as useNextRouter, usePathname, useSearchParams } from 'next/navigation'
import NextLink from 'next/link'
import NextImage from 'next/image'
import {
  FrameworkContext,
  type AuthBridge,
  type ThemeBridge,
  type FrameworkContextValue,
  type FrameworkLinkProps,
  type FrameworkImageProps,
} from '@saas/plugins-core/framework'
import { THEME_COOKIE_NAME } from '@/lib/theme-config'
import { useAuth } from '@/contexts/auth-context'

// Re-export types and hooks from plugins-core/framework for convenience
export type { RouterAdapter, FrameworkLinkProps, FrameworkImageProps, FrameworkContextValue, AuthBridge } from '@saas/plugins-core/framework'
export { useFramework, useFrameworkRequired, usePluginAuth } from '@saas/plugins-core/framework'

const DEFAULT_THEME = 'light'
const DARK_THEME = 'dark'

function readThemeFromDocument(): string {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME
  }

  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${THEME_COOKIE_NAME}=`))
    ?.split('=')[1]

  if (cookieValue) {
    return decodeURIComponent(cookieValue)
  }

  const dataTheme = document.documentElement.getAttribute('data-theme')
  if (dataTheme) {
    return dataTheme
  }

  return document.documentElement.classList.contains(DARK_THEME) ? DARK_THEME : DEFAULT_THEME
}

function writeThemeCookie(theme: string): void {
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)};path=/;max-age=31536000;SameSite=Lax`
}

function applyThemeToDocument(theme: string): void {
  const root = document.documentElement

  root.setAttribute('data-theme', theme)
  if (theme === DARK_THEME) {
    root.classList.add(DARK_THEME)
  } else {
    root.classList.remove(DARK_THEME)
  }
}

/**
 * Next.js Link adapter component.
 */
function NextLinkAdapter({ href, children, ...props }: FrameworkLinkProps): React.ReactElement {
  return (
    <NextLink href={href} {...props}>
      {children}
    </NextLink>
  )
}

/**
 * Next.js Image adapter component.
 */
function NextImageAdapter({
  src,
  alt,
  width,
  height,
  className,
  priority,
  fill,
}: FrameworkImageProps): React.ReactElement {
  if (fill) {
    return (
      <NextImage
        src={src}
        alt={alt}
        fill
        className={className}
        priority={priority}
      />
    )
  }

  return (
    <NextImage
      src={src}
      alt={alt}
      width={width ?? 100}
      height={height ?? 100}
      className={className}
      priority={priority}
    />
  )
}

/**
 * Props for FrameworkProvider.
 */
interface FrameworkProviderProps {
  children: ReactNode
}

/**
 * Framework provider component.
 * Wraps the application to provide Next.js primitives to plugins.
 */
export function FrameworkProvider({ children }: FrameworkProviderProps): React.ReactElement {
  const nextRouter = useNextRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentThemeRef = useRef<string>(readThemeFromDocument())
  const themeListenersRef = useRef(new Set<(theme: string) => void>())

  const setTheme = useCallback((theme: string) => {
    const normalizedTheme = theme.trim() || DEFAULT_THEME
    currentThemeRef.current = normalizedTheme
    applyThemeToDocument(normalizedTheme)
    writeThemeCookie(normalizedTheme)
    for (const listener of themeListenersRef.current) {
      listener(normalizedTheme)
    }
  }, [])

  const themeBridge = useMemo<ThemeBridge>(() => ({
    getTheme: () => currentThemeRef.current,
    setTheme,
    toggleTheme: () => {
      setTheme(currentThemeRef.current === DARK_THEME ? DEFAULT_THEME : DARK_THEME)
    },
    listThemes: () => [DEFAULT_THEME, DARK_THEME],
    subscribe: (listener: (theme: string) => void) => {
      themeListenersRef.current.add(listener)
      return () => {
        themeListenersRef.current.delete(listener)
      }
    },
  }), [setTheme])

  const value = useMemo<FrameworkContextValue>(() => ({
    router: {
      push: (path: string) => nextRouter.push(path),
      replace: (path: string) => nextRouter.replace(path),
      back: () => nextRouter.back(),
      refresh: () => nextRouter.refresh(),
      pathname: pathname ?? '/',
      searchParams: searchParams ?? new URLSearchParams(),
    },
    Link: NextLinkAdapter,
    Image: NextImageAdapter,
    theme: themeBridge,
  }), [nextRouter, pathname, searchParams, themeBridge])

  return (
    <FrameworkContext.Provider value={value}>
      {children}
    </FrameworkContext.Provider>
  )
}

/**
 * Syncs auth state into the framework context.
 * Must be rendered inside both FrameworkProvider and AuthProvider.
 *
 * This creates an inner FrameworkContext.Provider that shadows the outer one,
 * adding the auth bridge while preserving all other framework primitives.
 */
export function FrameworkAuthSync({ children }: { children: ReactNode }): React.ReactElement {
  const outerFramework = useContext(FrameworkContext)
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()

  const authBridge = useMemo<AuthBridge>(() => ({
    user: user ? { id: user.id, email: user.email, fullName: user.fullName, role: user.role } : null,
    isLoading: authLoading,
    isAuthenticated,
  }), [user, authLoading, isAuthenticated])

  const value = useMemo<FrameworkContextValue | null>(() => {
    if (!outerFramework) return null
    return { ...outerFramework, auth: authBridge }
  }, [outerFramework, authBridge])

  if (!value) {
    return <>{children}</>
  }

  return (
    <FrameworkContext.Provider value={value}>
      {children}
    </FrameworkContext.Provider>
  )
}

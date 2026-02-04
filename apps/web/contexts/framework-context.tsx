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

import { useMemo, type ReactNode } from 'react'
import { useRouter as useNextRouter, usePathname, useSearchParams } from 'next/navigation'
import NextLink from 'next/link'
import NextImage from 'next/image'
import {
  FrameworkContext,
  type FrameworkContextValue,
  type FrameworkLinkProps,
  type FrameworkImageProps,
} from '@saas/plugins-core/framework'

// Re-export types and hooks from plugins-core/framework for convenience
export type { RouterAdapter, FrameworkLinkProps, FrameworkImageProps, FrameworkContextValue } from '@saas/plugins-core/framework'
export { useFramework, useFrameworkRequired } from '@saas/plugins-core/framework'

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
  }), [nextRouter, pathname, searchParams])

  return (
    <FrameworkContext.Provider value={value}>
      {children}
    </FrameworkContext.Provider>
  )
}

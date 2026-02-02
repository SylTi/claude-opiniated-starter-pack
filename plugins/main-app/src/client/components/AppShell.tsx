'use client'

/**
 * Main App Shell Component
 *
 * The primary shell component for the product area.
 * Wraps content with the main application layout.
 */

import type { ReactNode, ReactElement } from 'react'
import type { ShellProps } from '@saas/plugins-core'

/**
 * Props for MainAppShell - extends ShellProps with typed children.
 */
interface MainAppShellProps extends Omit<ShellProps, 'children'> {
  children: ReactNode
}

/**
 * Main application shell component.
 * Provides the standard layout for the product area.
 */
export function MainAppShell({
  children,
  nav,
  navContext,
  pathname,
}: MainAppShellProps): ReactElement {
  // The shell provides the main content wrapper
  // Header and sidebar navigation are typically handled at the layout level
  // This shell focuses on the content area structure

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </main>
  )
}

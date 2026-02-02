'use client'

import type { ReactNode } from 'react'
import type { NavModelWithIcons } from '@/lib/nav/types'
import type { NavContext } from '@saas/plugins-core'

/**
 * Props for DefaultAppShell.
 */
export interface DefaultAppShellProps {
  nav: NavModelWithIcons
  navContext: NavContext
  children: ReactNode
  pathname?: string
}

/**
 * Default app shell component.
 * Provides basic layout with header space and main content.
 */
export function DefaultAppShell({
  children,
}: DefaultAppShellProps): React.ReactElement {
  // Header is rendered separately at the layout level
  // This shell just provides the main content area

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      {children}
    </main>
  )
}

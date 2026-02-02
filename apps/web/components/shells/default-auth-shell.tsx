'use client'

import type { ReactNode } from 'react'
import type { NavModelWithIcons } from '@/lib/nav/types'
import type { NavContext } from '@saas/plugins-core'

/**
 * Props for DefaultAuthShell.
 */
export interface DefaultAuthShellProps {
  nav: NavModelWithIcons
  navContext: NavContext
  children: ReactNode
  pathname?: string
}

/**
 * Default auth shell component.
 * Provides centered auth box layout.
 */
export function DefaultAuthShell({
  children,
}: DefaultAuthShellProps): React.ReactElement {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">{children}</div>
    </div>
  )
}

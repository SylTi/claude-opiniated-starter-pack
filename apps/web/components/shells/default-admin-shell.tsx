'use client'

import type { ReactNode } from 'react'
import type { NavModelWithIcons } from '@/lib/nav/types'
import type { NavContext } from '@saas/plugins-core'
import { NavSection } from '@/components/nav/nav-section'

/**
 * Props for DefaultAdminShell.
 */
export interface DefaultAdminShellProps {
  nav: NavModelWithIcons
  navContext: NavContext
  children: ReactNode
  pathname?: string
}

/**
 * Default admin shell component.
 * Provides sidebar navigation + main content layout.
 */
export function DefaultAdminShell({
  nav,
  children,
}: DefaultAdminShellProps): React.ReactElement {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <nav className="bg-card text-card-foreground rounded-lg border p-4">
              <div className="mb-4 px-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Admin Panel
                </h2>
                <p className="text-sm text-muted-foreground">Manage your application</p>
              </div>

              <div className="space-y-4">
                {nav.admin.map((section) => (
                  <NavSection
                    key={section.id}
                    section={section}
                    variant="sidebar"
                  />
                ))}
              </div>
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

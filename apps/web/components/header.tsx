'use client'

import { useContext } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/user-menu'
import { DynamicUserMenu } from '@/components/nav/dynamic-user-menu'
import { TenantSwitcher } from '@/components/tenant-switcher'
import { useAuth } from '@/contexts/auth-context'
import { NavSection } from '@/components/nav/nav-section'
import { NavigationContext } from '@/contexts/navigation-context'
import type { NavSectionWithIcons } from '@/lib/nav/types'

/**
 * Hook to safely get navigation context.
 * Returns null if navigation context is not available.
 */
function useSafeNavContext(): { main: NavSectionWithIcons[]; userMenu: NavSectionWithIcons[] } | null {
  const context = useContext(NavigationContext)
  if (!context) {
    return null
  }
  return { main: context.nav.main, userMenu: context.nav.userMenu }
}

export function Header(): React.ReactElement {
  const { user, hasUserInfoCookie, userRole } = useAuth()
  const isPendingUser = !!hasUserInfoCookie && !user
  const navContext = useSafeNavContext()

  // Check if we have dynamic nav items
  const hasDynamicNav = navContext && navContext.main.length > 0
  const hasDynamicUserMenu = navContext && navContext.userMenu.length > 0

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          SaaS App
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <TenantSwitcher />
              {hasDynamicNav ? (
                // Use dynamic navigation from context
                navContext.main.map((section) => (
                  <NavSection
                    key={section.id}
                    section={section}
                    variant="header"
                  />
                ))
              ) : (
                // Fallback to static navigation
                <>
                  <Link href="/dashboard">
                    <Button variant="ghost">Dashboard</Button>
                  </Link>
                  {user.currentTenantId && (
                    // Use /apps/* route which has proper access control checks
                    <Link href="/apps/notes">
                      <Button variant="ghost">Notes</Button>
                    </Link>
                  )}
                  {user.role === 'admin' && (
                    <Link href="/admin/dashboard">
                      <Button variant="ghost">Admin</Button>
                    </Link>
                  )}
                </>
              )}
              {hasDynamicUserMenu ? (
                // Use dynamic user menu from context
                <DynamicUserMenu sections={navContext.userMenu} />
              ) : (
                // Fallback to static user menu
                <UserMenu />
              )}
            </>
          ) : isPendingUser ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              {userRole === 'admin' && (
                <Link href="/admin/dashboard">
                  <Button variant="ghost">Admin</Button>
                </Link>
              )}
              <div
                aria-hidden="true"
                className="h-8 w-8 rounded-full bg-gray-200"
              />
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button>Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

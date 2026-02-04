'use client'

import { Component, useContext, type ErrorInfo, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/user-menu'
import { DynamicUserMenu } from '@/components/nav/dynamic-user-menu'
import { TenantSwitcher } from '@/components/tenant-switcher'
import { useAuth } from '@/contexts/auth-context'
import { useDesign, useThemeTokens } from '@/contexts/design-context'
import { NavSection } from '@/components/nav/nav-section'
import { NavigationContext } from '@/contexts/navigation-context'
import type { NavSectionWithIcons } from '@/lib/nav/types'
import type { HeaderOverrideProps } from '@saas/plugins-core'

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

interface HeaderErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

interface HeaderErrorBoundaryState {
  hasError: boolean
}

class HeaderErrorBoundary extends Component<HeaderErrorBoundaryProps, HeaderErrorBoundaryState> {
  constructor(props: HeaderErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): HeaderErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Header] Header override crashed, falling back to default header', error)
    console.error('[Header] Component stack:', errorInfo.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export function Header(): React.ReactElement {
  const pathname = usePathname()
  const { user, hasUserInfoCookie, userRole } = useAuth()
  const { design, isSafeMode } = useDesign()
  const isPendingUser = !!hasUserInfoCookie && !user
  const navContext = useSafeNavContext()
  const themeTokens = useThemeTokens()

  // Check if we have dynamic nav items
  const hasDynamicNav = navContext && navContext.main.length > 0
  const hasDynamicUserMenu = navContext && navContext.userMenu.length > 0

  // Use plugin's appName and logo if available, fallback to default
  const appName = themeTokens.appName ?? 'SaaS App'
  const logoUrl = themeTokens.logoUrl

  const brandNode = (
    <Link href="/" className="flex items-center gap-2 text-xl font-bold text-foreground">
      {logoUrl ? (
        <Image src={logoUrl} alt={appName} width={28} height={28} className="h-7 w-7" />
      ) : null}
      <span>{appName}</span>
    </Link>
  )

  const mainNavigationNode = hasDynamicNav ? (
    navContext.main.map((section) => (
      <NavSection
        key={section.id}
        section={section}
        variant="header"
      />
    ))
  ) : (
    <>
      <Link href="/dashboard">
        <Button variant="ghost">Dashboard</Button>
      </Link>
      {user?.currentTenantId && (
        // Use /apps/* route which has proper access control checks
        <Link href="/apps/notes">
          <Button variant="ghost">Notes</Button>
        </Link>
      )}
      {user?.role === 'admin' && (
        <Link href="/admin/dashboard">
          <Button variant="ghost">Admin</Button>
        </Link>
      )}
    </>
  )

  const tenantSwitcherNode = user ? <TenantSwitcher /> : null

  const userMenuNode = user
    ? (
        hasDynamicUserMenu ? (
          <DynamicUserMenu sections={navContext.userMenu} />
        ) : (
          <UserMenu />
        )
      )
    : null

  const pendingNavigationNode = (
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
        className="h-8 w-8 rounded-full bg-muted"
      />
    </>
  )

  const authActionsNode = (
    <>
      <Link href="/login">
        <Button variant="ghost">Sign in</Button>
      </Link>
      <Link href="/register">
        <Button>Get started</Button>
      </Link>
    </>
  )

  const defaultHeader = (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {brandNode}

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              {mainNavigationNode}
              {tenantSwitcherNode}
              {userMenuNode}
            </>
          ) : isPendingUser ? (
            pendingNavigationNode
          ) : (
            authActionsNode
          )}
        </nav>
      </div>
    </header>
  )

  if (!isSafeMode && design?.headerOverride?.Header) {
    const HeaderOverrideComponent = design.headerOverride.Header as React.ComponentType<HeaderOverrideProps>
    return (
      <HeaderErrorBoundary key={pathname} fallback={defaultHeader}>
        <HeaderOverrideComponent
          brand={brandNode}
          mainNavigation={mainNavigationNode}
          tenantSwitcher={tenantSwitcherNode}
          userMenu={userMenuNode}
          pendingNavigation={pendingNavigationNode}
          authActions={authActionsNode}
          isAuthenticated={!!user}
          isPendingUser={isPendingUser}
        />
      </HeaderErrorBoundary>
    )
  }

  return defaultHeader
}

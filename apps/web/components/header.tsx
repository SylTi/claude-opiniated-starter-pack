'use client'

import { Component, lazy, Suspense, useContext, type ErrorInfo, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@saas/ui/button'
import { UserMenu } from '@/components/user-menu'
import { DynamicUserMenu } from '@/components/nav/dynamic-user-menu'
import { TenantSwitcher } from '@/components/tenant-switcher'
import { useAuth } from '@/contexts/auth-context'
import { useDesign, useThemeTokens } from '@/contexts/design-context'
import { useFramework } from '@/contexts/framework-context'
import { NavSection } from '@/components/nav/nav-section'
import { NavigationContext } from '@/contexts/navigation-context'
import type { NavSectionWithIcons } from '@/lib/nav/types'
import { detectShellArea } from '@/lib/routing/area'
import type { HeaderOverrideProps, HeaderLayoutModel, HeaderLayoutSlot } from '@saas/plugins-core'
import { useI18n } from '@/contexts/i18n-context'

/**
 * Lazily load the NotificationBell from the notifications plugin.
 * This decouples the header from the plugin's component directory.
 * Falls back to an empty component when the plugin is not available.
 */
const EmptyComponent = (): null => null
const NotificationBell = lazy(() =>
  import('@plugins/notifications/client')
    .then((mod: Record<string, unknown>) => ({
      default: mod.NotificationBell as React.ComponentType,
    }))
    .catch(() => ({ default: EmptyComponent }))
)

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

function renderLayoutSlots(
  slots: HeaderLayoutSlot[],
  slotContent: Record<HeaderLayoutSlot, ReactNode>
): React.ReactElement[] {
  return slots
    .map((slot, index) => {
      const node = slotContent[slot]
      if (!node) return null
      return (
        <div key={`${slot}-${index}`} className="flex items-center">
          {node}
        </div>
      )
    })
    .filter((node): node is React.ReactElement => node !== null)
}

export function Header(): React.ReactElement {
  const { t } = useI18n('skeleton')
  const pathname = usePathname()
  const area = detectShellArea(pathname)
  const { user, hasUserInfoCookie, userRole } = useAuth()
  const { design, isSafeMode } = useDesign()
  const framework = useFramework()
  const isPendingUser = !!hasUserInfoCookie && !user
  const forceGuestHeader = area === 'auth' || pathname === '/'
  const showAuthenticatedHeader = !!user && !forceGuestHeader
  const showPendingHeader = isPendingUser && !forceGuestHeader
  const navContext = useSafeNavContext()
  const themeTokens = useThemeTokens()

  // Check if we have dynamic nav items
  const hasDynamicNav = navContext && navContext.main.length > 0
  const hasDynamicUserMenu = navContext && navContext.userMenu.length > 0

  // Use plugin's appName and logo if available, fallback to default
  const appName = themeTokens.appName ?? t('home.title', undefined, 'SaaS App')
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
        <Button variant="ghost">{t('header.dashboard')}</Button>
      </Link>
      {user?.currentTenantId && (
        // Use /apps/* route which has proper access control checks
        <Link href="/apps/notes">
          <Button variant="ghost">{t('header.notes')}</Button>
        </Link>
      )}
      {user?.role === 'admin' && (
        <Link href="/admin/dashboard">
          <Button variant="ghost">{t('header.admin')}</Button>
        </Link>
      )}
    </>
  )

  const tenantSwitcherNode = showAuthenticatedHeader ? <TenantSwitcher /> : null

  const userMenuNode = showAuthenticatedHeader
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
        <Button variant="ghost">{t('header.dashboard')}</Button>
      </Link>
      {userRole === 'admin' && (
        <Link href="/admin/dashboard">
          <Button variant="ghost">{t('header.admin')}</Button>
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
        <Button variant="ghost">{t('header.signIn')}</Button>
      </Link>
      <Link href="/register">
        <Button>{t('header.getStarted')}</Button>
      </Link>
    </>
  )

  const defaultHeader = (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {brandNode}

        <nav className="flex items-center gap-4">
          {showAuthenticatedHeader ? (
            <>
              {mainNavigationNode}
              <Suspense fallback={null}>
                <NotificationBell />
              </Suspense>
              {tenantSwitcherNode}
              {userMenuNode}
            </>
          ) : showPendingHeader ? (
            pendingNavigationNode
          ) : (
            authActionsNode
          )}
        </nav>
      </div>
    </header>
  )

  const themeToggleNode = framework?.theme.toggleTheme ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => framework.theme.toggleTheme?.()}
      aria-label={t('header.toggleTheme')}
    >
      {t('header.themeButton')}
    </Button>
  ) : null

  if (!isSafeMode && design?.headerOverride?.layout) {
    const HeaderLayoutBuilder = design.headerOverride.layout as (ctx: {
      isAuthenticated: boolean
      isPendingUser: boolean
    }) => HeaderLayoutModel

    const layout = HeaderLayoutBuilder({
      isAuthenticated: showAuthenticatedHeader,
      isPendingUser: showPendingHeader,
    })

    const slotContent: Record<HeaderLayoutSlot, ReactNode> = {
      brand: brandNode,
      mainNavigation: mainNavigationNode,
      tenantSwitcher: tenantSwitcherNode,
      userMenu: userMenuNode,
      pendingNavigation: pendingNavigationNode,
      authActions: authActionsNode,
      themeToggle: themeToggleNode,
    }

    const declarativeHeader = (
      <header className="border-b border-border bg-background">
        <div className="container mx-auto flex h-16 items-center gap-4 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {renderLayoutSlots(layout.left, slotContent)}
          </div>
          {layout.center && layout.center.length > 0 ? (
            <div className="flex items-center justify-center gap-3">
              {renderLayoutSlots(layout.center, slotContent)}
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            {renderLayoutSlots(layout.right, slotContent)}
          </div>
        </div>
      </header>
    )

    return (
      <HeaderErrorBoundary key={pathname} fallback={defaultHeader}>
        {declarativeHeader}
      </HeaderErrorBoundary>
    )
  }

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
          isAuthenticated={showAuthenticatedHeader}
          isPendingUser={showPendingHeader}
        />
      </HeaderErrorBoundary>
    )
  }

  return defaultHeader
}

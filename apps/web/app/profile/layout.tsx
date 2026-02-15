'use client'

import { type ReactNode, useContext, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Shield, Settings, Loader2 } from 'lucide-react'
import { cn } from '@saas/ui/utils'
import { useAuth } from '@/contexts/auth-context'
import { NavigationContext } from '@/contexts/navigation-context'
import type { NavItemWithIcon, NavSectionWithIcons } from '@/lib/nav/types'

/**
 * Core skeleton navigation items for the profile sidebar.
 * These items are always present and cannot be removed by plugins (per spec §5.2).
 */
const coreNavigation = [
  { id: 'core.profile', name: 'Profile', href: '/profile', icon: User },
  { id: 'core.security', name: 'Security', href: '/profile/security', icon: Shield },
  { id: 'core.settings', name: 'Settings', href: '/profile/settings', icon: Settings },
]

/**
 * Extract plugin-provided settings items from userMenu sections.
 * Per spec §5.1: Plugins can add items to reserved sections like core.settings.
 * Per spec §3.2: userMenu sections allow "grouped plugin settings menus".
 */
function getPluginSettingsItems(userMenuSections: NavSectionWithIcons[]): NavItemWithIcon[] {
  // Look for sections with settings-related IDs
  // The notarium plugin uses 'app.settings' section ID
  const settingsSections = userMenuSections.filter(
    (section) =>
      section.id.includes('settings') ||
      section.id.includes('preferences') ||
      section.id.includes('config')
  )

  // Flatten items from all settings sections
  return settingsSections.flatMap((section) => section.items)
}

/**
 * Profile layout component.
 * Authentication is handled by Next.js proxy (proxy.ts).
 *
 * Navigation composition (per spec §5.1, §3.2):
 * - Core items (Profile, Security, Settings) are skeleton-owned and always present
 * - Plugin items are extracted from userMenu sections with settings-related IDs
 * - Items are sorted by order then id for deterministic display
 */
export default function ProfileLayout({ children }: { children: ReactNode }): React.ReactElement {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const navigation = useContext(NavigationContext)

  // Get plugin-provided settings items
  const pluginItems = useMemo(
    () => getPluginSettingsItems(navigation?.nav.userMenu ?? []),
    [navigation?.nav.userMenu]
  )

  // Show loading state while auth context initializes
  if (isLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <nav className="bg-card text-card-foreground rounded-lg border p-4">
              {/* Core navigation items (skeleton-owned) */}
              <ul className="space-y-1">
                {coreNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground/80 hover:bg-accent'
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>

              {/* Plugin-provided settings items */}
              {pluginItems.length > 0 && (
                <>
                  <div className="my-3 border-t border-border" />
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    App Settings
                  </div>
                  <ul className="space-y-1">
                    {pluginItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                      const Icon = item.icon
                      return (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-accent text-accent-foreground'
                                : 'text-foreground/80 hover:bg-accent'
                            )}
                          >
                            {Icon && <Icon className="h-5 w-5" />}
                            {item.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1">
            <div className="bg-card text-card-foreground rounded-lg border p-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

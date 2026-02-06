'use client'

import { Moon, Sun } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/auth-context'
import { useFramework } from '@/contexts/framework-context'
import { useUserMenuNav } from '@/contexts/navigation-context'
import { THEME_COOKIE_NAME } from '@/lib/theme-config'
import { cn } from '@/lib/utils'
import type { NavSectionWithIcons } from '@/lib/nav/types'

interface DynamicUserMenuProps {
  /**
   * Sections to render in the user menu.
   * Required when using DynamicUserMenu directly.
   */
  sections: NavSectionWithIcons[]
}

const THEME_TOGGLE_ITEM_ID = 'app.theme.toggle'
const DARK_THEME = 'dark'
const LIGHT_THEME = 'light'

type ThemeMode = string

function readThemeFromDocument(): ThemeMode {
  if (typeof document === 'undefined') {
    return LIGHT_THEME
  }
  return document.documentElement.getAttribute('data-theme') ??
    (document.documentElement.classList.contains(DARK_THEME) ? DARK_THEME : LIGHT_THEME)
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme)
  if (theme === DARK_THEME) {
    document.documentElement.classList.add(DARK_THEME)
  } else {
    document.documentElement.classList.remove(DARK_THEME)
  }
}

function writeThemeCookie(theme: ThemeMode): void {
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)};path=/;max-age=31536000;SameSite=Lax`
}

function ThemeToggleMenuItem(): React.ReactElement {
  const framework = useFramework()
  const frameworkTheme = useSyncExternalStore(
    (onStoreChange) => framework?.theme.subscribe(onStoreChange) ?? (() => {}),
    () => framework?.theme.getTheme() ?? readThemeFromDocument(),
    () => framework?.theme.getTheme() ?? LIGHT_THEME
  )
  const [localTheme, setLocalTheme] = useState<ThemeMode>(() => readThemeFromDocument())
  const theme = framework ? frameworkTheme : localTheme
  const isDark = theme === DARK_THEME

  const toggleTheme = (): void => {
    if (framework) {
      if (framework.theme.toggleTheme) {
        framework.theme.toggleTheme()
        return
      }

      const availableThemes = framework.theme.listThemes?.() ?? [LIGHT_THEME, DARK_THEME]
      if (availableThemes.length === 0) {
        return
      }

      const currentTheme = framework.theme.getTheme()
      const currentIndex = availableThemes.indexOf(currentTheme)
      const nextTheme = availableThemes[(currentIndex + 1) % availableThemes.length] ?? availableThemes[0]
      framework.theme.setTheme(nextTheme)
      return
    }

    setLocalTheme((currentTheme) => {
      const nextTheme = currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME
      applyTheme(nextTheme)
      writeThemeCookie(nextTheme)
      return nextTheme
    })
  }

  return (
    <div className="px-2 py-1.5">
      <div className="flex items-center justify-between gap-3 rounded-sm px-1 text-sm">
        <span className="font-medium">Theme</span>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-border bg-muted transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <Sun
            className={cn(
              'absolute left-1 h-3.5 w-3.5 transition-opacity',
              isDark ? 'opacity-50 text-muted-foreground' : 'opacity-0'
            )}
          />
          <Moon
            className={cn(
              'absolute right-1 h-3.5 w-3.5 transition-opacity',
              isDark ? 'opacity-0' : 'opacity-50 text-muted-foreground'
            )}
          />
          <span
            className={cn(
              'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
              isDark ? 'translate-x-6' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  )
}

/**
 * Dynamic user menu component (base implementation).
 * Renders user menu items from provided sections.
 *
 * This component can be used outside NavigationProvider.
 * For automatic nav context integration, use DynamicUserMenuWithContext.
 */
export function DynamicUserMenu({ sections }: DynamicUserMenuProps): React.ReactElement {
  const router = useRouter()
  const { user, logout } = useAuth()

  if (!user) {
    return <></>
  }

  const initials = user.fullName
    ? user.fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase()

  /**
   * Handle navigation item click.
   * Supports: onClick handlers, external links, and internal navigation.
   */
  const handleItemClick = async (item: NavSectionWithIcons['items'][0]): Promise<void> => {
    // Priority 1: Use configured onClick handler if present
    if (item.onClick) {
      await item.onClick()
      return
    }

    // Priority 2: Handle href navigation
    if (item.href && item.href !== '#') {
      // External links: open in new tab or navigate directly
      if (item.external) {
        window.open(item.href, '_blank', 'noopener,noreferrer')
      } else {
        router.push(item.href)
      }
    }
  }

  /**
   * Default logout handler.
   * Used only when core.logout doesn't have a configured onClick.
   */
  const handleDefaultLogout = async (): Promise<void> => {
    await logout()
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="user-menu"
          className="flex cursor-pointer items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.avatarUrl || undefined}
              alt={user.fullName || user.email}
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.fullName || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {sections.map((section, sectionIndex) => (
          <div key={section.id}>
            {sectionIndex > 0 && <DropdownMenuSeparator />}
            {section.items.map((item) => {
              if (item.id === THEME_TOGGLE_ITEM_ID) {
                return (
                  <ThemeToggleMenuItem key={item.id} />
                )
              }

              const Icon = item.icon

              // Determine click handler:
              // - If item has onClick configured, use handleItemClick (respects configured handler)
              // - For core.logout without onClick, use default logout as fallback
              const clickHandler = item.id === 'core.logout' && !item.onClick
                ? handleDefaultLogout
                : () => handleItemClick(item)

              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={clickHandler}
                >
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </DropdownMenuItem>
              )
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Dynamic user menu with automatic navigation context integration.
 * MUST be used within NavigationProvider.
 *
 * This is a convenience wrapper that fetches sections from NavigationContext.
 */
export function DynamicUserMenuWithContext(): React.ReactElement {
  const sections = useUserMenuNav()
  return <DynamicUserMenu sections={sections} />
}

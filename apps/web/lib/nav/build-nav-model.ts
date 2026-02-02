/**
 * Client-side Navigation Model Builder
 *
 * Builds the navigation model on the client side with React components.
 *
 * This module imports shared navigation building logic from @saas/plugins-core
 * and adds client-specific functionality (icon resolution, click handlers).
 */

import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { NavItem, NavSection, NavModel, NavContext } from '@saas/plugins-core'
import {
  ensureMandatoryItems,
  applyPermissionFilter,
  applySorting,
  assertNoIdCollisions,
  createEmptyNavModel,
} from '@saas/plugins-core'
import type { NavItemWithIcon, NavSectionWithIcons, NavModelWithIcons } from './types'

/**
 * Icon map for resolving string icon names to React components.
 */
const iconMap = Icons as unknown as Record<string, LucideIcon>

/**
 * Resolve icon string to React component.
 */
export function resolveIcon(iconName?: string): LucideIcon | undefined {
  if (!iconName) return undefined
  return iconMap[iconName]
}

/**
 * Convert NavItem to NavItemWithIcon.
 */
export function toNavItemWithIcon(item: NavItem, onClickHandlers?: Record<string, () => void | Promise<void>>): NavItemWithIcon {
  return {
    ...item,
    icon: resolveIcon(item.icon),
    onClick: item.onClick && onClickHandlers?.[item.onClick] ? onClickHandlers[item.onClick] : undefined,
  }
}

/**
 * Convert NavSection to NavSectionWithIcons.
 */
export function toNavSectionWithIcons(
  section: NavSection,
  onClickHandlers?: Record<string, () => void | Promise<void>>
): NavSectionWithIcons {
  return {
    ...section,
    items: section.items.map((item: NavItem) => toNavItemWithIcon(item, onClickHandlers)),
  }
}

/**
 * Convert NavModel to NavModelWithIcons.
 */
export function toNavModelWithIcons(
  model: NavModel,
  onClickHandlers?: Record<string, () => void | Promise<void>>
): NavModelWithIcons {
  return {
    main: model.main.map((s: NavSection) => toNavSectionWithIcons(s, onClickHandlers)),
    admin: model.admin.map((s: NavSection) => toNavSectionWithIcons(s, onClickHandlers)),
    userMenu: model.userMenu.map((s: NavSection) => toNavSectionWithIcons(s, onClickHandlers)),
  }
}

/**
 * Re-export createEmptyNavModel for convenience.
 */
export { createEmptyNavModel }

/**
 * Create a minimal, auth-neutral navigation model.
 * Used as fallback when server-side auth verification fails.
 *
 * SECURITY: This model does NOT include any privileged links (admin, team, etc.)
 * to prevent showing unauthorized navigation when auth verification fails.
 * Only basic navigation accessible without authentication is shown.
 */
export function createMinimalNavModel(): NavModel {
  return {
    main: [
      {
        id: 'core.main',
        label: 'Main',
        order: 100,
        items: [
          {
            id: 'core.dashboard',
            label: 'Dashboard',
            href: '/dashboard',
            icon: 'LayoutDashboard',
            order: 100,
          },
        ],
      },
    ],
    admin: [],
    userMenu: [
      {
        id: 'core.account',
        label: 'Account',
        order: 100,
        items: [
          { id: 'core.profile', label: 'Profile', href: '/profile', icon: 'User', order: 100 },
          { id: 'core.settings', label: 'Settings', href: '/profile/settings', icon: 'Settings', order: 300 },
        ],
      },
      {
        id: 'core.session',
        label: 'Session',
        order: 9999,
        items: [
          { id: 'core.logout', label: 'Log out', href: '#', icon: 'LogOut', order: 100 },
        ],
      },
    ],
  }
}

/**
 * Options for building client-side nav model.
 */
export interface ClientNavBuildOptions {
  /** Base navigation model (from main-app design) */
  baseNav: NavModel

  /** Navigation context */
  context: NavContext

  /** Click handlers for onClick items (e.g., logout, switchTenant) */
  onClickHandlers?: Record<string, () => void | Promise<void>>

  /** Whether to skip permission filtering */
  skipPermissionFilter?: boolean
}

/**
 * Build client-side navigation model with icons.
 *
 * Build order (per spec):
 * mandatory restore → sort → collision check → permission filter → convert to icons
 *
 * Note: On client side, collision check logs an error but doesn't throw.
 * The server-side builder is the authority for fatal validation.
 *
 * Uses shared functions from @saas/plugins-core to avoid duplication.
 */
export function buildClientNavModel(options: ClientNavBuildOptions): NavModelWithIcons {
  const { baseNav, context, onClickHandlers, skipPermissionFilter = false } = options

  try {
    // 1. Apply mandatory items (from @saas/plugins-core)
    let nav = ensureMandatoryItems(baseNav, context)

    // 2. Apply sorting (from @saas/plugins-core)
    nav = applySorting(nav)

    // 3. Collision check (log error but don't throw on client)
    // Server-side builder is authoritative for fatal validation
    try {
      assertNoIdCollisions(nav)
    } catch (collisionError) {
      console.error('[buildClientNavModel] Navigation ID collision detected:', collisionError)
      // Continue anyway - server should have caught this at boot time
    }

    // 4. Apply permission filtering (from @saas/plugins-core)
    if (!skipPermissionFilter) {
      nav = applyPermissionFilter(nav, context.entitlements, context.abilities)
    }

    // 5. Convert to React components
    return toNavModelWithIcons(nav, onClickHandlers)
  } catch (error) {
    console.error('[buildClientNavModel] Error building nav model:', error)
    // Return empty model as fallback
    return toNavModelWithIcons(createEmptyNavModel(), onClickHandlers)
  }
}

/**
 * Create a default/fallback navigation model.
 * Used when no design is available or in safe mode.
 */
export function createDefaultNavModel(context: NavContext): NavModel {
  const mainSections: NavSection[] = []
  const adminSections: NavSection[] = []
  const userMenuSections: NavSection[] = []

  // Main navigation
  if (context.userRole) {
    mainSections.push({
      id: 'core.main',
      label: 'Main',
      order: 100,
      items: [
        {
          id: 'core.dashboard',
          label: 'Dashboard',
          href: '/dashboard',
          icon: 'LayoutDashboard',
          order: 100,
        },
      ],
    })

    // Admin link for admin users
    if (context.userRole === 'admin') {
      mainSections[0].items.push({
        id: 'core.admin',
        label: 'Admin',
        href: '/admin/dashboard',
        icon: 'Shield',
        order: 900,
        requires: { capability: 'admin' },
      })
    }
  }

  // Admin navigation
  if (context.userRole === 'admin') {
    adminSections.push({
      id: 'core.admin.main',
      label: 'Admin',
      order: 100,
      items: [
        { id: 'core.admin.dashboard', label: 'Dashboard', href: '/admin/dashboard', icon: 'LayoutDashboard', order: 100 },
        { id: 'core.admin.users', label: 'Users', href: '/admin/users', icon: 'Users', order: 200 },
        { id: 'core.admin.tenants', label: 'Tenants', href: '/admin/tenants', icon: 'UsersRound', order: 300 },
        { id: 'core.admin.tiers', label: 'Tiers', href: '/admin/tiers', icon: 'Layers', order: 400 },
        { id: 'core.admin.stripe', label: 'Stripe', href: '/admin/stripe', icon: 'CreditCard', order: 500 },
        { id: 'core.admin.discounts', label: 'Discount Codes', href: '/admin/discount-codes', icon: 'Tag', order: 600 },
        { id: 'core.admin.coupons', label: 'Coupons', href: '/admin/coupons', icon: 'Ticket', order: 700 },
      ],
    })
  }

  // User menu
  if (context.userRole) {
    userMenuSections.push({
      id: 'core.account',
      label: 'Account',
      order: 100,
      items: [
        { id: 'core.profile', label: 'Profile', href: '/profile', icon: 'User', order: 100 },
        { id: 'core.security', label: 'Security', href: '/profile/security', icon: 'Shield', order: 200 },
        { id: 'core.settings', label: 'Settings', href: '/profile/settings', icon: 'Settings', order: 300 },
      ],
    })

    // Team section for paid tiers
    if (context.tenantId && context.tierLevel > 0) {
      userMenuSections[0].items.push({
        id: 'core.team',
        label: 'Team',
        href: '/team',
        icon: 'UsersRound',
        order: 400,
      })
    }

    // Admin panel for admins
    if (context.userRole === 'admin') {
      userMenuSections.push({
        id: 'core.admin.menu',
        label: 'Admin',
        order: 800,
        items: [
          { id: 'core.admin.panel', label: 'Admin Panel', href: '/admin/dashboard', icon: 'Users', order: 100 },
        ],
      })
    }
  }

  return {
    main: mainSections,
    admin: adminSections,
    userMenu: userMenuSections,
  }
}

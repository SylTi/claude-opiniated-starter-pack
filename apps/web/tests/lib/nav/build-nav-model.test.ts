import { describe, it, expect, vi } from 'vitest'
import {
  resolveIcon,
  toNavItemWithIcon,
  toNavSectionWithIcons,
  toNavModelWithIcons,
  buildClientNavModel,
  createDefaultNavModel,
  createEmptyNavModel,
  createMinimalNavModel,
} from '@/lib/nav/build-nav-model'
import type { NavItem, NavSection, NavModel, NavContext } from '@saas/plugins-core'
import * as Icons from 'lucide-react'

describe('build-nav-model', () => {
  describe('resolveIcon', () => {
    it('returns undefined for undefined input', () => {
      expect(resolveIcon(undefined)).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      expect(resolveIcon('')).toBeUndefined()
    })

    it('resolves valid Lucide icon name', () => {
      const icon = resolveIcon('Home')
      expect(icon).toBe(Icons.Home)
    })

    it('returns undefined for invalid icon name', () => {
      const icon = resolveIcon('NonExistentIcon')
      expect(icon).toBeUndefined()
    })

    it('resolves common navigation icons', () => {
      expect(resolveIcon('LayoutDashboard')).toBe(Icons.LayoutDashboard)
      expect(resolveIcon('Users')).toBe(Icons.Users)
      expect(resolveIcon('Settings')).toBe(Icons.Settings)
      expect(resolveIcon('LogOut')).toBe(Icons.LogOut)
    })
  })

  describe('toNavItemWithIcon', () => {
    const baseItem: NavItem = {
      id: 'core.dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: 'Home',
    }

    it('converts NavItem to NavItemWithIcon', () => {
      const result = toNavItemWithIcon(baseItem)

      expect(result.id).toBe('core.dashboard')
      expect(result.label).toBe('Dashboard')
      expect(result.href).toBe('/dashboard')
      expect(result.icon).toBe(Icons.Home)
    })

    it('handles item without icon', () => {
      const itemWithoutIcon: NavItem = {
        id: 'core.test',
        label: 'Test',
        href: '/test',
      }

      const result = toNavItemWithIcon(itemWithoutIcon)
      expect(result.icon).toBeUndefined()
    })

    it('binds onClick handler from handlers map', () => {
      const itemWithOnClick: NavItem = {
        id: 'core.logout',
        label: 'Log out',
        href: '#',
        onClick: 'logout',
      }
      const logoutHandler = vi.fn()
      const handlers = { logout: logoutHandler }

      const result = toNavItemWithIcon(itemWithOnClick, handlers)

      expect(result.onClick).toBe(logoutHandler)
    })

    it('returns undefined onClick when handler not found', () => {
      const itemWithOnClick: NavItem = {
        id: 'core.unknown',
        label: 'Unknown',
        href: '#',
        onClick: 'unknownHandler',
      }

      const result = toNavItemWithIcon(itemWithOnClick, {})

      expect(result.onClick).toBeUndefined()
    })

    it('preserves other properties', () => {
      const itemWithProps: NavItem = {
        id: 'core.test',
        label: 'Test',
        href: '/test',
        order: 100,
        badge: 'New',
        external: true,
      }

      const result = toNavItemWithIcon(itemWithProps)

      expect(result.order).toBe(100)
      expect(result.badge).toBe('New')
      expect(result.external).toBe(true)
    })
  })

  describe('toNavSectionWithIcons', () => {
    const baseSection: NavSection = {
      id: 'core.main',
      label: 'Main',
      items: [
        { id: 'core.dashboard', label: 'Dashboard', href: '/dashboard', icon: 'Home' },
        { id: 'core.settings', label: 'Settings', href: '/settings', icon: 'Settings' },
      ],
    }

    it('converts all items to NavItemWithIcon', () => {
      const result = toNavSectionWithIcons(baseSection)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].icon).toBe(Icons.Home)
      expect(result.items[1].icon).toBe(Icons.Settings)
    })

    it('preserves section properties', () => {
      const sectionWithProps: NavSection = {
        id: 'core.main',
        label: 'Main Navigation',
        order: 100,
        collapsible: true,
        defaultCollapsed: false,
        items: [],
      }

      const result = toNavSectionWithIcons(sectionWithProps)

      expect(result.id).toBe('core.main')
      expect(result.order).toBe(100)
      expect(result.collapsible).toBe(true)
      expect(result.defaultCollapsed).toBe(false)
    })

    it('passes handlers to items', () => {
      const section: NavSection = {
        id: 'core.account',
        label: 'Account',
        items: [
          { id: 'core.logout', label: 'Log out', href: '#', onClick: 'logout' },
        ],
      }
      const logoutHandler = vi.fn()
      const handlers = { logout: logoutHandler }

      const result = toNavSectionWithIcons(section, handlers)

      expect(result.items[0].onClick).toBe(logoutHandler)
    })
  })

  describe('toNavModelWithIcons', () => {
    const baseModel: NavModel = {
      main: [
        { id: 'core.main', label: 'Main', items: [{ id: 'core.dashboard', label: 'Dashboard', href: '/dashboard' }] },
      ],
      admin: [
        { id: 'core.admin', label: 'Admin', items: [{ id: 'core.users', label: 'Users', href: '/admin/users' }] },
      ],
      userMenu: [
        { id: 'core.account', label: 'Account', items: [{ id: 'core.profile', label: 'Profile', href: '/profile' }] },
      ],
    }

    it('converts all areas', () => {
      const result = toNavModelWithIcons(baseModel)

      expect(result.main).toHaveLength(1)
      expect(result.admin).toHaveLength(1)
      expect(result.userMenu).toHaveLength(1)
    })

    it('passes handlers to all areas', () => {
      const modelWithOnClick: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          {
            id: 'core.account',
            label: 'Account',
            items: [{ id: 'core.logout', label: 'Log out', href: '#', onClick: 'logout' }],
          },
        ],
      }
      const logoutHandler = vi.fn()

      const result = toNavModelWithIcons(modelWithOnClick, { logout: logoutHandler })

      expect(result.userMenu[0].items[0].onClick).toBe(logoutHandler)
    })
  })

  describe('createEmptyNavModel', () => {
    it('returns empty nav model', () => {
      const result = createEmptyNavModel()

      expect(result.main).toEqual([])
      expect(result.admin).toEqual([])
      expect(result.userMenu).toEqual([])
    })
  })

  describe('createMinimalNavModel', () => {
    it('returns minimal nav model with basic navigation', () => {
      const result = createMinimalNavModel()

      expect(result.main).toHaveLength(1)
      expect(result.main[0].items.some(i => i.id === 'core.dashboard')).toBe(true)
      expect(result.admin).toEqual([])
    })

    it('includes logout in user menu (SECURITY: users must always be able to log out)', () => {
      const result = createMinimalNavModel()

      // Find the logout item in any section
      const hasLogout = result.userMenu.some(section =>
        section.items.some(item => item.id === 'core.logout')
      )
      expect(hasLogout).toBe(true)
    })

    it('includes profile and settings in user menu', () => {
      const result = createMinimalNavModel()

      const accountSection = result.userMenu.find(s => s.id === 'core.account')
      expect(accountSection).toBeDefined()
      expect(accountSection?.items.some(i => i.id === 'core.profile')).toBe(true)
      expect(accountSection?.items.some(i => i.id === 'core.settings')).toBe(true)
    })

    it('does not include privileged links (admin, team, etc.)', () => {
      const result = createMinimalNavModel()

      // Check main nav doesn't have admin link
      const hasAdminInMain = result.main.some(section =>
        section.items.some(item => item.id === 'core.admin' || item.href?.includes('/admin'))
      )
      expect(hasAdminInMain).toBe(false)

      // Check user menu doesn't have team or admin panel
      const hasTeam = result.userMenu.some(section =>
        section.items.some(item => item.id === 'core.team')
      )
      expect(hasTeam).toBe(false)

      const hasAdminPanel = result.userMenu.some(section =>
        section.items.some(item => item.id === 'core.admin.panel')
      )
      expect(hasAdminPanel).toBe(false)
    })
  })

  describe('createDefaultNavModel', () => {
    const guestContext: NavContext = {
      userRole: null,
      entitlements: new Set(),
      tenantId: null,
      tierLevel: 0,
      hasMultipleTenants: false,
    }

    const userContext: NavContext = {
      userRole: 'user',
      entitlements: new Set(),
      tenantId: 'tenant-1',
      tierLevel: 0,
      hasMultipleTenants: false,
    }

    const adminContext: NavContext = {
      userRole: 'admin',
      entitlements: new Set(['admin']),
      tenantId: 'tenant-1',
      tierLevel: 1,
      hasMultipleTenants: false,
    }

    it('returns empty nav for guest', () => {
      const result = createDefaultNavModel(guestContext)

      expect(result.main).toHaveLength(0)
      expect(result.admin).toHaveLength(0)
      expect(result.userMenu).toHaveLength(0)
    })

    it('returns main nav for authenticated user', () => {
      const result = createDefaultNavModel(userContext)

      expect(result.main).toHaveLength(1)
      expect(result.main[0].items.some(i => i.id === 'core.dashboard')).toBe(true)
    })

    it('returns admin nav for admin user', () => {
      const result = createDefaultNavModel(adminContext)

      expect(result.admin).toHaveLength(1)
      expect(result.admin[0].items.some(i => i.id === 'core.admin.dashboard')).toBe(true)
      expect(result.admin[0].items.some(i => i.id === 'core.admin.users')).toBe(true)
    })

    it('includes team item for paid tier with tenant', () => {
      const paidUserContext: NavContext = {
        ...userContext,
        tierLevel: 1,
      }

      const result = createDefaultNavModel(paidUserContext)

      const accountSection = result.userMenu.find(s => s.id === 'core.account')
      expect(accountSection?.items.some(i => i.id === 'core.team')).toBe(true)
    })

    it('excludes team item for free tier', () => {
      const result = createDefaultNavModel(userContext)

      const accountSection = result.userMenu.find(s => s.id === 'core.account')
      expect(accountSection?.items.some(i => i.id === 'core.team')).toBe(false)
    })

    it('includes admin panel in user menu for admins', () => {
      const result = createDefaultNavModel(adminContext)

      const adminMenuSection = result.userMenu.find(s => s.id === 'core.admin.menu')
      expect(adminMenuSection).toBeDefined()
      expect(adminMenuSection?.items.some(i => i.id === 'core.admin.panel')).toBe(true)
    })
  })

  describe('buildClientNavModel', () => {
    const baseNav: NavModel = {
      main: [],
      admin: [],
      userMenu: [
        {
          id: 'core.account',
          label: 'Account',
          items: [{ id: 'core.profile', label: 'Profile', href: '/profile' }],
        },
      ],
    }

    const context: NavContext = {
      userRole: 'user',
      entitlements: new Set(),
      tenantId: 'tenant-1',
      tierLevel: 0,
      hasMultipleTenants: false,
    }

    it('builds nav model with icons', () => {
      const result = buildClientNavModel({ baseNav, context })

      expect(result.main).toBeDefined()
      expect(result.admin).toBeDefined()
      expect(result.userMenu).toBeDefined()
    })

    it('adds mandatory items (logout)', () => {
      const result = buildClientNavModel({ baseNav, context })

      const accountSection = result.userMenu.find(s => s.id === 'core.account')
      expect(accountSection?.items.some(i => i.id === 'core.logout')).toBe(true)
    })

    it('binds onClick handlers', () => {
      const logoutHandler = vi.fn()
      const result = buildClientNavModel({
        baseNav,
        context,
        onClickHandlers: { logout: logoutHandler },
      })

      const accountSection = result.userMenu.find(s => s.id === 'core.account')
      const logoutItem = accountSection?.items.find(i => i.id === 'core.logout')
      expect(logoutItem?.onClick).toBe(logoutHandler)
    })

    it('applies permission filtering', () => {
      const navWithRestricted: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          {
            id: 'core.account',
            label: 'Account',
            items: [
              { id: 'core.profile', label: 'Profile', href: '/profile' },
              {
                id: 'core.admin',
                label: 'Admin',
                href: '/admin',
                requires: { capability: 'admin' },
              },
            ],
          },
        ],
      }

      const result = buildClientNavModel({ baseNav: navWithRestricted, context })

      const accountSection = result.userMenu.find(s => s.id === 'core.account')
      // Admin item should be filtered out for non-admin user
      expect(accountSection?.items.some(i => i.id === 'core.admin')).toBe(false)
    })

    it('skips permission filtering when requested', () => {
      const navWithRestricted: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          {
            id: 'core.account',
            label: 'Account',
            items: [
              {
                id: 'core.admin',
                label: 'Admin',
                href: '/admin',
                requires: { capability: 'admin' },
              },
            ],
          },
        ],
      }

      const result = buildClientNavModel({
        baseNav: navWithRestricted,
        context,
        skipPermissionFilter: true,
      })

      const accountSection = result.userMenu.find(s => s.id === 'core.account')
      // Admin item should NOT be filtered out when skipPermissionFilter is true
      expect(accountSection?.items.some(i => i.id === 'core.admin')).toBe(true)
    })

    it('returns empty model on error', () => {
      // Create an invalid baseNav that would cause errors
      const invalidNav = null as unknown as NavModel

      const result = buildClientNavModel({
        baseNav: invalidNav,
        context,
      })

      // Should return empty model without throwing
      expect(result.main).toEqual([])
      expect(result.admin).toEqual([])
      expect(result.userMenu).toEqual([])
    })
  })
})

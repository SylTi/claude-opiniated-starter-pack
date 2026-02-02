import { describe, it, expect, beforeEach } from 'vitest'
import {
  sortSections,
  sortItems,
  ensureMandatoryItems,
  applyPermissionFilter,
  applySorting,
  createEmptyNavModel,
  mergeNavModels,
} from '../src/navigation/nav_builder.js'
import type { NavItem, NavSection, NavModel, NavContext } from '../src/types/navigation.js'
import { MANDATORY_ITEMS, OPTIONAL_MANDATORY_ITEMS } from '../src/types/navigation.js'

describe('nav_builder', () => {
  describe('sortSections', () => {
    it('sorts sections by order (ascending)', () => {
      const sections: NavSection[] = [
        { id: 'c', order: 300, items: [] },
        { id: 'a', order: 100, items: [] },
        { id: 'b', order: 200, items: [] },
      ]

      const sorted = sortSections(sections)

      expect(sorted.map(s => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('uses default order (1000) for sections without order', () => {
      const sections: NavSection[] = [
        { id: 'a', items: [] }, // No order, defaults to 1000
        { id: 'b', order: 500, items: [] },
      ]

      const sorted = sortSections(sections)

      expect(sorted.map(s => s.id)).toEqual(['b', 'a'])
    })

    it('does not mutate original array', () => {
      const sections: NavSection[] = [
        { id: 'b', order: 200, items: [] },
        { id: 'a', order: 100, items: [] },
      ]

      const sorted = sortSections(sections)

      expect(sections[0].id).toBe('b')
      expect(sorted[0].id).toBe('a')
    })

    it('uses id as tiebreaker when orders are equal', () => {
      const sections: NavSection[] = [
        { id: 'zebra', order: 100, items: [] },
        { id: 'alpha', order: 100, items: [] },
        { id: 'beta', order: 100, items: [] },
      ]

      const sorted = sortSections(sections)

      // Should sort by id alphabetically when orders match
      expect(sorted.map(s => s.id)).toEqual(['alpha', 'beta', 'zebra'])
    })
  })

  describe('sortItems', () => {
    it('sorts items by order (ascending)', () => {
      const items: NavItem[] = [
        { id: 'c', label: 'C', href: '/c', order: 300 },
        { id: 'a', label: 'A', href: '/a', order: 100 },
        { id: 'b', label: 'B', href: '/b', order: 200 },
      ]

      const sorted = sortItems(items)

      expect(sorted.map(i => i.id)).toEqual(['a', 'b', 'c'])
    })

    it('uses id as tiebreaker when orders are equal', () => {
      const items: NavItem[] = [
        { id: 'zebra', label: 'Zebra', href: '/z', order: 100 },
        { id: 'alpha', label: 'Alpha', href: '/a', order: 100 },
        { id: 'beta', label: 'Beta', href: '/b', order: 100 },
      ]

      const sorted = sortItems(items)

      // Should sort by id alphabetically when orders match
      expect(sorted.map(i => i.id)).toEqual(['alpha', 'beta', 'zebra'])
    })
  })

  describe('ensureMandatoryItems', () => {
    const baseContext: NavContext = {
      userRole: 'user',
      entitlements: new Set(),
      tenantId: 'tenant-1',
      tierLevel: 1,
      hasMultipleTenants: false,
    }

    it('adds logout if missing', () => {
      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          { id: 'core.account', items: [] },
        ],
      }

      const result = ensureMandatoryItems(nav, baseContext)

      const logoutItem = result.userMenu
        .flatMap(s => s.items)
        .find(i => i.id === MANDATORY_ITEMS['core.logout'])

      expect(logoutItem).toBeDefined()
      expect(logoutItem?.label).toBe('Log out')
    })

    it('does not duplicate logout if present', () => {
      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          {
            id: 'core.account',
            items: [
              { id: MANDATORY_ITEMS['core.logout'], label: 'Sign out', href: '#', onClick: 'logout' },
            ],
          },
        ],
      }

      const result = ensureMandatoryItems(nav, baseContext)

      const logoutItems = result.userMenu
        .flatMap(s => s.items)
        .filter(i => i.id === MANDATORY_ITEMS['core.logout'])

      expect(logoutItems).toHaveLength(1)
      expect(logoutItems[0].label).toBe('Sign out') // Keep original
    })

    it('adds switch tenant if user has multiple tenants', () => {
      const contextWithMultipleTenants: NavContext = {
        ...baseContext,
        hasMultipleTenants: true,
      }

      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          { id: 'core.account', items: [] },
        ],
      }

      const result = ensureMandatoryItems(nav, contextWithMultipleTenants)

      const switchItem = result.userMenu
        .flatMap(s => s.items)
        .find(i => i.id === MANDATORY_ITEMS['core.switchTenant'])

      expect(switchItem).toBeDefined()
      expect(switchItem?.label).toBe('Switch Organization')
    })

    it('does not add switch tenant if user has single tenant', () => {
      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          { id: 'core.account', items: [] },
        ],
      }

      const result = ensureMandatoryItems(nav, baseContext)

      const switchItem = result.userMenu
        .flatMap(s => s.items)
        .find(i => i.id === MANDATORY_ITEMS['core.switchTenant'])

      expect(switchItem).toBeUndefined()
    })

    it('adds core.profile for authenticated users if missing', () => {
      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          { id: 'core.account', items: [] },
        ],
      }

      const result = ensureMandatoryItems(nav, baseContext)

      const profileItem = result.userMenu
        .flatMap(s => s.items)
        .find(i => i.id === OPTIONAL_MANDATORY_ITEMS['core.profile'])

      expect(profileItem).toBeDefined()
      expect(profileItem?.label).toBe('Profile')
    })

    it('does not add core.profile for guest users', () => {
      const guestContext: NavContext = {
        ...baseContext,
        userRole: 'guest',
      }

      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          { id: 'core.account', items: [] },
        ],
      }

      const result = ensureMandatoryItems(nav, guestContext)

      const profileItem = result.userMenu
        .flatMap(s => s.items)
        .find(i => i.id === OPTIONAL_MANDATORY_ITEMS['core.profile'])

      expect(profileItem).toBeUndefined()
    })

    it('adds core.adminDashboard for admin users if missing', () => {
      const adminContext: NavContext = {
        ...baseContext,
        userRole: 'admin',
      }

      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          { id: 'core.account', items: [] },
        ],
      }

      const result = ensureMandatoryItems(nav, adminContext)

      const adminItem = result.userMenu
        .flatMap(s => s.items)
        .find(i => i.id === OPTIONAL_MANDATORY_ITEMS['core.adminDashboard'])

      expect(adminItem).toBeDefined()
      expect(adminItem?.label).toBe('Admin Dashboard')
    })

    it('adds core.adminDashboard if user has admin entitlement', () => {
      const userWithAdminEntitlement: NavContext = {
        ...baseContext,
        userRole: 'user',
        entitlements: new Set(['admin']),
      }

      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          { id: 'core.account', items: [] },
        ],
      }

      const result = ensureMandatoryItems(nav, userWithAdminEntitlement)

      const adminItem = result.userMenu
        .flatMap(s => s.items)
        .find(i => i.id === OPTIONAL_MANDATORY_ITEMS['core.adminDashboard'])

      expect(adminItem).toBeDefined()
    })

    it('does not add core.adminDashboard for regular users', () => {
      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          { id: 'core.account', items: [] },
        ],
      }

      const result = ensureMandatoryItems(nav, baseContext)

      const adminItem = result.userMenu
        .flatMap(s => s.items)
        .find(i => i.id === OPTIONAL_MANDATORY_ITEMS['core.adminDashboard'])

      expect(adminItem).toBeUndefined()
    })

    it('does not duplicate optional mandatory items if present', () => {
      const nav: NavModel = {
        main: [],
        admin: [],
        userMenu: [
          {
            id: 'core.account',
            items: [
              { id: OPTIONAL_MANDATORY_ITEMS['core.profile'], label: 'My Profile', href: '/my-profile' },
            ],
          },
        ],
      }

      const result = ensureMandatoryItems(nav, baseContext)

      const profileItems = result.userMenu
        .flatMap(s => s.items)
        .filter(i => i.id === OPTIONAL_MANDATORY_ITEMS['core.profile'])

      expect(profileItems).toHaveLength(1)
      expect(profileItems[0].label).toBe('My Profile') // Keep original
    })
  })

  describe('applyPermissionFilter', () => {
    it('removes items without required permission', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [
              { id: 'public', label: 'Public', href: '/public' },
              { id: 'admin', label: 'Admin', href: '/admin', requiredPermission: 'admin' },
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      const result = applyPermissionFilter(nav, new Set())

      expect(result.main[0].items.map(i => i.id)).toEqual(['public'])
    })

    it('keeps items when user has permission', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [
              { id: 'admin', label: 'Admin', href: '/admin', requiredPermission: 'admin' },
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      const result = applyPermissionFilter(nav, new Set(['admin']))

      expect(result.main[0].items.map(i => i.id)).toEqual(['admin'])
    })

    it('removes entire section if all items are filtered', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'core.admin',
            items: [
              { id: 'admin', label: 'Admin', href: '/admin', requiredPermission: 'admin' },
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      const result = applyPermissionFilter(nav, new Set())

      expect(result.main).toHaveLength(0)
    })

    it('removes section if section has required permission user lacks', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'core.admin',
            requiredPermission: 'admin',
            items: [
              { id: 'users', label: 'Users', href: '/admin/users' },
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      const result = applyPermissionFilter(nav, new Set())

      expect(result.main).toHaveLength(0)
    })

    it('filters items by requires.capability (new pattern)', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [
              { id: 'public', label: 'Public', href: '/public' },
              { id: 'admin', label: 'Admin', href: '/admin', requires: { capability: 'admin' } },
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      const result = applyPermissionFilter(nav, new Set())

      expect(result.main[0].items.map(i => i.id)).toEqual(['public'])
    })

    it('filters items by requires.ability when abilities map is provided', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [
              { id: 'public', label: 'Public', href: '/public' },
              { id: 'secret', label: 'Secret', href: '/secret', requires: { ability: 'view:secret' } },
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      // User doesn't have the ability
      const abilities = new Map([['view:secret', false]])
      const result = applyPermissionFilter(nav, new Set(), abilities)

      expect(result.main[0].items.map(i => i.id)).toEqual(['public'])
    })

    it('shows items when user has required ability', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [
              { id: 'secret', label: 'Secret', href: '/secret', requires: { ability: 'view:secret' } },
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      // User has the ability
      const abilities = new Map([['view:secret', true]])
      const result = applyPermissionFilter(nav, new Set(), abilities)

      expect(result.main[0].items.map(i => i.id)).toEqual(['secret'])
    })

    it('fails closed for ability checks when no abilities map is provided', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [
              { id: 'secret', label: 'Secret', href: '/secret', requires: { ability: 'view:secret' } },
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      // No abilities map - should fail closed and hide the item
      // SECURITY: Fail-closed prevents unauthorized feature discovery
      const result = applyPermissionFilter(nav, new Set())

      // Section should be empty (removed) since no items remain after filtering
      expect(result.main).toHaveLength(0)
    })

    it('checks both capability and ability for the same item', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [
              {
                id: 'restricted',
                label: 'Restricted',
                href: '/restricted',
                requires: { capability: 'premium', ability: 'view:restricted' },
              },
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      // Has capability but not ability
      const abilities1 = new Map([['view:restricted', false]])
      const result1 = applyPermissionFilter(nav, new Set(['premium']), abilities1)
      expect(result1.main).toHaveLength(0) // Section removed because item was filtered

      // Has ability but not capability
      const abilities2 = new Map([['view:restricted', true]])
      const result2 = applyPermissionFilter(nav, new Set(), abilities2)
      expect(result2.main).toHaveLength(0)

      // Has both
      const abilities3 = new Map([['view:restricted', true]])
      const result3 = applyPermissionFilter(nav, new Set(['premium']), abilities3)
      expect(result3.main[0].items.map(i => i.id)).toEqual(['restricted'])
    })
  })

  describe('applySorting', () => {
    it('sorts sections and items in all areas', () => {
      const nav: NavModel = {
        main: [
          {
            id: 'second',
            order: 200,
            items: [
              { id: 'b', label: 'B', href: '/b', order: 200 },
              { id: 'a', label: 'A', href: '/a', order: 100 },
            ],
          },
          { id: 'first', order: 100, items: [] },
        ],
        admin: [],
        userMenu: [],
      }

      const result = applySorting(nav)

      expect(result.main.map(s => s.id)).toEqual(['first', 'second'])
      expect(result.main[1].items.map(i => i.id)).toEqual(['a', 'b'])
    })
  })

  describe('createEmptyNavModel', () => {
    it('creates empty model with all areas', () => {
      const model = createEmptyNavModel()

      expect(model.main).toEqual([])
      expect(model.admin).toEqual([])
      expect(model.userMenu).toEqual([])
    })
  })

  describe('mergeNavModels', () => {
    it('appends items to existing sections', () => {
      const base: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [{ id: 'a', label: 'A', href: '/a' }],
          },
        ],
        admin: [],
        userMenu: [],
      }

      const additions: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [{ id: 'b', label: 'B', href: '/b' }],
          },
        ],
        admin: [],
        userMenu: [],
      }

      const result = mergeNavModels(base, additions)

      expect(result.main[0].items.map(i => i.id)).toEqual(['a', 'b'])
    })

    it('adds new sections', () => {
      const base: NavModel = {
        main: [
          { id: 'core.main', items: [] },
        ],
        admin: [],
        userMenu: [],
      }

      const additions: NavModel = {
        main: [
          { id: 'plugin.section', items: [{ id: 'x', label: 'X', href: '/x' }] },
        ],
        admin: [],
        userMenu: [],
      }

      const result = mergeNavModels(base, additions)

      expect(result.main.map(s => s.id)).toEqual(['core.main', 'plugin.section'])
    })

    it('does not mutate original models', () => {
      const base: NavModel = {
        main: [{ id: 'a', items: [] }],
        admin: [],
        userMenu: [],
      }

      const additions: NavModel = {
        main: [{ id: 'b', items: [] }],
        admin: [],
        userMenu: [],
      }

      mergeNavModels(base, additions)

      expect(base.main.map(s => s.id)).toEqual(['a'])
    })
  })
})

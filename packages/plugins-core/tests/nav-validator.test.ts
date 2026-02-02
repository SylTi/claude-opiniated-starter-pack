import { describe, it, expect } from 'vitest'
import {
  validateNavItem,
  validateNavSection,
  validateNavModel,
  assertNoIdCollisions,
  validateReservedIds,
  isReservedSectionId,
} from '../src/navigation/nav_validator.js'
import type { NavItem, NavSection, NavModel } from '../src/types/navigation.js'

describe('nav_validator', () => {
  describe('validateNavItem', () => {
    it('validates a valid nav item', () => {
      const item: NavItem = {
        id: 'core.dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'LayoutDashboard',
      }

      const result = validateNavItem(item)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('requires id field', () => {
      const item = {
        label: 'Dashboard',
        href: '/dashboard',
      } as NavItem

      const result = validateNavItem(item)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('NavItem must have a string id')
    })

    it('requires label field', () => {
      const item: NavItem = {
        id: 'core.dashboard',
        label: '',
        href: '/dashboard',
      }

      const result = validateNavItem(item)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('label is required'))).toBe(true)
    })

    it('requires href or onClick', () => {
      const item = {
        id: 'core.dashboard',
        label: 'Dashboard',
      } as NavItem

      const result = validateNavItem(item)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('href or onClick'))).toBe(true)
    })

    it('accepts onClick without href', () => {
      const item: NavItem = {
        id: 'core.logout',
        label: 'Logout',
        href: '#',
        onClick: 'logout',
      }

      const result = validateNavItem(item)

      expect(result.valid).toBe(true)
    })

    it('warns about non-dot-notation ids', () => {
      const item: NavItem = {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
      }

      const result = validateNavItem(item)

      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('dot notation'))).toBe(true)
    })
  })

  describe('validateNavSection', () => {
    it('validates a valid section', () => {
      const section: NavSection = {
        id: 'core.main',
        label: 'Main',
        items: [
          { id: 'core.dashboard', label: 'Dashboard', href: '/dashboard' },
        ],
      }

      const result = validateNavSection(section)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('requires id field', () => {
      const section = {
        label: 'Main',
        items: [],
      } as unknown as NavSection

      const result = validateNavSection(section)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('NavSection must have a string id')
    })

    it('requires items to be an array', () => {
      const section = {
        id: 'core.main',
        items: 'not an array',
      } as unknown as NavSection

      const result = validateNavSection(section)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('items must be an array'))).toBe(true)
    })

    it('validates nested items', () => {
      const section: NavSection = {
        id: 'core.main',
        items: [
          { id: '', label: 'Dashboard', href: '/dashboard' },
        ],
      }

      const result = validateNavSection(section)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('must have a string id'))).toBe(true)
    })
  })

  describe('assertNoIdCollisions', () => {
    it('passes with unique ids', () => {
      const model: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [{ id: 'core.dashboard', label: 'Dashboard', href: '/dashboard' }],
          },
        ],
        admin: [
          {
            id: 'core.admin',
            items: [{ id: 'core.admin.users', label: 'Users', href: '/admin/users' }],
          },
        ],
        userMenu: [],
      }

      expect(() => assertNoIdCollisions(model)).not.toThrow()
    })

    it('throws on duplicate section ids', () => {
      const model: NavModel = {
        main: [
          { id: 'core.main', items: [] },
        ],
        admin: [
          { id: 'core.main', items: [] }, // Duplicate!
        ],
        userMenu: [],
      }

      expect(() => assertNoIdCollisions(model)).toThrow(/duplicated/)
    })

    it('throws on duplicate item ids', () => {
      const model: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [
              { id: 'core.dashboard', label: 'Dashboard', href: '/dashboard' },
              { id: 'core.dashboard', label: 'Dashboard 2', href: '/dashboard2' }, // Duplicate!
            ],
          },
        ],
        admin: [],
        userMenu: [],
      }

      expect(() => assertNoIdCollisions(model)).toThrow(/duplicated/)
    })
  })

  describe('isReservedSectionId', () => {
    it('recognizes reserved section ids', () => {
      expect(isReservedSectionId('core.account')).toBe(true)
      expect(isReservedSectionId('core.settings')).toBe(true)
      expect(isReservedSectionId('core.admin')).toBe(true)
      expect(isReservedSectionId('core.billing')).toBe(true)
    })

    it('rejects non-reserved section ids', () => {
      expect(isReservedSectionId('core.main')).toBe(false)
      expect(isReservedSectionId('plugin.section')).toBe(false)
      expect(isReservedSectionId('random')).toBe(false)
    })
  })

  describe('validateReservedIds', () => {
    it('allows main-app to create reserved sections', () => {
      const sections: NavSection[] = [
        { id: 'core.account', items: [] },
      ]

      const result = validateReservedIds(sections, new Set(), 'main-app')

      expect(result.valid).toBe(true)
    })

    it('prevents plugins from creating reserved sections', () => {
      const sections: NavSection[] = [
        { id: 'core.account', items: [] },
      ]

      const result = validateReservedIds(sections, new Set(), 'other-plugin')

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('cannot create reserved section'))).toBe(true)
    })

    it('prevents plugins from creating core items', () => {
      const sections: NavSection[] = [
        {
          id: 'plugin.section',
          items: [{ id: 'core.forbidden', label: 'Forbidden', href: '/forbidden' }],
        },
      ]

      const result = validateReservedIds(sections, new Set(), 'other-plugin')

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('cannot create item with core ID'))).toBe(true)
    })
  })

  describe('validateNavModel', () => {
    it('validates a complete nav model', () => {
      const model: NavModel = {
        main: [
          {
            id: 'core.main',
            items: [{ id: 'core.dashboard', label: 'Dashboard', href: '/dashboard' }],
          },
        ],
        admin: [],
        userMenu: [
          {
            id: 'core.account',
            items: [{ id: 'core.profile', label: 'Profile', href: '/profile' }],
          },
        ],
      }

      const result = validateNavModel(model)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('catches errors in all areas', () => {
      const model: NavModel = {
        main: [{ id: '', items: [] }],
        admin: [{ id: 'admin', items: [{ id: '', label: 'X', href: '/x' }] }],
        userMenu: [],
      }

      const result = validateNavModel(model)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})

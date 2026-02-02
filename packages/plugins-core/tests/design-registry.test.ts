import { describe, it, expect, beforeEach } from 'vitest'
import {
  designRegistry,
  DesignRegistrationError,
  DesignNotRegisteredError,
} from '../src/registry/design_registry.js'
import type { AppDesign, NavModel, NavContext, ThemeTokens } from '../src/types/index.js'

describe('design_registry', () => {
  // Clear registry before each test
  beforeEach(() => {
    designRegistry.clear()
  })

  // Mock AppShell component for testing
  const MockAppShell = (): unknown => null

  const createMockDesign = (id: string = 'test-design'): AppDesign => ({
    designId: id,
    displayName: 'Test Design',
    appTokens: (): ThemeTokens => ({
      cssVars: {
        '--color-primary': '#000',
      },
      colorPrimary: '#000',
    }),
    navBaseline: (): NavModel => ({
      main: [],
      admin: [],
      userMenu: [],
    }),
    AppShell: MockAppShell,
  })

  describe('register', () => {
    it('registers a valid design', () => {
      const design = createMockDesign()

      designRegistry.register(design)

      expect(designRegistry.has()).toBe(true)
      expect(designRegistry.getDesignId()).toBe('test-design')
    })

    it('throws if design is already registered', () => {
      const design1 = createMockDesign('design-1')
      const design2 = createMockDesign('design-2')

      designRegistry.register(design1)

      expect(() => designRegistry.register(design2)).toThrow(DesignRegistrationError)
    })

    it('throws for invalid design object', () => {
      const invalidDesign = {
        designId: 'test',
        // Missing required methods
      }

      expect(() => designRegistry.register(invalidDesign as AppDesign)).toThrow(DesignRegistrationError)
    })

    it('throws for design missing designId', () => {
      const invalidDesign = {
        displayName: 'Test',
        appTokens: () => ({ cssVars: {} }),
        navBaseline: () => ({ main: [], admin: [], userMenu: [] }),
        AppShell: MockAppShell,
      }

      expect(() => designRegistry.register(invalidDesign as AppDesign)).toThrow(DesignRegistrationError)
    })

    it('throws for design missing appTokens function', () => {
      const invalidDesign = {
        designId: 'test',
        displayName: 'Test',
        navBaseline: () => ({ main: [], admin: [], userMenu: [] }),
        AppShell: MockAppShell,
      }

      expect(() => designRegistry.register(invalidDesign as AppDesign)).toThrow(DesignRegistrationError)
    })

    it('throws for design missing navBaseline function', () => {
      const invalidDesign = {
        designId: 'test',
        displayName: 'Test',
        appTokens: () => ({ cssVars: {} }),
        AppShell: MockAppShell,
      }

      expect(() => designRegistry.register(invalidDesign as AppDesign)).toThrow(DesignRegistrationError)
    })

    it('throws for design missing AppShell', () => {
      const invalidDesign = {
        designId: 'test',
        displayName: 'Test',
        appTokens: () => ({ cssVars: {} }),
        navBaseline: () => ({ main: [], admin: [], userMenu: [] }),
      }

      expect(() => designRegistry.register(invalidDesign as AppDesign)).toThrow(DesignRegistrationError)
    })

    it('calls onRegister if defined', () => {
      let called = false
      const design: AppDesign = {
        ...createMockDesign(),
        onRegister: () => {
          called = true
        },
      }

      designRegistry.register(design)

      expect(called).toBe(true)
    })
  })

  describe('get', () => {
    it('returns registered design', () => {
      const design = createMockDesign()
      designRegistry.register(design)

      const retrieved = designRegistry.get()

      expect(retrieved.designId).toBe('test-design')
    })

    it('throws if no design registered', () => {
      expect(() => designRegistry.get()).toThrow(DesignNotRegisteredError)
    })
  })

  describe('has', () => {
    it('returns false when no design registered', () => {
      expect(designRegistry.has()).toBe(false)
    })

    it('returns true after registration', () => {
      designRegistry.register(createMockDesign())

      expect(designRegistry.has()).toBe(true)
    })
  })

  describe('getDesignId', () => {
    it('returns null when no design registered', () => {
      expect(designRegistry.getDesignId()).toBeNull()
    })

    it('returns design id after registration', () => {
      designRegistry.register(createMockDesign('my-design'))

      expect(designRegistry.getDesignId()).toBe('my-design')
    })
  })

  describe('getRegisteredAt', () => {
    it('returns null when no design registered', () => {
      expect(designRegistry.getRegisteredAt()).toBeNull()
    })

    it('returns timestamp after registration', () => {
      const before = new Date()
      designRegistry.register(createMockDesign())
      const after = new Date()

      const registeredAt = designRegistry.getRegisteredAt()

      expect(registeredAt).not.toBeNull()
      expect(registeredAt!.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(registeredAt!.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  describe('clear', () => {
    it('clears registered design', () => {
      designRegistry.register(createMockDesign())
      expect(designRegistry.has()).toBe(true)

      designRegistry.clear()

      expect(designRegistry.has()).toBe(false)
      expect(designRegistry.getDesignId()).toBeNull()
      expect(designRegistry.getRegisteredAt()).toBeNull()
    })

    it('allows re-registration after clear', () => {
      designRegistry.register(createMockDesign('first'))
      designRegistry.clear()

      designRegistry.register(createMockDesign('second'))

      expect(designRegistry.getDesignId()).toBe('second')
    })
  })
})

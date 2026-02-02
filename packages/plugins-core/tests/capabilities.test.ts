import { describe, it, expect } from 'vitest'
import {
  validateCapabilitiesForTier,
  isValidCapability,
  TIER_A_CAPABILITIES,
  TIER_B_CAPABILITIES,
  MAIN_APP_CAPABILITIES,
  PLUGIN_CAPABILITIES,
} from '../src/types/capabilities.js'

describe('capabilities', () => {
  describe('validateCapabilitiesForTier', () => {
    describe('tier A', () => {
      it('allows tier A capabilities', () => {
        const result = validateCapabilitiesForTier('A', [
          PLUGIN_CAPABILITIES['ui:filter:nav'],
          PLUGIN_CAPABILITIES['ui:filter:dashboard'],
        ])

        expect(result.valid).toBe(true)
        expect(result.invalidCapabilities).toHaveLength(0)
      })

      it('rejects tier B capabilities', () => {
        const result = validateCapabilitiesForTier('A', [
          PLUGIN_CAPABILITIES['app:routes'],
        ])

        expect(result.valid).toBe(false)
        expect(result.invalidCapabilities).toContain(PLUGIN_CAPABILITIES['app:routes'])
      })

      it('rejects main-app capabilities', () => {
        const result = validateCapabilitiesForTier('A', [
          PLUGIN_CAPABILITIES['ui:design:global'],
        ])

        expect(result.valid).toBe(false)
        expect(result.invalidCapabilities).toContain(PLUGIN_CAPABILITIES['ui:design:global'])
      })
    })

    describe('tier B', () => {
      it('allows tier A capabilities', () => {
        const result = validateCapabilitiesForTier('B', [
          PLUGIN_CAPABILITIES['ui:filter:nav'],
        ])

        expect(result.valid).toBe(true)
      })

      it('allows tier B capabilities', () => {
        const result = validateCapabilitiesForTier('B', [
          PLUGIN_CAPABILITIES['app:routes'],
          PLUGIN_CAPABILITIES['app:db:read'],
          PLUGIN_CAPABILITIES['app:db:write'],
        ])

        expect(result.valid).toBe(true)
        expect(result.invalidCapabilities).toHaveLength(0)
      })

      it('rejects main-app capabilities', () => {
        const result = validateCapabilitiesForTier('B', [
          PLUGIN_CAPABILITIES['ui:design:global'],
        ])

        expect(result.valid).toBe(false)
        expect(result.invalidCapabilities).toContain(PLUGIN_CAPABILITIES['ui:design:global'])
      })
    })

    describe('tier main-app', () => {
      it('allows tier A capabilities', () => {
        const result = validateCapabilitiesForTier('main-app', [
          PLUGIN_CAPABILITIES['ui:filter:nav'],
        ])

        expect(result.valid).toBe(true)
      })

      it('allows main-app capabilities', () => {
        const result = validateCapabilitiesForTier('main-app', [
          PLUGIN_CAPABILITIES['ui:design:global'],
          PLUGIN_CAPABILITIES['ui:nav:baseline'],
        ])

        expect(result.valid).toBe(true)
        expect(result.invalidCapabilities).toHaveLength(0)
      })

      it('rejects tier B capabilities', () => {
        const result = validateCapabilitiesForTier('main-app', [
          PLUGIN_CAPABILITIES['app:routes'],
        ])

        expect(result.valid).toBe(false)
        expect(result.invalidCapabilities).toContain(PLUGIN_CAPABILITIES['app:routes'])
      })
    })
  })

  describe('isValidCapability', () => {
    it('returns true for valid capabilities', () => {
      expect(isValidCapability('ui:filter:nav')).toBe(true)
      expect(isValidCapability('app:routes')).toBe(true)
      expect(isValidCapability('ui:design:global')).toBe(true)
      expect(isValidCapability('ui:nav:baseline')).toBe(true)
    })

    it('returns false for invalid capabilities', () => {
      expect(isValidCapability('invalid')).toBe(false)
      expect(isValidCapability('ui:invalid')).toBe(false)
      expect(isValidCapability('')).toBe(false)
    })
  })

  describe('capability arrays', () => {
    it('TIER_A_CAPABILITIES contains only UI capabilities', () => {
      for (const cap of TIER_A_CAPABILITIES) {
        expect(cap.startsWith('ui:')).toBe(true)
      }
    })

    it('TIER_B_CAPABILITIES contains only app capabilities', () => {
      for (const cap of TIER_B_CAPABILITIES) {
        expect(cap.startsWith('app:')).toBe(true)
      }
    })

    it('MAIN_APP_CAPABILITIES contains design and nav baseline', () => {
      expect(MAIN_APP_CAPABILITIES).toContain('ui:design:global')
      expect(MAIN_APP_CAPABILITIES).toContain('ui:nav:baseline')
    })
  })
})

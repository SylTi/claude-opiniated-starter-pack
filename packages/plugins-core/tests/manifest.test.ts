import { describe, it, expect } from 'vitest'
import { validatePluginManifest, type PluginManifest } from '../src/types/manifest.js'

describe('validatePluginManifest', () => {
  const createBaseManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
    pluginId: 'test-plugin',
    packageName: '@plugins/test',
    version: '1.0.0',
    tier: 'A',
    requestedCapabilities: [],
    ...overrides,
  })

  describe('basic validation', () => {
    it('validates a minimal valid manifest', () => {
      const manifest = createBaseManifest()

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('requires pluginId', () => {
      const manifest = createBaseManifest({ pluginId: '' })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('pluginId'))).toBe(true)
    })

    it('requires packageName', () => {
      const manifest = createBaseManifest({ packageName: '' })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('packageName'))).toBe(true)
    })

    it('requires version', () => {
      const manifest = createBaseManifest({ version: '' })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('version'))).toBe(true)
    })
  })

  describe('tier validation', () => {
    it('accepts tier A', () => {
      const manifest = createBaseManifest({ tier: 'A' })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('accepts tier B', () => {
      const manifest = createBaseManifest({ tier: 'B' })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('accepts tier main-app', () => {
      const manifest = createBaseManifest({
        tier: 'main-app',
        requestedCapabilities: [
          { capability: 'ui:design:global', reason: 'Global theme' },
        ],
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('rejects invalid tier', () => {
      const manifest = createBaseManifest({ tier: 'C' as 'A' })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('tier must be'))).toBe(true)
    })
  })

  describe('tier A restrictions', () => {
    it('rejects routePrefix for tier A', () => {
      const manifest = createBaseManifest({
        tier: 'A',
        routePrefix: '/api/v1/apps/test',
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Tier A plugins cannot have routePrefix'))).toBe(true)
    })

    it('rejects tables for tier A', () => {
      const manifest = createBaseManifest({
        tier: 'A',
        tables: [{ name: 'plugin_test_data', hasTenantId: true }],
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Tier A plugins cannot have database tables'))).toBe(true)
    })

    it('rejects migrations for tier A', () => {
      const manifest = createBaseManifest({
        tier: 'A',
        migrations: { dir: 'migrations', schemaVersion: 1 },
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Tier A plugins cannot have migrations'))).toBe(true)
    })

    it('rejects authzNamespace for tier A', () => {
      const manifest = createBaseManifest({
        tier: 'A',
        authzNamespace: 'test.',
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Tier A plugins cannot have authzNamespace'))).toBe(true)
    })
  })

  describe('main-app tier validation', () => {
    it('requires ui:design:global capability', () => {
      const manifest = createBaseManifest({
        tier: 'main-app',
        requestedCapabilities: [], // Missing required capability
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('ui:design:global'))).toBe(true)
    })

    it('rejects routePrefix for main-app', () => {
      const manifest = createBaseManifest({
        tier: 'main-app',
        routePrefix: '/api/v1/apps/main',
        requestedCapabilities: [
          { capability: 'ui:design:global', reason: 'Theme' },
        ],
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('main-app tier cannot have routePrefix'))).toBe(true)
    })

    it('rejects tables for main-app', () => {
      const manifest = createBaseManifest({
        tier: 'main-app',
        tables: [{ name: 'plugin_main_data', hasTenantId: true }],
        requestedCapabilities: [
          { capability: 'ui:design:global', reason: 'Theme' },
        ],
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('main-app tier cannot have database tables'))).toBe(true)
    })

    it('rejects migrations for main-app', () => {
      const manifest = createBaseManifest({
        tier: 'main-app',
        migrations: { dir: 'migrations', schemaVersion: 1 },
        requestedCapabilities: [
          { capability: 'ui:design:global', reason: 'Theme' },
        ],
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('main-app tier cannot have migrations'))).toBe(true)
    })

    it('rejects authzNamespace for main-app', () => {
      const manifest = createBaseManifest({
        tier: 'main-app',
        authzNamespace: 'main.',
        requestedCapabilities: [
          { capability: 'ui:design:global', reason: 'Theme' },
        ],
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('main-app tier cannot have authzNamespace'))).toBe(true)
    })

    it('accepts valid main-app manifest', () => {
      const manifest: PluginManifest = {
        pluginId: 'main-app',
        packageName: '@plugins/main-app',
        version: '1.0.0',
        tier: 'main-app',
        displayName: 'Main Application',
        requestedCapabilities: [
          { capability: 'ui:design:global', reason: 'Theme ownership' },
          { capability: 'ui:nav:baseline', reason: 'Baseline navigation' },
        ],
      }

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('tier B validation', () => {
    it('validates route prefix format', () => {
      const manifest = createBaseManifest({
        tier: 'B',
        pluginId: 'test',
        routePrefix: '/api/v1/other', // Wrong prefix
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('routePrefix must be exactly'))).toBe(true)
    })

    it('accepts correct route prefix', () => {
      const manifest = createBaseManifest({
        tier: 'B',
        pluginId: 'test',
        routePrefix: '/api/v1/apps/test',
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('accepts route prefix subpath', () => {
      const manifest = createBaseManifest({
        tier: 'B',
        pluginId: 'test',
        routePrefix: '/api/v1/apps/test/v2',
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('validates table name prefix', () => {
      const manifest = createBaseManifest({
        tier: 'B',
        pluginId: 'test',
        tables: [{ name: 'wrong_prefix_table', hasTenantId: true }],
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('prefixed with "plugin_test_"'))).toBe(true)
    })

    it('requires hasTenantId on tables', () => {
      const manifest = createBaseManifest({
        tier: 'B',
        pluginId: 'test',
        tables: [{ name: 'plugin_test_data', hasTenantId: false as true }],
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('hasTenantId: true'))).toBe(true)
    })

    it('requires app:authz capability for authzNamespace', () => {
      const manifest = createBaseManifest({
        tier: 'B',
        pluginId: 'test',
        authzNamespace: 'test.',
        requestedCapabilities: [], // Missing app:authz
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('app:authz'))).toBe(true)
    })
  })

  describe('accessControl validation', () => {
    it('accepts valid accessControl with admin role', () => {
      const manifest = createBaseManifest({
        accessControl: { requiredRole: 'admin' },
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('accepts valid accessControl with user role', () => {
      const manifest = createBaseManifest({
        accessControl: { requiredRole: 'user' },
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('accepts valid accessControl with guest role', () => {
      const manifest = createBaseManifest({
        accessControl: { requiredRole: 'guest' },
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('accepts empty accessControl object', () => {
      const manifest = createBaseManifest({
        accessControl: {},
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('accepts manifest without accessControl', () => {
      const manifest = createBaseManifest()

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(true)
    })

    it('rejects invalid requiredRole value', () => {
      const manifest = createBaseManifest({
        accessControl: { requiredRole: 'superadmin' as 'admin' },
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('accessControl.requiredRole must be one of'))).toBe(true)
      expect(result.errors.some(e => e.includes('superadmin'))).toBe(true)
    })

    it('rejects non-object accessControl', () => {
      const manifest = createBaseManifest({
        accessControl: 'admin' as unknown as { requiredRole: 'admin' },
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('accessControl must be a plain object'))).toBe(true)
    })

    it('rejects null accessControl', () => {
      const manifest = createBaseManifest({
        accessControl: null as unknown as { requiredRole: 'admin' },
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('accessControl must be a plain object'))).toBe(true)
    })

    it('rejects array accessControl', () => {
      const manifest = createBaseManifest({
        accessControl: [] as unknown as { requiredRole: 'admin' },
      })

      const result = validatePluginManifest(manifest)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('accessControl must be a plain object'))).toBe(true)
    })
  })
})

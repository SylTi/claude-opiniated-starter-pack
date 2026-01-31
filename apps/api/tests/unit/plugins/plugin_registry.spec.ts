import { test } from '@japa/runner'
import { PluginRegistry } from '@saas/plugins-core'
import type { PluginManifest } from '@saas/plugins-core'

function createTestManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    pluginId: 'test-plugin',
    packageName: '@plugins/test',
    version: '1.0.0',
    tier: 'A',
    requestedCapabilities: [],
    ...overrides,
  }
}

test.group('PluginRegistry - register()', () => {
  test('registers valid manifest', ({ assert }) => {
    const registry = new PluginRegistry()
    const manifest = createTestManifest()

    const result = registry.register(manifest)

    assert.isTrue(result.success)
    assert.equal(result.pluginId, 'test-plugin')
    assert.deepEqual(result.errors, [])
    assert.isTrue(registry.has('test-plugin'))
  })

  test('rejects duplicate plugin ID', ({ assert }) => {
    const registry = new PluginRegistry()
    const manifest = createTestManifest()

    registry.register(manifest)
    const result = registry.register(manifest)

    assert.isFalse(result.success)
    assert.isNotEmpty(result.errors)
    assert.include(result.errors[0], 'already registered')
  })

  test('rejects invalid manifest', ({ assert }) => {
    const registry = new PluginRegistry()
    const manifest = createTestManifest({
      pluginId: '', // Invalid
      tier: 'C' as any, // Invalid
    })

    const result = registry.register(manifest)

    assert.isFalse(result.success)
    assert.isNotEmpty(result.errors)
  })

  test('sets initial status to pending', ({ assert }) => {
    const registry = new PluginRegistry()
    const manifest = createTestManifest()

    registry.register(manifest)
    const state = registry.get('test-plugin')

    assert.equal(state?.status, 'pending')
  })
})

test.group('PluginRegistry - status management', () => {
  test('setStatus updates plugin status', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest())

    registry.setStatus('test-plugin', 'booting')
    assert.equal(registry.get('test-plugin')?.status, 'booting')

    registry.setStatus('test-plugin', 'active')
    assert.equal(registry.get('test-plugin')?.status, 'active')
    assert.isNotNull(registry.get('test-plugin')?.bootedAt)
  })

  test('quarantine sets status and error message', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest())

    registry.quarantine('test-plugin', 'Failed to load')

    const state = registry.get('test-plugin')
    assert.equal(state?.status, 'quarantined')
    assert.equal(state?.errorMessage, 'Failed to load')
  })

  test('setStatus returns false for unknown plugin', ({ assert }) => {
    const registry = new PluginRegistry()

    const result = registry.setStatus('unknown', 'active')
    assert.isFalse(result)
  })
})

test.group('PluginRegistry - capability management', () => {
  test('grantCapabilities stores capabilities', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest())

    registry.grantCapabilities('test-plugin', ['app:routes', 'app:db:read'])

    const state = registry.get('test-plugin')
    assert.deepEqual(state?.grantedCapabilities, ['app:routes', 'app:db:read'])
  })

  test('hasCapability checks for granted capability', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest())
    registry.grantCapabilities('test-plugin', ['app:routes'])

    assert.isTrue(registry.hasCapability('test-plugin', 'app:routes'))
    assert.isFalse(registry.hasCapability('test-plugin', 'app:db:write'))
  })

  test('hasCapability returns false for unknown plugin', ({ assert }) => {
    const registry = new PluginRegistry()

    assert.isFalse(registry.hasCapability('unknown', 'app:routes'))
  })
})

test.group('PluginRegistry - queries', () => {
  test('getAll returns all plugins', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest({ pluginId: 'plugin-a' }))
    registry.register(createTestManifest({ pluginId: 'plugin-b' }))

    const all = registry.getAll()
    assert.equal(all.length, 2)
  })

  test('getByStatus filters by status', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest({ pluginId: 'plugin-a' }))
    registry.register(createTestManifest({ pluginId: 'plugin-b' }))
    registry.setStatus('plugin-a', 'active')

    const active = registry.getByStatus('active')
    assert.equal(active.length, 1)
    assert.equal(active[0].manifest.pluginId, 'plugin-a')
  })

  test('getByTier filters by tier', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest({ pluginId: 'tier-a', tier: 'A' }))
    registry.register(createTestManifest({ pluginId: 'tier-b', tier: 'B' }))

    const tierA = registry.getByTier('A')
    const tierB = registry.getByTier('B')

    assert.equal(tierA.length, 1)
    assert.equal(tierB.length, 1)
    assert.equal(tierA[0].manifest.pluginId, 'tier-a')
    assert.equal(tierB[0].manifest.pluginId, 'tier-b')
  })

  test('getActive returns only active plugins', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest({ pluginId: 'active-one' }))
    registry.register(createTestManifest({ pluginId: 'active-two' }))
    registry.register(createTestManifest({ pluginId: 'pending' }))

    registry.setStatus('active-one', 'active')
    registry.setStatus('active-two', 'active')

    const active = registry.getActive()
    assert.equal(active.length, 2)
  })

  test('getQuarantined returns only quarantined plugins', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest({ pluginId: 'good' }))
    registry.register(createTestManifest({ pluginId: 'bad' }))

    registry.setStatus('good', 'active')
    registry.quarantine('bad', 'Error')

    const quarantined = registry.getQuarantined()
    assert.equal(quarantined.length, 1)
    assert.equal(quarantined[0].manifest.pluginId, 'bad')
  })

  test('getBootOrder returns registration order', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest({ pluginId: 'first' }))
    registry.register(createTestManifest({ pluginId: 'second' }))
    registry.register(createTestManifest({ pluginId: 'third' }))

    const order = registry.getBootOrder()
    assert.deepEqual(order, ['first', 'second', 'third'])
  })
})

test.group('PluginRegistry - unregister', () => {
  test('unregister removes plugin', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest())

    const result = registry.unregister('test-plugin')

    assert.isTrue(result)
    assert.isFalse(registry.has('test-plugin'))
  })

  test('unregister removes from boot order', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest({ pluginId: 'a' }))
    registry.register(createTestManifest({ pluginId: 'b' }))
    registry.register(createTestManifest({ pluginId: 'c' }))

    registry.unregister('b')

    assert.deepEqual(registry.getBootOrder(), ['a', 'c'])
  })

  test('unregister returns false for unknown plugin', ({ assert }) => {
    const registry = new PluginRegistry()

    const result = registry.unregister('unknown')
    assert.isFalse(result)
  })
})

test.group('PluginRegistry - stats', () => {
  test('getStats returns correct counts', ({ assert }) => {
    const registry = new PluginRegistry()
    registry.register(createTestManifest({ pluginId: 'a1', tier: 'A' }))
    registry.register(createTestManifest({ pluginId: 'a2', tier: 'A' }))
    registry.register(createTestManifest({ pluginId: 'b1', tier: 'B' }))

    registry.setStatus('a1', 'active')
    registry.quarantine('a2', 'Error')

    const stats = registry.getStats()

    assert.equal(stats.total, 3)
    assert.equal(stats.active, 1)
    assert.equal(stats.quarantined, 1)
    assert.equal(stats.pending, 1)
    assert.equal(stats.tierA, 2)
    assert.equal(stats.tierB, 1)
  })
})

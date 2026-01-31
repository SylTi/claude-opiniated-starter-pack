import { test } from '@japa/runner'
import { CapabilityEnforcer } from '@saas/plugins-core'
import type { PluginManifest } from '@saas/plugins-core'

test.group('CapabilityEnforcer - check()', () => {
  test('allows granted capability', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const result = enforcer.check('test-plugin', 'app:routes', ['app:routes', 'app:db:read'])

    assert.isTrue(result.allowed)
  })

  test('denies non-granted capability (fail-closed)', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const result = enforcer.check('test-plugin', 'app:routes', ['app:db:read'])

    assert.isFalse(result.allowed)
    assert.include(result.reason!, 'does not have capability')
    assert.deepEqual(result.missingCapabilities, ['app:routes'])
  })

  test('denies unknown capability', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const result = enforcer.check('test-plugin', 'unknown:capability', ['app:routes'])

    assert.isFalse(result.allowed)
    assert.include(result.reason!, 'Unknown capability')
  })

  test('denies with empty granted list (fail-closed)', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const result = enforcer.check('test-plugin', 'app:routes', [])

    assert.isFalse(result.allowed)
  })
})

test.group('CapabilityEnforcer - checkAll()', () => {
  test('allows when all capabilities granted', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const result = enforcer.checkAll(
      'test-plugin',
      ['app:routes', 'app:db:read'],
      ['app:routes', 'app:db:read', 'app:db:write']
    )

    assert.isTrue(result.allowed)
  })

  test('denies when any capability missing', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const result = enforcer.checkAll(
      'test-plugin',
      ['app:routes', 'app:db:write'],
      ['app:routes', 'app:db:read']
    )

    assert.isFalse(result.allowed)
    assert.deepEqual(result.missingCapabilities, ['app:db:write'])
  })
})

test.group('CapabilityEnforcer - decideGrants()', () => {
  test('grants valid capabilities for Tier A', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const manifest: PluginManifest = {
      pluginId: 'test',
      packageName: '@plugins/test',
      version: '1.0.0',
      tier: 'A',
      requestedCapabilities: [
        { capability: 'ui:filter:nav', reason: 'Add nav items' },
        { capability: 'ui:slot:sidebar', reason: 'Add sidebar content' },
      ],
    }

    const decision = enforcer.decideGrants(manifest)

    assert.deepEqual(decision.granted.sort(), ['ui:filter:nav', 'ui:slot:sidebar'])
    assert.deepEqual(decision.denied, [])
  })

  test('denies Tier B capabilities for Tier A plugin', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const manifest: PluginManifest = {
      pluginId: 'test',
      packageName: '@plugins/test',
      version: '1.0.0',
      tier: 'A',
      requestedCapabilities: [
        { capability: 'ui:filter:nav', reason: 'Add nav items' },
        { capability: 'app:routes', reason: 'Want routes' },
        { capability: 'app:db:write', reason: 'Want DB' },
      ],
    }

    const decision = enforcer.decideGrants(manifest)

    assert.deepEqual(decision.granted, ['ui:filter:nav'])
    assert.deepEqual(decision.denied.sort(), ['app:db:write', 'app:routes'])
    assert.include(decision.reasons['app:routes'], 'Tier A')
  })

  test('grants all capabilities for Tier B', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const manifest: PluginManifest = {
      pluginId: 'test',
      packageName: '@plugins/test',
      version: '1.0.0',
      tier: 'B',
      requestedCapabilities: [
        { capability: 'app:routes', reason: 'API endpoints' },
        { capability: 'app:db:read', reason: 'Read data' },
        { capability: 'app:db:write', reason: 'Write data' },
        { capability: 'ui:filter:nav', reason: 'Nav items' },
      ],
    }

    const decision = enforcer.decideGrants(manifest)

    assert.equal(decision.granted.length, 4)
    assert.deepEqual(decision.denied, [])
  })

  test('denies unknown capabilities', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const manifest: PluginManifest = {
      pluginId: 'test',
      packageName: '@plugins/test',
      version: '1.0.0',
      tier: 'B',
      requestedCapabilities: [
        { capability: 'app:routes', reason: 'Valid' },
        { capability: 'invalid:capability' as any, reason: 'Invalid' },
      ],
    }

    const decision = enforcer.decideGrants(manifest)

    assert.deepEqual(decision.granted, ['app:routes'])
    assert.deepEqual(decision.denied, ['invalid:capability'])
    assert.include(decision.reasons['invalid:capability'], 'Unknown')
  })
})

test.group('CapabilityEnforcer - validateManifestCapabilities()', () => {
  test('validates correct Tier A manifest', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const manifest: PluginManifest = {
      pluginId: 'test',
      packageName: '@plugins/test',
      version: '1.0.0',
      tier: 'A',
      requestedCapabilities: [{ capability: 'ui:filter:nav', reason: 'Nav' }],
    }

    const result = enforcer.validateManifestCapabilities(manifest)
    assert.isTrue(result.valid)
    assert.deepEqual(result.errors, [])
  })

  test('validates correct Tier B manifest', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const manifest: PluginManifest = {
      pluginId: 'test',
      packageName: '@plugins/test',
      version: '1.0.0',
      tier: 'B',
      requestedCapabilities: [
        { capability: 'app:routes', reason: 'Routes' },
        { capability: 'app:db:read', reason: 'Read' },
      ],
    }

    const result = enforcer.validateManifestCapabilities(manifest)
    assert.isTrue(result.valid)
  })

  test('fails for Tier A with Tier B capabilities', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()
    const manifest: PluginManifest = {
      pluginId: 'test',
      packageName: '@plugins/test',
      version: '1.0.0',
      tier: 'A',
      requestedCapabilities: [{ capability: 'app:routes', reason: 'Routes' }],
    }

    const result = enforcer.validateManifestCapabilities(manifest)
    assert.isFalse(result.valid)
    assert.isNotEmpty(result.errors)
  })
})

test.group('CapabilityEnforcer - Helper Methods', () => {
  test('requiresDbAccess returns true for db capabilities', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()

    assert.isTrue(enforcer.requiresDbAccess('app:db:read'))
    assert.isTrue(enforcer.requiresDbAccess('app:db:write'))
    assert.isFalse(enforcer.requiresDbAccess('app:routes'))
  })

  test('requiresRoutes returns true for routes capability', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()

    assert.isTrue(enforcer.requiresRoutes('app:routes'))
    assert.isFalse(enforcer.requiresRoutes('app:db:read'))
  })

  test('requiresAuthz returns true for authz capability', ({ assert }) => {
    const enforcer = new CapabilityEnforcer()

    assert.isTrue(enforcer.requiresAuthz('app:authz'))
    assert.isFalse(enforcer.requiresAuthz('app:routes'))
  })
})

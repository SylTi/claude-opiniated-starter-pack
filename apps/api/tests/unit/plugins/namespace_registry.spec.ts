import { test } from '@japa/runner'
import { NamespaceRegistry } from '#services/authz/namespace_registry'
import { NamespaceConflictError } from '#exceptions/authz_errors'
import type { AuthzContext, AuthzCheck, AuthzDecision } from '@saas/shared'

function createMockResolver(): (ctx: AuthzContext, check: AuthzCheck) => Promise<AuthzDecision> {
  return async () => ({ allow: true })
}

test.group('NamespaceRegistry - register()', () => {
  test('registers namespace with resolver', ({ assert }) => {
    const registry = new NamespaceRegistry()
    const resolver = createMockResolver()

    registry.register('test-plugin', 'notes.', resolver)

    assert.isTrue(registry.has('notes.'))
    assert.equal(registry.getResolver('notes.'), resolver)
  })

  test('throws on duplicate namespace', ({ assert }) => {
    const registry = new NamespaceRegistry()

    registry.register('plugin-a', 'notes.', createMockResolver())

    assert.throws(
      () => registry.register('plugin-b', 'notes.', createMockResolver()),
      NamespaceConflictError
    )
  })

  test('throws if namespace does not end with dot', ({ assert }) => {
    const registry = new NamespaceRegistry()

    assert.throws(() => registry.register('test', 'notes', createMockResolver()))
  })

  test('stores registration info', ({ assert }) => {
    const registry = new NamespaceRegistry()
    const resolver = createMockResolver()

    registry.register('test-plugin', 'notes.', resolver)

    const registration = registry.getRegistration('notes.')
    assert.equal(registration?.pluginId, 'test-plugin')
    assert.equal(registration?.namespace, 'notes.')
    assert.equal(registration?.resolver, resolver)
    assert.instanceOf(registration?.registeredAt, Date)
  })
})

test.group('NamespaceRegistry - unregister()', () => {
  test('unregisters namespace', ({ assert }) => {
    const registry = new NamespaceRegistry()
    registry.register('test', 'notes.', createMockResolver())

    const result = registry.unregister('notes.')

    assert.isTrue(result)
    assert.isFalse(registry.has('notes.'))
  })

  test('returns false for unknown namespace', ({ assert }) => {
    const registry = new NamespaceRegistry()

    const result = registry.unregister('unknown.')
    assert.isFalse(result)
  })
})

test.group('NamespaceRegistry - unregisterPlugin()', () => {
  test('removes all namespaces for plugin', ({ assert }) => {
    const registry = new NamespaceRegistry()
    registry.register('plugin-a', 'notes.', createMockResolver())
    registry.register('plugin-a', 'boards.', createMockResolver())
    registry.register('plugin-b', 'tasks.', createMockResolver())

    registry.unregisterPlugin('plugin-a')

    assert.isFalse(registry.has('notes.'))
    assert.isFalse(registry.has('boards.'))
    assert.isTrue(registry.has('tasks.'))
  })
})

test.group('NamespaceRegistry - parseNamespace()', () => {
  test('extracts namespace with dot', ({ assert }) => {
    const registry = new NamespaceRegistry()

    assert.equal(registry.parseNamespace('notes.item.read'), 'notes.')
    assert.equal(registry.parseNamespace('boards.board.write'), 'boards.')
    assert.equal(registry.parseNamespace('a.b.c.d'), 'a.')
  })

  test('returns null for abilities without dot', ({ assert }) => {
    const registry = new NamespaceRegistry()

    assert.isNull(registry.parseNamespace('tenant:read'))
    assert.isNull(registry.parseNamespace('simple'))
  })
})

test.group('NamespaceRegistry - queries', () => {
  test('getAllNamespaces returns all registered namespaces', ({ assert }) => {
    const registry = new NamespaceRegistry()
    registry.register('a', 'notes.', createMockResolver())
    registry.register('b', 'boards.', createMockResolver())
    registry.register('c', 'tasks.', createMockResolver())

    const namespaces = registry.getAllNamespaces()

    assert.equal(namespaces.length, 3)
    assert.include(namespaces, 'notes.')
    assert.include(namespaces, 'boards.')
    assert.include(namespaces, 'tasks.')
  })

  test('getAllRegistrations returns all registrations', ({ assert }) => {
    const registry = new NamespaceRegistry()
    registry.register('a', 'notes.', createMockResolver())
    registry.register('b', 'boards.', createMockResolver())

    const registrations = registry.getAllRegistrations()

    assert.equal(registrations.length, 2)
    assert.equal(registrations[0].namespace, 'notes.')
    assert.equal(registrations[1].namespace, 'boards.')
  })

  test('getPluginNamespaces returns namespaces for specific plugin', ({ assert }) => {
    const registry = new NamespaceRegistry()
    registry.register('plugin-a', 'notes.', createMockResolver())
    registry.register('plugin-a', 'boards.', createMockResolver())
    registry.register('plugin-b', 'tasks.', createMockResolver())

    const namespaces = registry.getPluginNamespaces('plugin-a')

    assert.deepEqual(namespaces.sort(), ['boards.', 'notes.'])
  })

  test('getPluginNamespaces returns empty array for unknown plugin', ({ assert }) => {
    const registry = new NamespaceRegistry()

    const namespaces = registry.getPluginNamespaces('unknown')
    assert.deepEqual(namespaces, [])
  })
})

test.group('NamespaceRegistry - clear()', () => {
  test('clears all registrations', ({ assert }) => {
    const registry = new NamespaceRegistry()
    registry.register('a', 'notes.', createMockResolver())
    registry.register('b', 'boards.', createMockResolver())

    registry.clear()

    assert.deepEqual(registry.getAllNamespaces(), [])
    assert.isFalse(registry.has('notes.'))
    assert.isFalse(registry.has('boards.'))
  })
})

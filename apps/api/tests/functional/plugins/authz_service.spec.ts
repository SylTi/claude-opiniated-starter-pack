import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import AuthzService from '#services/authz/authz_service'
import { NamespaceRegistry } from '#services/authz/namespace_registry'
import db from '@adonisjs/lucid/services/db'
import type { AuthzContext } from '@saas/shared'

function createMockContext(tenantId: number, userId: number): AuthzContext {
  return { tenantId, userId }
}

test.group('AuthzService - Integration', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('namespace registry persists resolver registrations', async ({ assert }) => {
    const registry = new NamespaceRegistry()
    const authzService = new AuthzService(registry)

    // Register resolver for notes namespace
    registry.register('notes-plugin', 'notes.', async (ctx, check) => {
      // Simulate DB lookup
      const result = await db.rawQuery(`SELECT 1 WHERE ? = ? AND ? = ?`, [
        ctx.tenantId,
        1,
        check.ability,
        'notes.read',
      ])
      return {
        allow: result.rows.length > 0,
        reason: result.rows.length > 0 ? 'Granted' : 'Denied',
      }
    })

    const ctx = createMockContext(1, 100)

    // Test allowed ability
    const allowedDecision = await authzService.check(ctx, { ability: 'notes.read' })
    assert.isTrue(allowedDecision.allow)

    // Test denied ability (different ability name)
    const deniedDecision = await authzService.check(ctx, { ability: 'notes.delete' })
    assert.isFalse(deniedDecision.allow)
  })

  test('multiple namespaces can be registered', async ({ assert }) => {
    const registry = new NamespaceRegistry()
    const authzService = new AuthzService(registry)

    // Register notes resolver
    registry.register('notes-plugin', 'notes.', async () => ({
      allow: true,
      reason: 'Notes plugin grants all',
    }))

    // Register boards resolver
    registry.register('boards-plugin', 'boards.', async () => ({
      allow: false,
      reason: 'Boards plugin denies all',
    }))

    const ctx = createMockContext(1, 100)

    const notesDecision = await authzService.check(ctx, { ability: 'notes.anything' })
    assert.isTrue(notesDecision.allow)
    assert.equal(notesDecision.reason, 'Notes plugin grants all')

    const boardsDecision = await authzService.check(ctx, { ability: 'boards.anything' })
    assert.isFalse(boardsDecision.allow)
    assert.equal(boardsDecision.reason, 'Boards plugin denies all')
  })

  test('unregistering namespace removes resolver', async ({ assert }) => {
    const registry = new NamespaceRegistry()
    const authzService = new AuthzService(registry)

    registry.register('test-plugin', 'test.', async () => ({ allow: true }))

    // Verify resolver works
    const ctx = createMockContext(1, 100)
    const beforeDecision = await authzService.check(ctx, { ability: 'test.action' })
    assert.isTrue(beforeDecision.allow)

    // Unregister
    registry.unregister('test.')

    // Should now fail-closed
    const afterDecision = await authzService.check(ctx, { ability: 'test.action' })
    assert.isFalse(afterDecision.allow)
    assert.include(afterDecision.reason!, 'No authorization resolver')
  })

  test('unregisterPlugin removes all namespaces for plugin', async ({ assert }) => {
    const registry = new NamespaceRegistry()
    const authzService = new AuthzService(registry)

    // Plugin registers multiple namespaces
    registry.register('multi-plugin', 'ns1.', async () => ({ allow: true }))
    registry.register('multi-plugin', 'ns2.', async () => ({ allow: true }))
    registry.register('other-plugin', 'ns3.', async () => ({ allow: true }))

    // Verify all work
    const ctx = createMockContext(1, 100)
    let decision = await authzService.check(ctx, { ability: 'ns1.x' })
    assert.isTrue(decision.allow)
    decision = await authzService.check(ctx, { ability: 'ns2.x' })
    assert.isTrue(decision.allow)
    decision = await authzService.check(ctx, { ability: 'ns3.x' })
    assert.isTrue(decision.allow)

    // Unregister plugin
    registry.unregisterPlugin('multi-plugin')

    // ns1 and ns2 should fail, ns3 should still work
    decision = await authzService.check(ctx, { ability: 'ns1.x' })
    assert.isFalse(decision.allow)
    decision = await authzService.check(ctx, { ability: 'ns2.x' })
    assert.isFalse(decision.allow)
    decision = await authzService.check(ctx, { ability: 'ns3.x' })
    assert.isTrue(decision.allow)
  })
})

test.group('AuthzService - Error Handling', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('resolver throwing error results in deny', async ({ assert }) => {
    const registry = new NamespaceRegistry()
    const authzService = new AuthzService(registry)

    registry.register('error-plugin', 'error.', async () => {
      throw new Error('Database connection failed')
    })

    const ctx = createMockContext(1, 100)
    const decision = await authzService.check(ctx, { ability: 'error.action' })

    assert.isFalse(decision.allow)
    assert.include(decision.reason!, 'error')
  })

  test('resolver timeout is handled gracefully', async ({ assert }) => {
    const registry = new NamespaceRegistry()
    const authzService = new AuthzService(registry)

    registry.register('slow-plugin', 'slow.', async () => {
      // Simulate slow operation
      await new Promise((resolve) => setTimeout(resolve, 100))
      return { allow: true }
    })

    const ctx = createMockContext(1, 100)
    const decision = await authzService.check(ctx, { ability: 'slow.action' })

    // Should complete (not timeout in this test)
    assert.isTrue(decision.allow)
  })
})

test.group('AuthzService - Resource Authorization', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('resolver receives resource info', async ({ assert }) => {
    const registry = new NamespaceRegistry()
    const authzService = new AuthzService(registry)

    let receivedResource: { type: string; id: string | number } | undefined

    registry.register('resource-plugin', 'res.', async (_ctx, check) => {
      receivedResource = check.resource
      return { allow: true }
    })

    const ctx = createMockContext(1, 100)
    await authzService.check(ctx, {
      ability: 'res.view',
      resource: { type: 'document', id: 42 },
    })

    assert.isNotNull(receivedResource)
    assert.equal(receivedResource?.type, 'document')
    assert.equal(receivedResource?.id, 42)
  })

  test('resolver can grant based on resource ownership', async ({ assert }) => {
    const registry = new NamespaceRegistry()
    const authzService = new AuthzService(registry)

    // Simulated ownership: user 100 owns resource 1, user 200 owns resource 2
    const ownership: Record<number, number> = {
      1: 100,
      2: 200,
    }

    registry.register('owned-plugin', 'owned.', async (ctx, check) => {
      if (!check.resource) {
        return { allow: false, reason: 'Resource required' }
      }

      const resourceId = Number(check.resource.id)
      const ownerId = ownership[resourceId]

      return {
        allow: ownerId === ctx.userId,
        reason: ownerId === ctx.userId ? 'User owns resource' : 'Not owner',
      }
    })

    // User 100 accessing resource 1 (their own)
    const ctx100 = createMockContext(1, 100)
    const owned = await authzService.check(ctx100, {
      ability: 'owned.edit',
      resource: { type: 'item', id: 1 },
    })
    assert.isTrue(owned.allow)

    // User 100 accessing resource 2 (owned by 200)
    const notOwned = await authzService.check(ctx100, {
      ability: 'owned.edit',
      resource: { type: 'item', id: 2 },
    })
    assert.isFalse(notOwned.allow)
  })
})

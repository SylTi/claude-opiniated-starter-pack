import { test } from '@japa/runner'
import AuthzService from '#services/authz/authz_service'
import { NamespaceRegistry } from '#services/authz/namespace_registry'
import type { AuthzContext, AuthzCheck } from '@saas/shared'

function createMockContext(overrides: Partial<AuthzContext> = {}): AuthzContext {
  return {
    tenantId: 1,
    userId: 100,
    ...overrides,
  }
}

function createMockCheck(overrides: Partial<AuthzCheck> = {}): AuthzCheck {
  return {
    ability: 'notes.item.read',
    ...overrides,
  }
}

test.group('AuthzService - check()', () => {
  test('routes to namespace resolver when registered', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    // Register a resolver for the 'notes.' namespace
    namespaceRegistry.register('notes-plugin', 'notes.', async () => ({
      allow: true,
    }))

    const ctx = createMockContext()
    const check = createMockCheck({ ability: 'notes.item.read' })

    const decision = await authzService.check(ctx, check)

    assert.isTrue(decision.allow)
  })

  test('denies when no resolver registered (fail-closed)', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    const ctx = createMockContext()
    const check = createMockCheck({ ability: 'unknown.action' })

    const decision = await authzService.check(ctx, check)

    assert.isFalse(decision.allow)
    assert.include(decision.reason!, 'No authorization resolver')
  })

  test('denies core abilities (no namespace)', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    const ctx = createMockContext()
    const check = createMockCheck({ ability: 'simpleability' })

    const decision = await authzService.check(ctx, check)

    assert.isFalse(decision.allow)
    assert.include(decision.reason!, 'Core ability')
  })

  test('passes context and check to resolver', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    let receivedCtx: AuthzContext | null = null
    let receivedCheck: AuthzCheck | null = null

    namespaceRegistry.register('test-plugin', 'test.', async (ctx, check) => {
      receivedCtx = ctx
      receivedCheck = check
      return { allow: true }
    })

    const ctx = createMockContext({ tenantId: 42, userId: 999 })
    const check = createMockCheck({ ability: 'test.action', resource: { type: 'item', id: 123 } })

    await authzService.check(ctx, check)

    assert.deepEqual(receivedCtx, ctx)
    assert.deepEqual(receivedCheck, check)
  })

  test('returns resolver decision', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    namespaceRegistry.register('plugin-a', 'allow.', async () => ({
      allow: true,
      reason: 'Granted by admin role',
    }))

    namespaceRegistry.register('plugin-b', 'deny.', async () => ({
      allow: false,
      reason: 'User lacks permission',
    }))

    const ctx = createMockContext()

    const allowDecision = await authzService.check(ctx, { ability: 'allow.action' })
    assert.isTrue(allowDecision.allow)
    assert.equal(allowDecision.reason, 'Granted by admin role')

    const denyDecision = await authzService.check(ctx, { ability: 'deny.action' })
    assert.isFalse(denyDecision.allow)
    assert.equal(denyDecision.reason, 'User lacks permission')
  })

  test('handles resolver throwing error gracefully', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    namespaceRegistry.register('broken-plugin', 'broken.', async () => {
      throw new Error('Database connection failed')
    })

    const ctx = createMockContext()
    const check = createMockCheck({ ability: 'broken.action' })

    const decision = await authzService.check(ctx, check)

    // Fail-closed: error means deny
    assert.isFalse(decision.allow)
    assert.include(decision.reason!, 'error')
  })
})

test.group('AuthzService - authorize()', () => {
  test('does not throw when allowed', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    namespaceRegistry.register('test', 'test.', async () => ({ allow: true }))

    const ctx = createMockContext()
    const check = createMockCheck({ ability: 'test.action' })

    // Should not throw
    await assert.doesNotReject(async () => {
      await authzService.authorize(ctx, check)
    })
  })

  test('throws AuthzDeniedError when denied', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    namespaceRegistry.register('test', 'test.', async () => ({
      allow: false,
      reason: 'Permission denied',
    }))

    const ctx = createMockContext()
    const check = createMockCheck({ ability: 'test.action' })

    let thrownError: Error | null = null
    try {
      await authzService.authorize(ctx, check)
    } catch (error) {
      thrownError = error as Error
    }
    assert.isNotNull(thrownError, 'Expected AuthzDeniedError to be thrown')
    assert.equal(thrownError!.constructor.name, 'AuthzDeniedError')
  })
})

test.group('AuthzService - checkAll()', () => {
  test('allows when all checks pass', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    namespaceRegistry.register('test', 'test.', async () => ({ allow: true }))

    const ctx = createMockContext()
    const checks: AuthzCheck[] = [
      { ability: 'test.read' },
      { ability: 'test.write' },
      { ability: 'test.delete' },
    ]

    const decisions = await authzService.checkAll(ctx, checks)

    assert.lengthOf(decisions, 3)
    assert.isTrue(decisions.every((d) => d.allow))
  })

  test('returns individual decisions for each check', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    namespaceRegistry.register('test', 'test.', async (_ctx, check) => {
      // Allow only 'test.read'
      return { allow: check.ability === 'test.read' }
    })

    const ctx = createMockContext()
    const checks: AuthzCheck[] = [{ ability: 'test.read' }, { ability: 'test.write' }]

    const decisions = await authzService.checkAll(ctx, checks)

    assert.lengthOf(decisions, 2)
    assert.isTrue(decisions[0].allow)
    assert.isFalse(decisions[1].allow)
  })
})

test.group('AuthzService - authorizeAll()', () => {
  test('does not throw when all allowed', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    namespaceRegistry.register('test', 'test.', async () => ({ allow: true }))

    const ctx = createMockContext()
    const checks: AuthzCheck[] = [{ ability: 'test.read' }, { ability: 'test.write' }]

    await assert.doesNotReject(async () => {
      await authzService.authorizeAll(ctx, checks)
    })
  })

  test('throws on first denied check', async ({ assert }) => {
    const namespaceRegistry = new NamespaceRegistry()
    const authzService = new AuthzService(namespaceRegistry)

    namespaceRegistry.register('test', 'test.', async (_ctx, check) => ({
      allow: check.ability !== 'test.write',
      reason: check.ability === 'test.write' ? 'Write not allowed' : undefined,
    }))

    const ctx = createMockContext()
    const checks: AuthzCheck[] = [
      { ability: 'test.read' },
      { ability: 'test.write' }, // Will be denied
      { ability: 'test.delete' },
    ]

    let thrownError: Error | null = null
    try {
      await authzService.authorizeAll(ctx, checks)
    } catch (error) {
      thrownError = error as Error
    }
    assert.isNotNull(thrownError, 'Expected AuthzDeniedError to be thrown')
    assert.equal(thrownError!.constructor.name, 'AuthzDeniedError')
  })
})

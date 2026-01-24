import { test } from '@japa/runner'
import { RbacGuard, RbacDeniedError, isRbacDeniedError } from '#services/rbac_guard'
import { ACTIONS } from '#constants/permissions'
import { TENANT_ROLES } from '#constants/roles'

/**
 * Mock tenant context for testing RbacGuard.
 * These tests do NOT require database access.
 */
function createMockTenantContext(role: string, userId: number = 1) {
  return {
    id: 100,
    membership: {
      id: 1,
      tenantId: 100,
      userId,
      role,
    },
  }
}

test.group('RBAC Guard - Constructor', () => {
  test('creates guard from tenant context', ({ assert }) => {
    const tenant = createMockTenantContext(TENANT_ROLES.OWNER)
    const guard = new RbacGuard(tenant)

    assert.equal(guard.getRole(), TENANT_ROLES.OWNER)
    assert.equal(guard.getUserId(), 1)
  })

  test('creates guard from HttpContext-like object', ({ assert }) => {
    const ctx = {
      tenant: createMockTenantContext(TENANT_ROLES.ADMIN, 42),
    }
    const guard = new RbacGuard(ctx as never)

    assert.equal(guard.getRole(), TENANT_ROLES.ADMIN)
    assert.equal(guard.getUserId(), 42)
  })

  test('throws error when tenant context is missing', ({ assert }) => {
    const ctx = {} as never
    assert.throws(
      () => new RbacGuard(ctx),
      'RbacGuard requires tenant context. Ensure tenant middleware is active.'
    )
  })
})

test.group('RBAC Guard - can()', () => {
  test('owner can perform all actions', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.OWNER))

    assert.isTrue(guard.can(ACTIONS.TENANT_READ))
    assert.isTrue(guard.can(ACTIONS.TENANT_UPDATE))
    assert.isTrue(guard.can(ACTIONS.TENANT_DELETE))
    assert.isTrue(guard.can(ACTIONS.SUBSCRIPTION_CANCEL))
  })

  test('admin can perform most actions', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.ADMIN))

    assert.isTrue(guard.can(ACTIONS.TENANT_UPDATE))
    assert.isTrue(guard.can(ACTIONS.MEMBER_ADD))
    assert.isFalse(guard.can(ACTIONS.TENANT_DELETE))
    assert.isFalse(guard.can(ACTIONS.SUBSCRIPTION_CANCEL))
  })

  test('member can only read', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    assert.isTrue(guard.can(ACTIONS.TENANT_READ))
    assert.isTrue(guard.can(ACTIONS.MEMBER_LIST))
    assert.isFalse(guard.can(ACTIONS.TENANT_UPDATE))
    assert.isFalse(guard.can(ACTIONS.MEMBER_ADD))
  })
})

test.group('RBAC Guard - canOrOwns()', () => {
  test('resource owner can perform any action', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER, 5))

    // User 5 owns the resource
    assert.isTrue(guard.canOrOwns(ACTIONS.TENANT_DELETE, { ownerId: 5 }))
  })

  test('non-owner falls back to role check', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER, 5))

    // User 5 does not own resource owned by user 10
    assert.isFalse(guard.canOrOwns(ACTIONS.TENANT_DELETE, { ownerId: 10 }))
    assert.isTrue(guard.canOrOwns(ACTIONS.TENANT_READ, { ownerId: 10 }))
  })

  test('admin non-owner can perform admin actions', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.ADMIN, 5))

    assert.isTrue(guard.canOrOwns(ACTIONS.MEMBER_REMOVE, { ownerId: 10 }))
    assert.isFalse(guard.canOrOwns(ACTIONS.TENANT_DELETE, { ownerId: 10 }))
  })
})

test.group('RBAC Guard - authorize()', () => {
  test('does not throw for allowed action', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.OWNER))

    assert.doesNotThrow(() => guard.authorize(ACTIONS.TENANT_DELETE))
  })

  test('throws RbacDeniedError for denied action', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    assert.throws(() => guard.authorize(ACTIONS.TENANT_UPDATE), RbacDeniedError)
  })

  test('thrown error contains denied actions', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    try {
      guard.authorize(ACTIONS.TENANT_UPDATE)
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, RbacDeniedError)
      assert.deepEqual((error as RbacDeniedError).deniedActions, [ACTIONS.TENANT_UPDATE])
    }
  })
})

test.group('RBAC Guard - authorizeOrOwns()', () => {
  test('does not throw when user owns resource', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER, 5))

    assert.doesNotThrow(() => guard.authorizeOrOwns(ACTIONS.TENANT_DELETE, { ownerId: 5 }))
  })

  test('throws when user does not own and lacks permission', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER, 5))

    assert.throws(() => guard.authorizeOrOwns(ACTIONS.TENANT_DELETE, { ownerId: 10 }))
  })

  test('does not throw when role allows even without ownership', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.ADMIN, 5))

    assert.doesNotThrow(() => guard.authorizeOrOwns(ACTIONS.MEMBER_REMOVE, { ownerId: 10 }))
  })
})

test.group('RBAC Guard - canAll()', () => {
  test('returns true when all actions allowed', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    assert.isTrue(guard.canAll([ACTIONS.TENANT_READ, ACTIONS.MEMBER_LIST]))
  })

  test('returns false when any action denied', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    assert.isFalse(guard.canAll([ACTIONS.TENANT_READ, ACTIONS.TENANT_UPDATE]))
  })

  test('returns true for empty array', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    assert.isTrue(guard.canAll([]))
  })
})

test.group('RBAC Guard - canAny()', () => {
  test('returns true when at least one action allowed', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    assert.isTrue(guard.canAny([ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_READ]))
  })

  test('returns false when all actions denied', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    assert.isFalse(guard.canAny([ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_DELETE]))
  })

  test('returns false for empty array', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.OWNER))

    assert.isFalse(guard.canAny([]))
  })
})

test.group('RBAC Guard - authorizeAll()', () => {
  test('does not throw when all actions allowed', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.OWNER))

    assert.doesNotThrow(() => guard.authorizeAll([ACTIONS.TENANT_DELETE, ACTIONS.MEMBER_REMOVE]))
  })

  test('throws with all denied actions', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    try {
      guard.authorizeAll([ACTIONS.TENANT_READ, ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_DELETE])
      assert.fail('Should have thrown')
    } catch (error) {
      assert.instanceOf(error, RbacDeniedError)
      const deniedActions = (error as RbacDeniedError).deniedActions
      assert.lengthOf(deniedActions, 2)
      assert.includeMembers(deniedActions, [ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_DELETE])
    }
  })

  test('does not throw for empty array', ({ assert }) => {
    const guard = new RbacGuard(createMockTenantContext(TENANT_ROLES.MEMBER))

    assert.doesNotThrow(() => guard.authorizeAll([]))
  })
})

test.group('RbacDeniedError', () => {
  test('has correct message', ({ assert }) => {
    const error = new RbacDeniedError([ACTIONS.TENANT_DELETE])

    assert.equal(error.message, 'You do not have permission to perform this action')
  })

  test('has correct name', ({ assert }) => {
    const error = new RbacDeniedError([ACTIONS.TENANT_DELETE])

    assert.equal(error.name, 'RbacDeniedError')
  })

  test('contains denied actions', ({ assert }) => {
    const actions = [ACTIONS.TENANT_DELETE, ACTIONS.MEMBER_REMOVE]
    const error = new RbacDeniedError(actions)

    assert.deepEqual(error.deniedActions, actions)
  })
})

test.group('isRbacDeniedError', () => {
  test('returns true for RbacDeniedError', ({ assert }) => {
    const error = new RbacDeniedError([ACTIONS.TENANT_DELETE])

    assert.isTrue(isRbacDeniedError(error))
  })

  test('returns false for regular Error', ({ assert }) => {
    const error = new Error('Some error')

    assert.isFalse(isRbacDeniedError(error))
  })

  test('returns false for null', ({ assert }) => {
    assert.isFalse(isRbacDeniedError(null))
  })

  test('returns false for undefined', ({ assert }) => {
    assert.isFalse(isRbacDeniedError(undefined))
  })

  test('returns false for string', ({ assert }) => {
    assert.isFalse(isRbacDeniedError('error'))
  })
})

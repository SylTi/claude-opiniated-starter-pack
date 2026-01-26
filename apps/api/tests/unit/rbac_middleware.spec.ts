import { test } from '@japa/runner'
import { createRbacMiddleware } from '#middleware/rbac_middleware'
import { ACTIONS } from '#constants/permissions'
import { TENANT_ROLES } from '#constants/roles'
import { auditEventBus } from '#services/audit_event_bus'
import { AUDIT_EVENT_TYPES, type AuditEvent } from '@saas/shared'

interface MockRbacContext {
  role: string
  requiredActions: string[]
  authorized: boolean
}

interface MockContext {
  tenant: {
    id: number
    membership: {
      id: number
      tenantId: number
      userId: number
      role: string
    }
  }
  auth: {
    user: {
      id: number
    }
  }
  request: {
    url: () => string
    method: () => string
    header: (name: string) => string | undefined
    ip: () => string
  }
  response: {
    internalServerError: (data: unknown) => void
    forbidden: (data: unknown) => void
  }
  rbac?: MockRbacContext
}

/**
 * Create a mock HttpContext for testing the middleware.
 */
function createMockContext(options: {
  tenantId: number
  userId: number
  role: string
}): MockContext {
  return {
    tenant: {
      id: options.tenantId,
      membership: {
        id: 1,
        tenantId: options.tenantId,
        userId: options.userId,
        role: options.role,
      },
    },
    auth: {
      user: {
        id: options.userId,
      },
    },
    request: {
      url: () => '/api/v1/tenants/1',
      method: () => 'DELETE',
      header: (name: string) => {
        if (name === 'user-agent') return 'Mozilla/5.0 Chrome/120.0'
        if (name === 'x-forwarded-for') return '192.168.1.1'
        return undefined
      },
      ip: () => '127.0.0.1',
    },
    response: {
      internalServerError: () => {},
      forbidden: () => {},
    },
  }
}

test.group('RBAC Middleware - Audit Events', () => {
  test('emits RBAC_PERMISSION_DENIED for sensitive action denial', async ({ assert }) => {
    const events: AuditEvent[] = []
    const subscriptionId = auditEventBus.subscribe((event) => {
      events.push(event)
    })

    try {
      const Middleware = createRbacMiddleware(ACTIONS.TENANT_DELETE)
      const middleware = new Middleware()

      const ctx = createMockContext({
        tenantId: 1,
        userId: 10,
        role: TENANT_ROLES.MEMBER, // Member cannot delete tenant
      })

      let forbiddenCalled = false
      ctx.response.forbidden = () => {
        forbiddenCalled = true
      }

      await middleware.handle(ctx as any, async () => {})

      // Wait for async event emission
      await new Promise((resolve) => setTimeout(resolve, 50))

      assert.isTrue(forbiddenCalled, 'Should return 403 forbidden')

      const rbacEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.RBAC_PERMISSION_DENIED)
      assert.exists(rbacEvent, 'RBAC_PERMISSION_DENIED event should be emitted')
      assert.equal(rbacEvent?.tenantId, 1)
      assert.deepInclude(rbacEvent?.meta?.deniedActions, ACTIONS.TENANT_DELETE)
      assert.equal(rbacEvent?.meta?.role, TENANT_ROLES.MEMBER)
      assert.equal(rbacEvent?.meta?.path, '/api/v1/tenants/1')
      assert.equal(rbacEvent?.meta?.method, 'DELETE')
    } finally {
      auditEventBus.unsubscribe(subscriptionId)
    }
  })

  test('does not emit event for non-sensitive action denial', async ({ assert }) => {
    const events: AuditEvent[] = []
    const subscriptionId = auditEventBus.subscribe((event) => {
      events.push(event)
    })

    try {
      const Middleware = createRbacMiddleware(ACTIONS.TENANT_UPDATE)
      const middleware = new Middleware()

      const ctx = createMockContext({
        tenantId: 1,
        userId: 10,
        role: TENANT_ROLES.MEMBER, // Member cannot update tenant
      })

      let forbiddenCalled = false
      ctx.response.forbidden = () => {
        forbiddenCalled = true
      }

      await middleware.handle(ctx as any, async () => {})

      // Wait for async event emission
      await new Promise((resolve) => setTimeout(resolve, 50))

      assert.isTrue(forbiddenCalled, 'Should return 403 forbidden')

      // Should NOT emit event for non-sensitive actions
      const rbacEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.RBAC_PERMISSION_DENIED)
      assert.notExists(rbacEvent, 'RBAC_PERMISSION_DENIED should not be emitted for non-sensitive')
    } finally {
      auditEventBus.unsubscribe(subscriptionId)
    }
  })

  test('does not emit event when action is authorized', async ({ assert }) => {
    const events: AuditEvent[] = []
    const subscriptionId = auditEventBus.subscribe((event) => {
      events.push(event)
    })

    try {
      const Middleware = createRbacMiddleware(ACTIONS.TENANT_DELETE)
      const middleware = new Middleware()

      const ctx = createMockContext({
        tenantId: 1,
        userId: 10,
        role: TENANT_ROLES.OWNER, // Owner CAN delete tenant
      })

      let nextCalled = false

      await middleware.handle(ctx as any, async () => {
        nextCalled = true
      })

      // Wait for async event emission
      await new Promise((resolve) => setTimeout(resolve, 50))

      assert.isTrue(nextCalled, 'Should call next when authorized')

      const rbacEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.RBAC_PERMISSION_DENIED)
      assert.notExists(rbacEvent, 'No RBAC event when authorized')
    } finally {
      auditEventBus.unsubscribe(subscriptionId)
    }
  })

  test('emits event with all sensitive denied actions when multiple actions checked', async ({
    assert,
  }) => {
    const events: AuditEvent[] = []
    const subscriptionId = auditEventBus.subscribe((event) => {
      events.push(event)
    })

    try {
      // Require multiple sensitive actions
      const Middleware = createRbacMiddleware(
        ACTIONS.TENANT_DELETE,
        ACTIONS.MEMBER_REMOVE,
        ACTIONS.SUBSCRIPTION_CANCEL
      )
      const middleware = new Middleware()

      const ctx = createMockContext({
        tenantId: 1,
        userId: 10,
        role: TENANT_ROLES.MEMBER, // Member cannot do any of these
      })

      let forbiddenCalled = false
      ctx.response.forbidden = () => {
        forbiddenCalled = true
      }

      await middleware.handle(ctx as any, async () => {})

      // Wait for async event emission
      await new Promise((resolve) => setTimeout(resolve, 50))

      assert.isTrue(forbiddenCalled, 'Should return 403 forbidden')

      const rbacEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.RBAC_PERMISSION_DENIED)
      assert.exists(rbacEvent, 'RBAC_PERMISSION_DENIED event should be emitted')

      // All three are sensitive actions
      const deniedActions = rbacEvent?.meta?.deniedActions as string[]
      assert.includeMembers(deniedActions, [
        ACTIONS.TENANT_DELETE,
        ACTIONS.MEMBER_REMOVE,
        ACTIONS.SUBSCRIPTION_CANCEL,
      ])
    } finally {
      auditEventBus.unsubscribe(subscriptionId)
    }
  })
})

test.group('RBAC Middleware - Authorization Logic', () => {
  test('allows authorized actions to proceed', async ({ assert }) => {
    const Middleware = createRbacMiddleware(ACTIONS.TENANT_READ)
    const middleware = new Middleware()

    const ctx = createMockContext({
      tenantId: 1,
      userId: 10,
      role: TENANT_ROLES.MEMBER, // Member CAN read tenant
    })

    let nextCalled = false

    await middleware.handle(ctx as any, async () => {
      nextCalled = true
    })

    assert.isTrue(nextCalled, 'Should call next when authorized')
    assert.exists(ctx.rbac, 'Should set RBAC context')
    assert.isTrue(ctx.rbac?.authorized, 'RBAC context should show authorized')
    assert.equal(ctx.rbac?.role, TENANT_ROLES.MEMBER)
  })

  test('blocks unauthorized actions', async ({ assert }) => {
    const Middleware = createRbacMiddleware(ACTIONS.TENANT_UPDATE)
    const middleware = new Middleware()

    const ctx = createMockContext({
      tenantId: 1,
      userId: 10,
      role: TENANT_ROLES.MEMBER, // Member cannot update tenant
    })

    let forbiddenData: unknown = null
    ctx.response.forbidden = (data: unknown) => {
      forbiddenData = data
    }

    let nextCalled = false

    await middleware.handle(ctx as any, async () => {
      nextCalled = true
    })

    assert.isFalse(nextCalled, 'Should NOT call next when unauthorized')
    assert.exists(forbiddenData, 'Should call forbidden')

    assert.equal((forbiddenData as any).error, 'RbacDenied')

    assert.include((forbiddenData as any).deniedActions, ACTIONS.TENANT_UPDATE)
  })

  test('returns error if tenant context is missing', async ({ assert }) => {
    const Middleware = createRbacMiddleware(ACTIONS.TENANT_READ)
    const middleware = new Middleware()

    let errorData: unknown = null

    const ctx = {
      tenant: null, // No tenant context
      response: {
        internalServerError: (data: unknown) => {
          errorData = data
        },
        forbidden: (_data: unknown) => {},
      },
    }

    await middleware.handle(ctx as any, async () => {})

    assert.exists(errorData, 'Should call internalServerError')

    assert.equal((errorData as any).error, 'ConfigurationError')
  })
})

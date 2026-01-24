import { test } from '@japa/runner'
import AuditEventBus, { auditEventBus } from '#services/audit_event_bus'
import { AUDIT_EVENT_TYPES, type AuditEvent } from '@saas/shared'

test.group('AuditEventBus', (group) => {
  // Clear subscriptions before each test
  group.each.setup(() => {
    auditEventBus.clear()
  })

  test('subscribe receives all events', async ({ assert }) => {
    const events: AuditEvent[] = []

    auditEventBus.subscribe((event) => {
      events.push(event)
    })

    const testEvent: AuditEvent = {
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: null,
      at: new Date().toISOString(),
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
    }

    // Use sync publish for testing
    auditEventBus.publishSync(testEvent)

    assert.lengthOf(events, 1)
    assert.equal(events[0].type, AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS)
  })

  test('subscribeToType only receives matching events', async ({ assert }) => {
    const loginEvents: AuditEvent[] = []
    const logoutEvents: AuditEvent[] = []

    auditEventBus.subscribeToType(AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS, (event) => {
      loginEvents.push(event)
    })

    auditEventBus.subscribeToType(AUDIT_EVENT_TYPES.AUTH_LOGOUT, (event) => {
      logoutEvents.push(event)
    })

    const loginEvent: AuditEvent = {
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: null,
      at: new Date().toISOString(),
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
    }

    const logoutEvent: AuditEvent = {
      type: AUDIT_EVENT_TYPES.AUTH_LOGOUT,
      tenantId: null,
      at: new Date().toISOString(),
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
    }

    auditEventBus.publishSync(loginEvent)
    auditEventBus.publishSync(logoutEvent)

    assert.lengthOf(loginEvents, 1)
    assert.lengthOf(logoutEvents, 1)
    assert.equal(loginEvents[0].type, AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS)
    assert.equal(logoutEvents[0].type, AUDIT_EVENT_TYPES.AUTH_LOGOUT)
  })

  test('unsubscribe removes handler', async ({ assert }) => {
    const events: AuditEvent[] = []

    const subscriptionId = auditEventBus.subscribe((event) => {
      events.push(event)
    })

    const testEvent: AuditEvent = {
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: null,
      at: new Date().toISOString(),
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
    }

    auditEventBus.publishSync(testEvent)
    assert.lengthOf(events, 1)

    auditEventBus.unsubscribe(subscriptionId)

    auditEventBus.publishSync(testEvent)
    assert.lengthOf(events, 1) // Still 1, no new events
  })

  test('unsubscribe returns false for invalid subscription', ({ assert }) => {
    const fakeId = Symbol('fake')
    const result = auditEventBus.unsubscribe(fakeId)
    assert.isFalse(result)
  })

  test('getSubscriptionCount returns correct count', ({ assert }) => {
    assert.equal(auditEventBus.getSubscriptionCount(), 0)

    const id1 = auditEventBus.subscribe(() => {})
    assert.equal(auditEventBus.getSubscriptionCount(), 1)

    const id2 = auditEventBus.subscribeToType(AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS, () => {})
    assert.equal(auditEventBus.getSubscriptionCount(), 2)

    auditEventBus.unsubscribe(id1)
    assert.equal(auditEventBus.getSubscriptionCount(), 1)

    auditEventBus.unsubscribe(id2)
    assert.equal(auditEventBus.getSubscriptionCount(), 0)
  })

  test('clear removes all subscriptions', ({ assert }) => {
    auditEventBus.subscribe(() => {})
    auditEventBus.subscribe(() => {})
    auditEventBus.subscribeToType(AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS, () => {})

    assert.equal(auditEventBus.getSubscriptionCount(), 3)

    auditEventBus.clear()

    assert.equal(auditEventBus.getSubscriptionCount(), 0)
  })

  test('handler errors do not prevent other handlers', async ({ assert }) => {
    const events: AuditEvent[] = []

    // First handler throws error
    auditEventBus.subscribe(() => {
      throw new Error('Test error')
    })

    // Second handler should still receive events
    auditEventBus.subscribe((event) => {
      events.push(event)
    })

    const testEvent: AuditEvent = {
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: null,
      at: new Date().toISOString(),
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
    }

    auditEventBus.publishSync(testEvent)

    assert.lengthOf(events, 1)
  })

  test('async handlers are supported', async ({ assert }) => {
    const events: AuditEvent[] = []

    auditEventBus.subscribe(async (event) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      events.push(event)
    })

    const testEvent: AuditEvent = {
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: null,
      at: new Date().toISOString(),
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
    }

    auditEventBus.publishSync(testEvent)

    // Wait for async handler
    await new Promise((resolve) => setTimeout(resolve, 50))

    assert.lengthOf(events, 1)
  })

  test('multiple subscribers receive same event', async ({ assert }) => {
    const events1: AuditEvent[] = []
    const events2: AuditEvent[] = []

    auditEventBus.subscribe((event) => {
      events1.push(event)
    })

    auditEventBus.subscribe((event) => {
      events2.push(event)
    })

    const testEvent: AuditEvent = {
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: null,
      at: new Date().toISOString(),
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
    }

    auditEventBus.publishSync(testEvent)

    assert.lengthOf(events1, 1)
    assert.lengthOf(events2, 1)
  })

  test('type-specific and global subscribers both receive events', async ({ assert }) => {
    const globalEvents: AuditEvent[] = []
    const typeEvents: AuditEvent[] = []

    auditEventBus.subscribe((event) => {
      globalEvents.push(event)
    })

    auditEventBus.subscribeToType(AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS, (event) => {
      typeEvents.push(event)
    })

    const testEvent: AuditEvent = {
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: null,
      at: new Date().toISOString(),
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
    }

    auditEventBus.publishSync(testEvent)

    assert.lengthOf(globalEvents, 1)
    assert.lengthOf(typeEvents, 1)
  })

  test('creates new instance', ({ assert }) => {
    const bus = new AuditEventBus()
    assert.instanceOf(bus, AuditEventBus)
    assert.equal(bus.getSubscriptionCount(), 0)
  })
})

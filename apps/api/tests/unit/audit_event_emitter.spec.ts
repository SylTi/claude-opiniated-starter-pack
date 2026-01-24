import { test } from '@japa/runner'
import AuditEventEmitter, { auditEventEmitter } from '#services/audit_event_emitter'
import { auditEventBus } from '#services/audit_event_bus'
import { AUDIT_EVENT_TYPES, type AuditEvent } from '@saas/shared'

test.group('AuditEventEmitter', (group) => {
  // Clear subscriptions before each test
  group.each.setup(() => {
    auditEventBus.clear()
  })

  test('emit creates event with timestamp', async ({ assert }) => {
    const events: AuditEvent[] = []
    auditEventBus.subscribe((event) => {
      events.push(event)
    })

    auditEventEmitter.emitSync({
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: 1,
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
    })

    assert.lengthOf(events, 1)
    assert.isString(events[0].at)
    // Verify it's a valid ISO date
    assert.doesNotThrow(() => new Date(events[0].at))
  })

  test('emit includes resource when provided', async ({ assert }) => {
    const events: AuditEvent[] = []
    auditEventBus.subscribe((event) => {
      events.push(event)
    })

    auditEventEmitter.emitSync({
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: 1,
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
      resource: { type: 'user', id: 1 },
    })

    assert.lengthOf(events, 1)
    assert.deepEqual(events[0].resource, { type: 'user', id: 1 })
  })

  test('emit includes meta when provided', async ({ assert }) => {
    const events: AuditEvent[] = []
    auditEventBus.subscribe((event) => {
      events.push(event)
    })

    auditEventEmitter.emitSync({
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: 1,
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
      meta: { mfaUsed: true },
    })

    assert.lengthOf(events, 1)
    assert.deepEqual(events[0].meta, { mfaUsed: true })
  })

  test('createUserActor creates correct actor', ({ assert }) => {
    const actor = auditEventEmitter.createUserActor(123, {
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    })

    assert.equal(actor.type, 'user')
    assert.equal(actor.id, 123)
    assert.equal(actor.ip, '192.168.1.1')
    assert.equal(actor.userAgent, 'Chrome/Windows')
  })

  test('createUserActor handles string user ID', ({ assert }) => {
    const actor = auditEventEmitter.createUserActor('user-abc', {})

    assert.equal(actor.type, 'user')
    assert.equal(actor.id, 'user-abc')
  })

  test('createServiceActor creates correct actor', ({ assert }) => {
    const actor = auditEventEmitter.createServiceActor('stripe')

    assert.equal(actor.type, 'service')
    assert.equal(actor.id, 'stripe')
    assert.isNull(actor.ip)
    assert.isNull(actor.userAgent)
  })

  test('createSystemActor creates correct actor', ({ assert }) => {
    const actor = auditEventEmitter.createSystemActor()

    assert.equal(actor.type, 'system')
    assert.isNull(actor.id)
    assert.isNull(actor.ip)
    assert.isNull(actor.userAgent)
  })

  test('user agent is summarized to browser/OS', ({ assert }) => {
    const testCases = [
      {
        input:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        expected: 'Chrome/Windows',
      },
      {
        input:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        expected: 'Chrome/macOS',
      },
      {
        input:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/121.0',
        expected: 'Firefox/Linux',
      },
      {
        input:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        expected: 'Safari/iOS',
      },
      {
        input:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        expected: 'Chrome/Android',
      },
      {
        input:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        expected: 'Edge/Windows',
      },
      {
        input: 'unknown-browser/1.0',
        expected: 'Unknown/Unknown',
      },
    ]

    for (const { input, expected } of testCases) {
      const actor = auditEventEmitter.createUserActor(1, { userAgent: input })
      assert.equal(actor.userAgent, expected, `Failed for: ${input}`)
    }
  })

  test('IPv6 addresses are truncated', ({ assert }) => {
    const actor = auditEventEmitter.createUserActor(1, {
      ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    })

    assert.equal(actor.ip, '2001:0db8:85a3:0000::')
  })

  test('IPv4 addresses are kept as-is', ({ assert }) => {
    const actor = auditEventEmitter.createUserActor(1, { ip: '192.168.1.1' })

    assert.equal(actor.ip, '192.168.1.1')
  })

  test('null IP is preserved', ({ assert }) => {
    const actor = auditEventEmitter.createUserActor(1, { ip: null })

    assert.isNull(actor.ip)
  })

  test('null user agent is preserved', ({ assert }) => {
    const actor = auditEventEmitter.createUserActor(1, { userAgent: null })

    assert.isNull(actor.userAgent)
  })

  test('meta is sanitized to remove sensitive fields', async ({ assert }) => {
    const events: AuditEvent[] = []
    auditEventBus.subscribe((event) => {
      events.push(event)
    })

    auditEventEmitter.emitSync({
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: 1,
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
      meta: {
        userId: 123,
        email: 'test@example.com',
        password: 'secret123',
        token: 'abc123',
        apiKey: 'key-xyz',
        normalField: 'normal value',
      },
    })

    assert.lengthOf(events, 1)
    assert.equal(events[0].meta?.userId, 123)
    assert.equal(events[0].meta?.email, '[REDACTED]')
    assert.equal(events[0].meta?.password, '[REDACTED]')
    assert.equal(events[0].meta?.token, '[REDACTED]')
    assert.equal(events[0].meta?.apiKey, '[REDACTED]')
    assert.equal(events[0].meta?.normalField, 'normal value')
  })

  test('nested objects are sanitized', async ({ assert }) => {
    const events: AuditEvent[] = []
    auditEventBus.subscribe((event) => {
      events.push(event)
    })

    auditEventEmitter.emitSync({
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: 1,
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
      meta: {
        user: {
          id: 123,
          email: 'test@example.com',
          name: 'Test User',
        },
      },
    })

    assert.lengthOf(events, 1)
    const userMeta = events[0].meta?.user as Record<string, unknown>
    assert.equal(userMeta.id, 123)
    assert.equal(userMeta.email, '[REDACTED]')
    assert.equal(userMeta.name, 'Test User')
  })

  test('all sensitive field variations are redacted', async ({ assert }) => {
    const events: AuditEvent[] = []
    auditEventBus.subscribe((event) => {
      events.push(event)
    })

    auditEventEmitter.emitSync({
      type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
      tenantId: 1,
      actor: { type: 'user', id: 1, ip: null, userAgent: null },
      meta: {
        secret: 'value',
        accessToken: 'value',
        access_token: 'value',
        refreshToken: 'value',
        refresh_token: 'value',
        creditCard: 'value',
        credit_card: 'value',
        api_key: 'value',
        ssn: 'value',
        phone: 'value',
        address: 'value',
      },
    })

    assert.lengthOf(events, 1)
    for (const key of Object.keys(events[0].meta!)) {
      assert.equal(events[0].meta![key], '[REDACTED]', `${key} should be redacted`)
    }
  })

  test('creates new instance', ({ assert }) => {
    const emitter = new AuditEventEmitter()
    assert.instanceOf(emitter, AuditEventEmitter)
  })
})

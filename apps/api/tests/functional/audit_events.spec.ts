import { test } from '@japa/runner'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'
import { auditEventBus } from '#services/audit_event_bus'
import { AUDIT_EVENT_TYPES, type AuditEvent } from '@saas/shared'
import { TENANT_ROLES } from '#constants/roles'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUserAndLogin(
  email: string,
  password: string,
  options: { emailVerified?: boolean; fullName?: string } = {}
): Promise<{ user: User; cookies: string[] }> {
  const user = await User.create({
    email,
    password,
    fullName: options.fullName ?? 'Test User',
    role: 'user',
    emailVerified: options.emailVerified ?? true,
    mfaEnabled: false,
  })

  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`)
  }

  const cookies = response.headers['set-cookie']
  return { user, cookies: Array.isArray(cookies) ? cookies : [] }
}

test.group('Audit Events - Auth', (group) => {
  let events: AuditEvent[]
  let subscriptionId: symbol

  group.each.setup(async () => {
    await truncateAllTables()
    events = []
    subscriptionId = auditEventBus.subscribe((event) => {
      events.push(event)
    })
  })

  group.each.teardown(() => {
    auditEventBus.unsubscribe(subscriptionId)
  })

  test('login success emits AUTH_LOGIN_SUCCESS event', async ({ assert }) => {
    const id = uniqueId()
    const email = `login-${id}@example.com`
    const password = 'password123'

    await User.create({
      email,
      password,
      fullName: 'Test User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await request(BASE_URL).post('/api/v1/auth/login').send({ email, password }).expect(200)

    // Wait for async event emission
    await new Promise((resolve) => setTimeout(resolve, 100))

    const loginEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS)
    assert.exists(loginEvent)
    assert.equal(loginEvent?.actor.type, 'user')
    assert.exists(loginEvent?.actor.id)
  })

  test('login failure emits AUTH_LOGIN_FAILURE event', async ({ assert }) => {
    const id = uniqueId()
    const email = `loginfail-${id}@example.com`

    await User.create({
      email,
      password: 'password123',
      fullName: 'Test User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrongpassword' })
      .expect(401)

    // Wait for async event emission
    await new Promise((resolve) => setTimeout(resolve, 100))

    const failEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILURE)
    assert.exists(failEvent)
    assert.deepInclude(failEvent?.meta, { reason: 'invalid_credentials' })
  })

  test('logout emits AUTH_LOGOUT event', async ({ assert }) => {
    const id = uniqueId()
    const email = `logout-${id}@example.com`
    const { cookies } = await createUserAndLogin(email, 'password123')

    // Clear previous events
    events.length = 0

    await request(BASE_URL).post('/api/v1/auth/logout').set('Cookie', cookies).expect(200)

    // Wait for async event emission
    await new Promise((resolve) => setTimeout(resolve, 100))

    const logoutEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.AUTH_LOGOUT)
    assert.exists(logoutEvent)
  })

  test('registration emits AUTH_REGISTER event', async ({ assert }) => {
    const id = uniqueId()
    const email = `register-${id}@example.com`

    await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'password123',
        fullName: 'New User',
      })
      .expect(201)

    // Wait for async event emission
    await new Promise((resolve) => setTimeout(resolve, 100))

    const registerEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.AUTH_REGISTER)
    assert.exists(registerEvent)
    assert.equal(registerEvent?.resource?.type, 'user')
  })

  test('password change emits AUTH_PASSWORD_CHANGE event', async ({ assert }) => {
    const id = uniqueId()
    const email = `pwchange-${id}@example.com`
    const { cookies } = await createUserAndLogin(email, 'password123')

    // Clear previous events
    events.length = 0

    await request(BASE_URL)
      .put('/api/v1/auth/password')
      .set('Cookie', cookies)
      .send({
        currentPassword: 'password123',
        newPassword: 'newpassword123',
      })
      .expect(200)

    // Wait for async event emission
    await new Promise((resolve) => setTimeout(resolve, 100))

    const changeEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.AUTH_PASSWORD_CHANGE)
    assert.exists(changeEvent)
  })
})

test.group('Audit Events - Tenant', (group) => {
  let events: AuditEvent[]
  let subscriptionId: symbol

  group.each.setup(async () => {
    await truncateAllTables()
    events = []
    subscriptionId = auditEventBus.subscribe((event) => {
      events.push(event)
    })
  })

  group.each.teardown(() => {
    auditEventBus.unsubscribe(subscriptionId)
  })

  test('tenant creation emits TENANT_CREATE event', async ({ assert }) => {
    const id = uniqueId()
    const email = `tenant-${id}@example.com`
    const { cookies } = await createUserAndLogin(email, 'password123')

    // Clear previous events
    events.length = 0

    await request(BASE_URL)
      .post('/api/v1/tenants')
      .set('Cookie', cookies)
      .send({ name: 'Test Tenant' })
      .expect(201)

    // Wait for async event emission
    await new Promise((resolve) => setTimeout(resolve, 100))

    const createEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.TENANT_CREATE)
    assert.exists(createEvent)
    assert.equal(createEvent?.resource?.type, 'tenant')
  })

  test('tenant switch emits TENANT_SWITCH event', async ({ assert }) => {
    const id = uniqueId()
    const email = `switch-${id}@example.com`
    const { user, cookies } = await createUserAndLogin(email, 'password123')

    // Create a second tenant
    const tenant = await Tenant.create({
      name: 'Second Tenant',
      slug: `second-tenant-${id}`,
      ownerId: user.id,
    })
    await TenantMembership.create({
      userId: user.id,
      tenantId: tenant.id,
      role: TENANT_ROLES.OWNER,
    })

    // Clear previous events
    events.length = 0

    await request(BASE_URL)
      .post(`/api/v1/tenants/${tenant.id}/switch`)
      .set('Cookie', cookies)
      .expect(200)

    // Wait for async event emission
    await new Promise((resolve) => setTimeout(resolve, 100))

    const switchEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.TENANT_SWITCH)
    assert.exists(switchEvent)
    assert.equal(switchEvent?.resource?.type, 'tenant')
    assert.equal(switchEvent?.resource?.id, tenant.id)
  })
})

test.group('Audit Events - No PII', (group) => {
  let events: AuditEvent[]
  let subscriptionId: symbol

  group.each.setup(async () => {
    await truncateAllTables()
    events = []
    subscriptionId = auditEventBus.subscribe((event) => {
      events.push(event)
    })
  })

  group.each.teardown(() => {
    auditEventBus.unsubscribe(subscriptionId)
  })

  test('audit events do not contain email addresses', async ({ assert }) => {
    const id = uniqueId()
    const email = `nopii-${id}@example.com`

    await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'password123',
        fullName: 'Test User',
      })
      .expect(201)

    // Wait for async event emission
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Check no event contains the email
    for (const event of events) {
      const eventJson = JSON.stringify(event)
      assert.isFalse(eventJson.includes(email), `Event ${event.type} should not contain email`)
    }
  })

  test('audit events sanitize user agent', async ({ assert }) => {
    const id = uniqueId()
    const email = `ua-${id}@example.com`
    const fullUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    await User.create({
      email,
      password: 'password123',
      fullName: 'Test User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' })
      .set('User-Agent', fullUserAgent)
      .expect(200)

    // Wait for async event emission
    await new Promise((resolve) => setTimeout(resolve, 100))

    const loginEvent = events.find((e) => e.type === AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS)
    assert.exists(loginEvent)

    // User agent should be summarized, not full string
    if (loginEvent?.actor.userAgent) {
      assert.isFalse(
        loginEvent.actor.userAgent.includes('AppleWebKit'),
        'User agent should be summarized'
      )
      assert.match(loginEvent.actor.userAgent, /^[A-Za-z]+\/[A-Za-z]+$/)
    }
  })
})

import { test } from '@japa/runner'
import request from 'supertest'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import { truncateAllTables } from '../bootstrap.js'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUser(email: string, password = 'password123'): Promise<User> {
  return User.create({
    email,
    password,
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
  })
}

async function loginAndGetCookie(email: string, password: string): Promise<string[]> {
  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`)
  }

  const cookies = response.headers['set-cookie']
  return Array.isArray(cookies) ? cookies : []
}

test.group('Tenants API', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('tenants list requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/tenants').expect(401)
  })

  test('create tenant creates a new team for owner', async ({ assert }) => {
    const id = uniqueId()
    const email = `owner-${id}@example.com`
    const owner = await createUser(email)
    const cookies = await loginAndGetCookie(email, 'password123')

    const response = await request(BASE_URL)
      .post('/api/v1/tenants')
      .set('Cookie', cookies)
      .send({ name: 'My Team' })
      .expect(201)

    assert.equal(response.body.data.name, 'My Team')
    assert.equal(response.body.data.ownerId, owner.id)
  })

  test('list tenants returns teams where user is a member', async ({ assert }) => {
    const id = uniqueId()
    const owner = await createUser(`owner-list-${id}@example.com`)
    const tenant = await Tenant.create({
      name: 'Team One',
      slug: `team-one-${id}`,
      ownerId: owner.id,
    })

    await TenantMembership.create({
      userId: owner.id,
      tenantId: tenant.id,
      role: 'owner',
    })

    const cookies = await loginAndGetCookie(owner.email, 'password123')

    const response = await request(BASE_URL)
      .get('/api/v1/tenants')
      .set('Cookie', cookies)
      .expect(200)

    assert.isAtLeast(response.body.data.length, 1)
    assert.isTrue(response.body.data.some((t: { id: number }) => t.id === tenant.id))
  })

  test('tenant details endpoint denies non-member', async () => {
    const id = uniqueId()
    const owner = await createUser(`owner-private-${id}@example.com`)
    const outsider = await createUser(`outsider-${id}@example.com`)

    const tenant = await Tenant.create({
      name: 'Private Team',
      slug: `private-${id}`,
      ownerId: owner.id,
    })

    await TenantMembership.create({ userId: owner.id, tenantId: tenant.id, role: 'owner' })

    const cookies = await loginAndGetCookie(outsider.email, 'password123')

    await request(BASE_URL).get(`/api/v1/tenants/${tenant.id}`).set('Cookie', cookies).expect(403)
  })

  test('owner can update tenant name', async ({ assert }) => {
    const id = uniqueId()
    const owner = await createUser(`owner-update-${id}@example.com`)
    const tenant = await Tenant.create({
      name: 'Old Name',
      slug: `old-name-${id}`,
      ownerId: owner.id,
    })

    await TenantMembership.create({ userId: owner.id, tenantId: tenant.id, role: 'owner' })

    const cookies = await loginAndGetCookie(owner.email, 'password123')

    const response = await request(BASE_URL)
      .put(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .send({ name: 'New Name' })
      .expect(200)

    assert.equal(response.body.data.name, 'New Name')
  })

  test('member cannot delete tenant', async () => {
    const id = uniqueId()
    const owner = await createUser(`owner-delete-${id}@example.com`)
    const member = await createUser(`member-delete-${id}@example.com`)

    const tenant = await Tenant.create({
      name: 'Delete Team',
      slug: `delete-team-${id}`,
      ownerId: owner.id,
    })

    await TenantMembership.create({ userId: owner.id, tenantId: tenant.id, role: 'owner' })
    await TenantMembership.create({ userId: member.id, tenantId: tenant.id, role: 'member' })

    const cookies = await loginAndGetCookie(member.email, 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(403)
  })
})

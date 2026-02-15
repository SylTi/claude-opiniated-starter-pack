import { test } from '@japa/runner'
import request from 'supertest'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import { systemOps } from '#services/system_operation_service'
import { truncateAllTables } from '../bootstrap.js'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUser(
  email: string,
  role: 'admin' | 'user' = 'user',
  password = 'password123'
): Promise<User> {
  return User.create({
    email,
    password,
    role,
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

async function createTenantForOwner(owner: User): Promise<Tenant> {
  const tenant = await Tenant.create({
    name: `Tenant ${uniqueId()}`,
    slug: `tenant-${uniqueId()}`,
    ownerId: owner.id,
    type: 'team',
  })

  await TenantMembership.create({
    userId: owner.id,
    tenantId: tenant.id,
    role: 'owner',
  })

  return tenant
}

test.group('Admin Tenant Quotas API', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('admin can get and update tenant quotas', async ({ assert }) => {
    const id = uniqueId()
    const admin = await createUser(`admin-${id}@example.com`, 'admin')
    const owner = await createUser(`owner-${id}@example.com`, 'user')
    const tenant = await createTenantForOwner(owner)
    const cookies = await loginAndGetCookie(admin.email, 'password123')

    const getResponse = await request(BASE_URL)
      .get(`/api/v1/admin/tenants/${tenant.id}/quotas`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(getResponse.body.data.tenantId, tenant.id)
    assert.exists(getResponse.body.data.effectiveLimits)

    const updateResponse = await request(BASE_URL)
      .put(`/api/v1/admin/tenants/${tenant.id}/quotas`)
      .set('Cookie', cookies)
      .send({
        maxMembers: 30,
        maxPendingInvitations: 50,
        maxAuthTokensPerTenant: 900,
        maxAuthTokensPerUser: 120,
      })
      .expect(200)

    assert.equal(updateResponse.body.data.maxMembers, 30)
    assert.equal(updateResponse.body.data.quotaOverrides.maxPendingInvitations, 50)
    assert.equal(updateResponse.body.data.quotaOverrides.maxAuthTokensPerTenant, 900)
    assert.equal(updateResponse.body.data.quotaOverrides.maxAuthTokensPerUser, 120)

    const updatedTenant = await systemOps.withSystemContext((trx) =>
      Tenant.findOrFail(tenant.id, { client: trx })
    )
    assert.equal(updatedTenant.maxMembers, 30)
    assert.deepEqual(updatedTenant.quotaOverrides, {
      maxPendingInvitations: 50,
      maxAuthTokensPerTenant: 900,
      maxAuthTokensPerUser: 120,
    })
  })

  test('non-admin cannot get or update tenant quotas', async () => {
    const id = uniqueId()
    const user = await createUser(`user-${id}@example.com`, 'user')
    const tenant = await createTenantForOwner(user)
    const cookies = await loginAndGetCookie(user.email, 'password123')

    await request(BASE_URL)
      .get(`/api/v1/admin/tenants/${tenant.id}/quotas`)
      .set('Cookie', cookies)
      .expect(403)

    await request(BASE_URL)
      .put(`/api/v1/admin/tenants/${tenant.id}/quotas`)
      .set('Cookie', cookies)
      .send({ maxMembers: 20 })
      .expect(403)
  })
})

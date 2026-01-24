/**
 * RBAC Integration Tests
 *
 * These tests verify the RBAC middleware and guard behavior
 * in integration with the tenant context middleware.
 */

import { test } from '@japa/runner'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'
import { TENANT_ROLES } from '#constants/roles'
import { ACTIONS } from '#constants/permissions'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

async function loginAndGetCookie(email: string, password: string): Promise<string[]> {
  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`)
  }

  const cookies = response.headers['set-cookie']
  if (!cookies) return []
  return Array.isArray(cookies) ? cookies : [cookies]
}

/**
 * Helper to create a test tenant with owner and optional members.
 */
async function createTenantWithMembers(options: {
  ownerEmail: string
  members?: Array<{ email: string; role: 'admin' | 'member' }>
}): Promise<{ owner: User; tenant: Tenant; members: User[] }> {
  const owner = await User.create({
    email: options.ownerEmail,
    password: 'password123',
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
  })

  const tenant = await Tenant.create({
    name: 'Test Tenant',
    slug: 'test-tenant',
    ownerId: owner.id,
  })

  await TenantMembership.create({
    userId: owner.id,
    tenantId: tenant.id,
    role: TENANT_ROLES.OWNER,
  })

  owner.currentTenantId = tenant.id
  await owner.save()

  const members: User[] = []

  for (const memberConfig of options.members ?? []) {
    const member = await User.create({
      email: memberConfig.email,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await TenantMembership.create({
      userId: member.id,
      tenantId: tenant.id,
      role: memberConfig.role,
    })

    member.currentTenantId = tenant.id
    await member.save()

    members.push(member)
  }

  return { owner, tenant, members }
}

test.group('RBAC - Role Permission Verification', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('owner can update tenant', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .put(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Updated Name' })
      .expect(200)

    assert.equal(response.body.data.name, 'Updated Name')
  })

  test('owner can delete tenant', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(200)

    const deletedTenant = await Tenant.find(tenant.id)
    assert.isNull(deletedTenant)
  })

  test('admin can update tenant', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'admin@example.com', role: 'admin' }],
    })

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    const response = await request(BASE_URL)
      .put(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Admin Updated Name' })
      .expect(200)

    assert.equal(response.body.data.name, 'Admin Updated Name')
  })

  test('admin cannot delete tenant - returns RbacDenied', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'admin@example.com', role: 'admin' }],
    })

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    const response = await request(BASE_URL)
      .delete(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(403)

    assert.equal(response.body.error, 'RbacDenied')
    assert.isArray(response.body.deniedActions)
    assert.include(response.body.deniedActions, ACTIONS.TENANT_DELETE)

    // Tenant should still exist
    const existingTenant = await Tenant.find(tenant.id)
    assert.exists(existingTenant)
  })

  test('member cannot update tenant - returns RbacDenied', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'member@example.com', role: 'member' }],
    })

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    const response = await request(BASE_URL)
      .put(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Attempted Update' })
      .expect(403)

    assert.equal(response.body.error, 'RbacDenied')
    assert.include(response.body.deniedActions, ACTIONS.TENANT_UPDATE)
  })

  test('member cannot delete tenant', async () => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'member@example.com', role: 'member' }],
    })

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(403)
  })
})

test.group('RBAC - Member Management Permissions', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('owner can add members', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
    })

    // Create a user to be added
    await User.create({
      email: 'newmember@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .post(`/api/v1/tenants/${tenant.id}/members`)
      .set('Cookie', cookies)
      .send({ email: 'newmember@example.com', role: 'member' })
      .expect(201)

    assert.equal(response.body.data.email, 'newmember@example.com')
  })

  test('admin can add members', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'admin@example.com', role: 'admin' }],
    })

    // Create a user to be added
    await User.create({
      email: 'newmember@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    const response = await request(BASE_URL)
      .post(`/api/v1/tenants/${tenant.id}/members`)
      .set('Cookie', cookies)
      .send({ email: 'newmember@example.com', role: 'member' })
      .expect(201)

    assert.equal(response.body.data.email, 'newmember@example.com')
  })

  test('member cannot add members - returns RbacDenied', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'member@example.com', role: 'member' }],
    })

    // Create a user to be added
    await User.create({
      email: 'newmember@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    const response = await request(BASE_URL)
      .post(`/api/v1/tenants/${tenant.id}/members`)
      .set('Cookie', cookies)
      .send({ email: 'newmember@example.com', role: 'member' })
      .expect(403)

    assert.equal(response.body.error, 'RbacDenied')
    assert.include(response.body.deniedActions, ACTIONS.MEMBER_ADD)
  })

  test('owner can remove members', async () => {
    const { tenant, members } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'member@example.com', role: 'member' }],
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/tenants/${tenant.id}/members/${members[0].id}`)
      .set('Cookie', cookies)
      .expect(200)
  })

  test('admin can remove members', async () => {
    const { tenant, members } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [
        { email: 'admin@example.com', role: 'admin' },
        { email: 'member@example.com', role: 'member' },
      ],
    })

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/tenants/${tenant.id}/members/${members[1].id}`)
      .set('Cookie', cookies)
      .expect(200)
  })

  test('member cannot remove other members - returns RbacDenied', async ({ assert }) => {
    const { tenant, members } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [
        { email: 'member1@example.com', role: 'member' },
        { email: 'member2@example.com', role: 'member' },
      ],
    })

    const cookies = await loginAndGetCookie('member1@example.com', 'password123')

    const response = await request(BASE_URL)
      .delete(`/api/v1/tenants/${tenant.id}/members/${members[1].id}`)
      .set('Cookie', cookies)
      .expect(403)

    assert.equal(response.body.error, 'RbacDenied')
    assert.include(response.body.deniedActions, ACTIONS.MEMBER_REMOVE)
  })
})

test.group('RBAC - Invitation Permissions', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('owner can list invitations', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant.id}/invitations`)
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
  })

  test('admin can list invitations', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'admin@example.com', role: 'admin' }],
    })

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant.id}/invitations`)
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
  })

  test('member cannot list invitations - returns RbacDenied', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'member@example.com', role: 'member' }],
    })

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant.id}/invitations`)
      .set('Cookie', cookies)
      .expect(403)

    assert.equal(response.body.error, 'RbacDenied')
    assert.include(response.body.deniedActions, ACTIONS.INVITATION_LIST)
  })
})

test.group('RBAC - Read Permissions', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('owner can view tenant details', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.id, tenant.id)
  })

  test('admin can view tenant details', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'admin@example.com', role: 'admin' }],
    })

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.id, tenant.id)
  })

  test('member can view tenant details', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'member@example.com', role: 'member' }],
    })

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.id, tenant.id)
  })

  test('non-member cannot view tenant details', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
    })

    // Create non-member user
    await User.create({
      email: 'outsider@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('outsider@example.com', 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(403)

    // Non-member gets Forbidden (not a member), not RbacDenied
    assert.equal(response.body.error, 'Forbidden')
  })
})

test.group('RBAC - Role Hierarchy', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('owner has all permissions admin has', async () => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
    })

    await User.create({
      email: 'newmember@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    // Owner can do everything admin can
    await request(BASE_URL)
      .put(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Owner Update' })
      .expect(200)

    await request(BASE_URL)
      .post(`/api/v1/tenants/${tenant.id}/members`)
      .set('Cookie', cookies)
      .send({ email: 'newmember@example.com', role: 'member' })
      .expect(201)
  })

  test('admin has all permissions member has', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'admin@example.com', role: 'admin' }],
    })

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    // Admin can do everything member can
    const response = await request(BASE_URL)
      .get(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(200)

    assert.exists(response.body.data)
  })

  test('owner-only actions are denied for admin with RbacDenied', async ({ assert }) => {
    const { tenant } = await createTenantWithMembers({
      ownerEmail: 'owner@example.com',
      members: [{ email: 'admin@example.com', role: 'admin' }],
    })

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    // Admin cannot delete tenant (owner-only)
    const response = await request(BASE_URL)
      .delete(`/api/v1/tenants/${tenant.id}`)
      .set('Cookie', cookies)
      .expect(403)

    assert.equal(response.body.error, 'RbacDenied')
    assert.include(response.body.deniedActions, ACTIONS.TENANT_DELETE)
  })
})

import { test } from '@japa/runner'
import User from '#models/user'
import SubscriptionTier from '#models/subscription_tier'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUserAndLogin(
  email: string,
  password: string,
  options: { emailVerified?: boolean; role?: 'user' | 'admin' } = {}
): Promise<{ user: User; cookies: string[] }> {
  const user = await User.create({
    email,
    password,
    fullName: 'Test User',
    role: options.role ?? 'user',
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

test.group('Admin Tiers API - List', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/admin/tiers requires admin role', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123', {
      role: 'user',
    })

    const response = await request(BASE_URL)
      .get('/api/v1/admin/tiers')
      .set('Cookie', cookies)
      .expect(403)

    assert.equal(response.body.error, 'Forbidden')
  })

  test('GET /api/v1/admin/tiers returns tiers', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .get('/api/v1/admin/tiers')
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
    assert.isTrue(response.body.data.length >= 1)
    const freeTier = response.body.data.find((tier: { slug: string }) => tier.slug === 'free')
    assert.exists(freeTier)
  })
})

test.group('Admin Tiers API - Create', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/admin/tiers creates a tier', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })
    const slug = `tier-${id}`.slice(0, 20)

    const response = await request(BASE_URL)
      .post('/api/v1/admin/tiers')
      .set('Cookie', cookies)
      .send({
        slug,
        name: 'Enterprise Plus',
        level: 3,
        maxTeamMembers: 25,
        priceMonthly: 9999,
        yearlyDiscountPercent: 15,
        features: { support: 'priority' },
        isActive: true,
      })
      .expect(201)

    assert.equal(response.body.data.slug, slug)
    assert.equal(response.body.data.name, 'Enterprise Plus')
    const tier = await SubscriptionTier.findBySlug(slug)
    assert.exists(tier)
  })

  test('POST /api/v1/admin/tiers rejects duplicate slug', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })
    const slug = `duplicate-${id}`.slice(0, 20)

    await SubscriptionTier.create({
      slug,
      name: 'Duplicate',
      level: 5,
      isActive: true,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/admin/tiers')
      .set('Cookie', cookies)
      .send({
        slug,
        name: 'Duplicate',
        level: 5,
      })
      .expect(409)

    assert.equal(response.body.error, 'ConflictError')
  })
})

test.group('Admin Tiers API - Update', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('PUT /api/v1/admin/tiers/:id updates tier fields', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })
    const slug = `update-${id}`.slice(0, 20)

    const tier = await SubscriptionTier.create({
      slug,
      name: 'Update Tier',
      level: 4,
      isActive: true,
    })

    const response = await request(BASE_URL)
      .put(`/api/v1/admin/tiers/${tier.id}`)
      .set('Cookie', cookies)
      .send({
        name: 'Updated Tier',
        level: 6,
        maxTeamMembers: 30,
        isActive: false,
      })
      .expect(200)

    assert.equal(response.body.data.name, 'Updated Tier')
    assert.equal(response.body.data.level, 6)
    assert.isFalse(response.body.data.isActive)
  })
})

test.group('Admin Tiers API - Delete', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('DELETE /api/v1/admin/tiers/:id deletes a tier', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })
    const slug = `delete-${id}`.slice(0, 20)

    const tier = await SubscriptionTier.create({
      slug,
      name: 'Delete Tier',
      level: 4,
      isActive: true,
    })

    await request(BASE_URL)
      .delete(`/api/v1/admin/tiers/${tier.id}`)
      .set('Cookie', cookies)
      .expect(200)

    const deleted = await SubscriptionTier.find(tier.id)
    assert.isNull(deleted)
  })
})

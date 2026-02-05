import { test } from '@japa/runner'
import request from 'supertest'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import SubscriptionTier from '#models/subscription_tier'
import Subscription from '#models/subscription'
import { TENANT_ROLES } from '#constants/roles'
import { truncateAllTables } from '../bootstrap.js'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUserAndLogin(
  email: string,
  password: string
): Promise<{ user: User; tenant: Tenant; cookies: string[] }> {
  const user = await User.create({
    email,
    password,
    fullName: 'Test User',
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
  })

  const tenant = await Tenant.create({
    name: `Personal - ${user.fullName}`,
    slug: `personal-${uniqueId()}`,
    type: 'personal',
    ownerId: user.id,
  })

  await TenantMembership.create({
    userId: user.id,
    tenantId: tenant.id,
    role: TENANT_ROLES.OWNER,
  })

  user.currentTenantId = tenant.id
  await user.save()

  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`)
  }

  const cookies = response.headers['set-cookie']
  return { user, tenant, cookies: Array.isArray(cookies) ? cookies : [] }
}

test.group('Billing API', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('billing tiers endpoint is public', async ({ assert }) => {
    const response = await request(BASE_URL).get('/api/v1/billing/tiers').expect(200)
    assert.isArray(response.body.data)
  })

  test('subscription endpoint requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/billing/subscription').expect(401)
  })

  test('subscription endpoint returns active subscription for tenant', async ({ assert }) => {
    const id = uniqueId()
    const { tenant, cookies } = await createUserAndLogin(`billing-${id}@example.com`, 'password123')

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTenant(tenant.id, tier.id)

    const response = await request(BASE_URL)
      .get(`/api/v1/billing/subscription?tenantId=${tenant.id}`)
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .expect(200)

    assert.equal(response.body.data.subscription.status, 'active')
    assert.equal(response.body.data.subscription.tier.slug, 'tier1')
  })

  test('checkout endpoint requires authentication', async () => {
    await request(BASE_URL)
      .post('/api/v1/billing/checkout')
      .send({ priceId: 'price_test' })
      .expect(401)
  })

  test('checkout validates required payload', async ({ assert }) => {
    const id = uniqueId()
    const { tenant, cookies } = await createUserAndLogin(
      `checkout-${id}@example.com`,
      'password123'
    )

    const response = await request(BASE_URL)
      .post('/api/v1/billing/checkout')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({})
      .expect(422)

    assert.exists(response.body.errors)
  })
})

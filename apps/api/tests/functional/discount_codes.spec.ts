import { test } from '@japa/runner'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import DiscountCode from '#models/discount_code'
import DiscountCodeUsage from '#models/discount_code_usage'
import SubscriptionTier from '#models/subscription_tier'
import Product from '#models/product'
import Price from '#models/price'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'
import { DateTime } from 'luxon'
import { TENANT_ROLES } from '#constants/roles'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUserAndLogin(
  email: string,
  password: string,
  options: { emailVerified?: boolean; role?: 'user' | 'admin' } = {}
): Promise<{ user: User; tenant: Tenant; cookies: string[] }> {
  const user = await User.create({
    email,
    password,
    fullName: 'Test User',
    role: options.role ?? 'user',
    emailVerified: options.emailVerified ?? true,
    mfaEnabled: false,
  })

  // Create personal tenant for the user
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

async function createTestPrice(): Promise<{ price: Price; tier: SubscriptionTier }> {
  const tier = await SubscriptionTier.findBySlugOrFail('tier1')
  const product = await Product.create({
    tierId: tier.id,
    provider: 'stripe',
    providerProductId: `prod_${uniqueId()}`,
  })
  const price = await Price.create({
    productId: product.id,
    provider: 'stripe',
    providerPriceId: `price_${uniqueId()}`,
    interval: 'month',
    currency: 'usd',
    unitAmount: 1999,
    taxBehavior: 'exclusive',
    isActive: true,
  })
  return { price, tier }
}

test.group('Admin Discount Codes API - List', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/admin/discount-codes requires admin role', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123', {
      role: 'user',
    })

    const response = await request(BASE_URL)
      .get('/api/v1/admin/discount-codes')
      .set('Cookie', cookies)
      .expect(403)

    assert.equal(response.body.error, 'Forbidden')
  })

  test('GET /api/v1/admin/discount-codes returns empty array when no codes exist', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .get('/api/v1/admin/discount-codes')
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
    assert.equal(response.body.data.length, 0)
  })

  test('GET /api/v1/admin/discount-codes returns all discount codes', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    await DiscountCode.create({
      code: `SUMMER${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
    })

    await DiscountCode.create({
      code: `WINTER${id}`,
      discountType: 'fixed',
      discountValue: 500,
      currency: 'usd',
      isActive: true,
    })

    const response = await request(BASE_URL)
      .get('/api/v1/admin/discount-codes')
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
    assert.equal(response.body.data.length, 2)
  })
})

test.group('Admin Discount Codes API - Create', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/admin/discount-codes creates percent discount code', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .post('/api/v1/admin/discount-codes')
      .set('Cookie', cookies)
      .send({
        code: `SUMMER${id}`,
        description: 'Summer sale',
        discountType: 'percent',
        discountValue: 25,
        maxUses: 100,
        maxUsesPerTenant: 1,
        expiresAt: '2027-12-31',
      })
      .expect(201)

    assert.exists(response.body.data.id)
    assert.equal(response.body.data.code, `SUMMER${id}`.toUpperCase())
    assert.equal(response.body.data.discountType, 'percent')
    assert.equal(response.body.data.discountValue, 25)
    assert.equal(response.body.data.maxUses, 100)
    assert.equal(response.body.data.isActive, true)
  })

  test('POST /api/v1/admin/discount-codes creates fixed discount code', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .post('/api/v1/admin/discount-codes')
      .set('Cookie', cookies)
      .send({
        code: `FIXED${id}`,
        discountType: 'fixed',
        discountValue: 1000,
        currency: 'usd',
      })
      .expect(201)

    assert.exists(response.body.data.id)
    assert.equal(response.body.data.discountType, 'fixed')
    assert.equal(response.body.data.discountValue, 1000)
    assert.equal(response.body.data.currency, 'usd')
  })

  test('POST /api/v1/admin/discount-codes rejects duplicate code', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    await DiscountCode.create({
      code: `DUPE${id}`.toUpperCase(),
      discountType: 'percent',
      discountValue: 10,
      isActive: true,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/admin/discount-codes')
      .set('Cookie', cookies)
      .send({
        code: `DUPE${id}`,
        discountType: 'percent',
        discountValue: 20,
      })
      .expect(409)

    assert.exists(response.body.error)
  })

  test('POST /api/v1/admin/discount-codes validates required fields', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .post('/api/v1/admin/discount-codes')
      .set('Cookie', cookies)
      .send({})
      .expect(422)

    assert.exists(response.body.errors)
  })
})

test.group('Admin Discount Codes API - Update', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('PUT /api/v1/admin/discount-codes/:id updates discount code', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const discountCode = await DiscountCode.create({
      code: `UPDATE${id}`,
      discountType: 'percent',
      discountValue: 10,
      isActive: true,
    })

    const response = await request(BASE_URL)
      .put(`/api/v1/admin/discount-codes/${discountCode.id}`)
      .set('Cookie', cookies)
      .send({
        description: 'Updated description',
        discountValue: 15,
        isActive: false,
      })
      .expect(200)

    assert.equal(response.body.data.description, 'Updated description')
    assert.equal(response.body.data.discountValue, 15)
    assert.equal(response.body.data.isActive, false)
  })

  test('PUT /api/v1/admin/discount-codes/:id returns 404 for non-existent code', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .put('/api/v1/admin/discount-codes/99999')
      .set('Cookie', cookies)
      .send({ discountValue: 15 })
      .expect(404)

    // AdonisJS findOrFail returns { message: ... } format
    assert.isTrue(response.status === 404)
  })
})

test.group('Admin Discount Codes API - Delete', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('DELETE /api/v1/admin/discount-codes/:id deletes discount code', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const discountCode = await DiscountCode.create({
      code: `DELETE${id}`,
      discountType: 'percent',
      discountValue: 10,
      isActive: true,
    })

    await request(BASE_URL)
      .delete(`/api/v1/admin/discount-codes/${discountCode.id}`)
      .set('Cookie', cookies)
      .expect(200)

    const deleted = await DiscountCode.find(discountCode.id)
    assert.isNull(deleted)
  })
})

test.group('Billing API - Validate Discount Code', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/billing/validate-discount-code requires authentication', async () => {
    await request(BASE_URL)
      .post('/api/v1/billing/validate-discount-code')
      .send({ code: 'TEST', priceId: 1 })
      .expect(401)
  })

  test('POST /api/v1/billing/validate-discount-code validates percent discount', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { tenant, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')
    const { price } = await createTestPrice()

    const discountCode = `VALID${id}`.toUpperCase()
    await DiscountCode.create({
      code: discountCode,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/validate-discount-code')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ code: discountCode, priceId: price.id, tenantId: tenant.id })
      .expect(200)

    assert.equal(response.body.data.valid, true)
    assert.equal(response.body.data.originalAmount, 1999)
    assert.equal(response.body.data.discountApplied, 400) // 20% of 1999 = 399.8, rounds to 400
    assert.equal(response.body.data.discountedAmount, 1599)
  })

  test('POST /api/v1/billing/validate-discount-code validates fixed discount', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { tenant, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')
    const { price } = await createTestPrice()

    const discountCode = `FIXED${id}`.toUpperCase()
    await DiscountCode.create({
      code: discountCode,
      discountType: 'fixed',
      discountValue: 500,
      currency: 'usd',
      isActive: true,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/validate-discount-code')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ code: discountCode, priceId: price.id, tenantId: tenant.id })
      .expect(200)

    assert.equal(response.body.data.valid, true)
    assert.equal(response.body.data.discountApplied, 500)
    assert.equal(response.body.data.discountedAmount, 1499)
  })

  test('POST /api/v1/billing/validate-discount-code rejects expired code', async ({ assert }) => {
    const id = uniqueId()
    const { tenant, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')
    const { price } = await createTestPrice()

    const discountCode = `EXPIRED${id}`.toUpperCase()
    await DiscountCode.create({
      code: discountCode,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/validate-discount-code')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ code: discountCode, priceId: price.id, tenantId: tenant.id })
      .expect(200)

    assert.equal(response.body.data.valid, false)
    assert.exists(response.body.data.message)
  })

  test('POST /api/v1/billing/validate-discount-code rejects inactive code', async ({ assert }) => {
    const id = uniqueId()
    const { tenant, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')
    const { price } = await createTestPrice()

    const discountCode = `INACTIVE${id}`.toUpperCase()
    await DiscountCode.create({
      code: discountCode,
      discountType: 'percent',
      discountValue: 20,
      isActive: false,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/validate-discount-code')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ code: discountCode, priceId: price.id, tenantId: tenant.id })
      .expect(200)

    assert.equal(response.body.data.valid, false)
  })

  test('POST /api/v1/billing/validate-discount-code respects max uses', async ({ assert }) => {
    const id = uniqueId()
    const { tenant, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')
    const { price } = await createTestPrice()

    const code = `MAXUSE${id}`.toUpperCase()
    await DiscountCode.create({
      code,
      discountType: 'percent',
      discountValue: 20,
      maxUses: 1,
      timesUsed: 1,
      isActive: true,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/validate-discount-code')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ code, priceId: price.id, tenantId: tenant.id })
      .expect(200)

    assert.equal(response.body.data.valid, false)
  })

  test('POST /api/v1/billing/validate-discount-code respects max uses per tenant', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { user, tenant, cookies } = await createUserAndLogin(
      `user-${id}@example.com`,
      'password123'
    )
    const { price } = await createTestPrice()

    const code = `TENANTMAX${id}`.toUpperCase()
    const discountCode = await DiscountCode.create({
      code,
      discountType: 'percent',
      discountValue: 20,
      maxUsesPerTenant: 1,
      isActive: true,
    })

    // Record a usage for this tenant
    await DiscountCodeUsage.create({
      discountCodeId: discountCode.id,
      tenantId: tenant.id,
      userId: user.id,
      usedAt: DateTime.now(),
      checkoutSessionId: `session_${uniqueId()}`,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/validate-discount-code')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ code, priceId: price.id, tenantId: tenant.id })
      .expect(200)

    assert.equal(response.body.data.valid, false)
  })

  test('POST /api/v1/billing/validate-discount-code rejects non-existent code', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { tenant, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')
    const { price } = await createTestPrice()

    const response = await request(BASE_URL)
      .post('/api/v1/billing/validate-discount-code')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .send({ code: 'NONEXISTENT', priceId: price.id, tenantId: tenant.id })
      .expect(200)

    assert.equal(response.body.data.valid, false)
  })
})

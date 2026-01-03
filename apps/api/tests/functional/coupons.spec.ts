import { test } from '@japa/runner'
import User from '#models/user'
import Team from '#models/team'
import Coupon from '#models/coupon'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'
import { DateTime } from 'luxon'

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

test.group('Admin Coupons API - List', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/admin/coupons requires admin role', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123', {
      role: 'user',
    })

    const response = await request(BASE_URL)
      .get('/api/v1/admin/coupons')
      .set('Cookie', cookies)
      .expect(403)

    assert.equal(response.body.error, 'Forbidden')
  })

  test('GET /api/v1/admin/coupons returns empty array when no coupons exist', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .get('/api/v1/admin/coupons')
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
    assert.equal(response.body.data.length, 0)
  })

  test('GET /api/v1/admin/coupons returns all coupons with redemption info', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    await Coupon.create({
      code: `GIFT${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
    })

    await Coupon.create({
      code: `REDEEMED${id}`,
      creditAmount: 1000,
      currency: 'usd',
      isActive: false,
      redeemedByUserId: user.id,
      redeemedAt: DateTime.now(),
    })

    const response = await request(BASE_URL)
      .get('/api/v1/admin/coupons')
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
    assert.equal(response.body.data.length, 2)

    const redeemed = response.body.data.find(
      (c: { code: string }) => c.code === `REDEEMED${id}`.toUpperCase()
    )
    assert.exists(redeemed?.redeemedByUserId)
    assert.exists(redeemed.redeemedByUserEmail)
  })
})

test.group('Admin Coupons API - Create', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/admin/coupons creates coupon', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .post('/api/v1/admin/coupons')
      .set('Cookie', cookies)
      .send({
        code: `GIFT${id}`,
        description: 'Gift coupon',
        creditAmount: 5000,
        currency: 'usd',
        expiresAt: '2027-12-31',
      })
      .expect(201)

    assert.exists(response.body.data.id)
    assert.equal(response.body.data.code, `GIFT${id}`.toUpperCase())
    assert.equal(response.body.data.creditAmount, 5000)
    assert.equal(response.body.data.currency, 'usd')
    assert.equal(response.body.data.isActive, true)
    assert.isTrue(
      response.body.data.redeemedByUserId === null ||
        response.body.data.redeemedByUserId === undefined
    )
  })

  test('POST /api/v1/admin/coupons rejects duplicate code', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    await Coupon.create({
      code: `DUPE${id}`.toUpperCase(),
      creditAmount: 1000,
      currency: 'usd',
      isActive: true,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/admin/coupons')
      .set('Cookie', cookies)
      .send({
        code: `DUPE${id}`,
        creditAmount: 2000,
        currency: 'usd',
      })
      .expect(409)

    assert.exists(response.body.error)
  })

  test('POST /api/v1/admin/coupons validates required fields', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .post('/api/v1/admin/coupons')
      .set('Cookie', cookies)
      .send({})
      .expect(422)

    assert.exists(response.body.errors)
  })
})

test.group('Admin Coupons API - Update', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('PUT /api/v1/admin/coupons/:id updates coupon', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const coupon = await Coupon.create({
      code: `UPDATE${id}`,
      creditAmount: 1000,
      currency: 'usd',
      isActive: true,
    })

    const response = await request(BASE_URL)
      .put(`/api/v1/admin/coupons/${coupon.id}`)
      .set('Cookie', cookies)
      .send({
        description: 'Updated description',
        creditAmount: 2000,
        isActive: false,
      })
      .expect(200)

    assert.equal(response.body.data.description, 'Updated description')
    assert.equal(response.body.data.creditAmount, 2000)
    assert.equal(response.body.data.isActive, false)
  })

  test('PUT /api/v1/admin/coupons/:id rejects update of redeemed coupon', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const coupon = await Coupon.create({
      code: `REDEEMED${id}`,
      creditAmount: 1000,
      currency: 'usd',
      isActive: false,
      redeemedByUserId: user.id,
      redeemedAt: DateTime.now(),
    })

    const response = await request(BASE_URL)
      .put(`/api/v1/admin/coupons/${coupon.id}`)
      .set('Cookie', cookies)
      .send({ creditAmount: 2000 })
      .expect(400)

    assert.exists(response.body.error)
  })

  test('PUT /api/v1/admin/coupons/:id returns 404 for non-existent coupon', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const response = await request(BASE_URL)
      .put('/api/v1/admin/coupons/99999')
      .set('Cookie', cookies)
      .send({ creditAmount: 2000 })
      .expect(404)

    // AdonisJS findOrFail returns { message: ... } format
    assert.isTrue(response.status === 404)
  })
})

test.group('Admin Coupons API - Delete', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('DELETE /api/v1/admin/coupons/:id deletes coupon', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`admin-${id}@example.com`, 'password123', {
      role: 'admin',
    })

    const coupon = await Coupon.create({
      code: `DELETE${id}`,
      creditAmount: 1000,
      currency: 'usd',
      isActive: true,
    })

    await request(BASE_URL)
      .delete(`/api/v1/admin/coupons/${coupon.id}`)
      .set('Cookie', cookies)
      .expect(200)

    const deleted = await Coupon.find(coupon.id)
    assert.isNull(deleted)
  })
})

test.group('Billing API - Redeem Coupon', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/billing/redeem-coupon requires authentication', async () => {
    await request(BASE_URL).post('/api/v1/billing/redeem-coupon').send({ code: 'TEST' }).expect(401)
  })

  test('POST /api/v1/billing/redeem-coupon redeems valid coupon for user', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const couponCode = `REDEEM${id}`.toUpperCase()
    await Coupon.create({
      code: couponCode,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/redeem-coupon')
      .set('Cookie', cookies)
      .send({ code: couponCode })
      .expect(200)

    assert.equal(response.body.data.success, true)
    assert.equal(response.body.data.creditAmount, 5000)
    assert.equal(response.body.data.currency, 'usd')
    assert.equal(response.body.data.newBalance, 5000)

    // Verify user balance was updated
    await user.refresh()
    assert.equal(user.balance, 5000)
    assert.equal(user.balanceCurrency, 'usd')

    // Verify coupon was marked as redeemed
    const coupon = await Coupon.findByCode(couponCode)
    assert.isNotNull(coupon)
    assert.equal(coupon!.redeemedByUserId, user.id)
    assert.equal(coupon!.isActive, false)
  })

  test('POST /api/v1/billing/redeem-coupon redeems valid coupon for team', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: user.id,
    })

    const couponCode = `TEAMREDEEM${id}`.toUpperCase()
    await Coupon.create({
      code: couponCode,
      creditAmount: 10000,
      currency: 'usd',
      isActive: true,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/redeem-coupon')
      .set('Cookie', cookies)
      .send({ code: couponCode, teamId: team.id })
      .expect(200)

    assert.equal(response.body.data.success, true)
    assert.equal(response.body.data.creditAmount, 10000)
    assert.equal(response.body.data.newBalance, 10000)

    // Verify team balance was updated
    await team.refresh()
    assert.equal(team.balance, 10000)
  })

  test('POST /api/v1/billing/redeem-coupon rejects expired coupon', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const couponCode = `EXPIRED${id}`.toUpperCase()
    await Coupon.create({
      code: couponCode,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/redeem-coupon')
      .set('Cookie', cookies)
      .send({ code: couponCode })
      .expect(400)

    assert.exists(response.body.error)
  })

  test('POST /api/v1/billing/redeem-coupon rejects inactive coupon', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const couponCode = `INACTIVE${id}`.toUpperCase()
    await Coupon.create({
      code: couponCode,
      creditAmount: 5000,
      currency: 'usd',
      isActive: false,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/redeem-coupon')
      .set('Cookie', cookies)
      .send({ code: couponCode })
      .expect(400)

    assert.exists(response.body.error)
  })

  test('POST /api/v1/billing/redeem-coupon rejects already redeemed coupon', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const otherUser = await User.create({
      email: `other-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const couponCode = `ALREADYREDEEMED${id}`.toUpperCase()
    await Coupon.create({
      code: couponCode,
      creditAmount: 5000,
      currency: 'usd',
      isActive: false,
      redeemedByUserId: otherUser.id,
      redeemedAt: DateTime.now(),
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/redeem-coupon')
      .set('Cookie', cookies)
      .send({ code: couponCode })
      .expect(400)

    assert.exists(response.body.error)
  })

  test('POST /api/v1/billing/redeem-coupon rejects non-existent coupon', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const response = await request(BASE_URL)
      .post('/api/v1/billing/redeem-coupon')
      .set('Cookie', cookies)
      .send({ code: 'NONEXISTENT' })
      .expect(400)

    assert.exists(response.body.error)
  })

  test('POST /api/v1/billing/redeem-coupon rejects team redemption by non-owner', async ({
    assert,
  }) => {
    const id = uniqueId()

    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    const { user: member, cookies } = await createUserAndLogin(
      `member-${id}@example.com`,
      'password123'
    )

    await team.related('members').create({
      userId: member.id,
      role: 'member',
    })

    const couponCode = `TEAMONLY${id}`.toUpperCase()
    await Coupon.create({
      code: couponCode,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/billing/redeem-coupon')
      .set('Cookie', cookies)
      .send({ code: couponCode, teamId: team.id })
      .expect(403)

    assert.exists(response.body.error)
  })
})

test.group('Billing API - Get Balance', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/billing/balance requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/billing/balance').expect(401)
  })

  test('GET /api/v1/billing/balance returns user balance', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    user.balance = 5000
    user.balanceCurrency = 'usd'
    await user.save()

    const response = await request(BASE_URL)
      .get('/api/v1/billing/balance')
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.balance, 5000)
    assert.equal(response.body.data.currency, 'usd')
  })

  test('GET /api/v1/billing/balance returns team balance', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: user.id,
      balance: 10000,
      balanceCurrency: 'usd',
    })

    const response = await request(BASE_URL)
      .get(`/api/v1/billing/balance?teamId=${team.id}`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.balance, 10000)
    assert.equal(response.body.data.currency, 'usd')
  })

  test('GET /api/v1/billing/balance returns zero for new user', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`user-${id}@example.com`, 'password123')

    const response = await request(BASE_URL)
      .get('/api/v1/billing/balance')
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.balance, 0)
    assert.equal(response.body.data.currency, 'usd')
  })
})

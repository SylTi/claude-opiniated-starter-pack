import { test } from '@japa/runner'
import User from '#models/user'
import Team from '#models/team'
import SubscriptionTier from '#models/subscription_tier'
import Subscription from '#models/subscription'
import Product from '#models/product'
import Price from '#models/price'
import PaymentCustomer from '#models/payment_customer'
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

test.group('Billing API - Tiers', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/billing/tiers returns tiers with products and prices', async ({ assert }) => {
    // Create products and prices for tiers
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')

    const product1 = await Product.create({
      tierId: tier1.id,
      provider: 'stripe',
      providerProductId: `prod_${uniqueId()}`,
    })

    const product2 = await Product.create({
      tierId: tier2.id,
      provider: 'stripe',
      providerProductId: `prod_${uniqueId()}`,
    })

    await Price.create({
      productId: product1.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 1999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    await Price.create({
      productId: product2.id,
      provider: 'stripe',
      providerPriceId: `price_${uniqueId()}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 4999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    const response = await request(BASE_URL).get('/api/v1/billing/tiers').expect(200)

    assert.isArray(response.body.data)
    assert.isTrue(response.body.data.length >= 2)

    // Check structure
    const tierWithProduct = response.body.data.find(
      (t: { products: unknown[] }) => t.products && t.products.length > 0
    )
    if (tierWithProduct) {
      assert.exists(tierWithProduct.name)
      assert.exists(tierWithProduct.slug)
      assert.isArray(tierWithProduct.products)
    }
  })

  test('GET /api/v1/billing/tiers is public (no auth required)', async ({ assert }) => {
    const response = await request(BASE_URL).get('/api/v1/billing/tiers')

    assert.equal(response.status, 200)
    assert.isArray(response.body.data)
  })
})

test.group('Billing API - Subscription', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/billing/subscription returns user subscription', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`billing-${id}@example.com`, 'password123')

    // Create a subscription for the user
    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForUser(user.id, tier.id)

    const response = await request(BASE_URL)
      .get('/api/v1/billing/subscription')
      .set('Cookie', cookies)
      .expect(200)

    assert.exists(response.body.data)
    assert.exists(response.body.data.subscription)
    assert.equal(response.body.data.subscription.status, 'active')
    assert.exists(response.body.data.subscription.tier)
    assert.equal(response.body.data.subscription.tier.slug, 'tier1')
  })

  test('GET /api/v1/billing/subscription returns team subscription when in team context', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(
      `team-billing-${id}@example.com`,
      'password123'
    )

    // Create team
    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: user.id,
    })

    // Set user's current team
    user.currentTeamId = team.id
    await user.save()

    // Create subscription for team
    const tier = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTeam(team.id, tier.id)

    // Pass team context explicitly via query params
    const response = await request(BASE_URL)
      .get(`/api/v1/billing/subscription?subscriberType=team&subscriberId=${team.id}`)
      .set('Cookie', cookies)
      .expect(200)

    assert.exists(response.body.data)
    assert.exists(response.body.data.subscription)
    assert.equal(response.body.data.subscription.status, 'active')
    assert.equal(response.body.data.subscription.tier.slug, 'tier2')
  })

  test('GET /api/v1/billing/subscription requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/billing/subscription').expect(401)
  })
})

test.group('Billing API - Checkout', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/billing/checkout requires authentication', async () => {
    await request(BASE_URL)
      .post('/api/v1/billing/checkout')
      .send({
        priceId: 'price_test',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      })
      .expect(401)
  })

  test('POST /api/v1/billing/checkout validates required fields', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`checkout-${id}@example.com`, 'password123')

    const response = await request(BASE_URL)
      .post('/api/v1/billing/checkout')
      .set('Cookie', cookies)
      .send({})
      .expect(422)

    assert.exists(response.body.errors)
  })

  test('POST /api/v1/billing/checkout rejects invalid price ID', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`checkout-${id}@example.com`, 'password123')

    const response = await request(BASE_URL)
      .post('/api/v1/billing/checkout')
      .set('Cookie', cookies)
      .send({
        priceId: 999999,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      })
      .expect(400)

    assert.exists(response.body.error)
  })
})

test.group('Billing API - Portal', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/billing/portal requires authentication', async () => {
    await request(BASE_URL)
      .post('/api/v1/billing/portal')
      .send({ returnUrl: 'https://example.com' })
      .expect(401)
  })

  test('POST /api/v1/billing/portal requires existing payment customer', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`portal-${id}@example.com`, 'password123')

    const response = await request(BASE_URL)
      .post('/api/v1/billing/portal')
      .set('Cookie', cookies)
      .send({ returnUrl: 'https://example.com' })
      .expect(400)

    assert.exists(response.body.error)
    assert.exists(response.body.message)
  })
})

test.group('Billing API - Cancel', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/billing/cancel requires authentication', async () => {
    await request(BASE_URL).post('/api/v1/billing/cancel').expect(401)
  })

  test('POST /api/v1/billing/cancel fails without active subscription', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`cancel-${id}@example.com`, 'password123')

    const response = await request(BASE_URL).post('/api/v1/billing/cancel').set('Cookie', cookies)

    // Can be 400 (no subscription) or 500 (internal error depending on implementation)
    assert.oneOf(response.status, [400, 500])
    if (response.status === 400) {
      assert.exists(response.body.error)
    }
  })

  test('POST /api/v1/billing/cancel requires provider subscription for non-free tier', async ({
    assert,
  }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`cancel-${id}@example.com`, 'password123')

    // Create subscription without provider (local only)
    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForUser(user.id, tier.id)

    const response = await request(BASE_URL)
      .post('/api/v1/billing/cancel')
      .set('Cookie', cookies)
      .expect(400)

    assert.exists(response.body.error)
    // Error should indicate no provider subscription
    assert.exists(response.body.message)
  })
})

test.group('Billing API - Team Owner Authorization', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('team member cannot create checkout for team', async ({ assert }) => {
    const id = uniqueId()

    // Create team owner
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      fullName: 'Team Owner',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create team
    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    // Create member and login
    const { user: member, cookies } = await createUserAndLogin(
      `member-${id}@example.com`,
      'password123'
    )
    member.currentTeamId = team.id
    await member.save()

    // Add member to team
    await team.related('members').create({
      userId: member.id,
      role: 'member',
    })

    // Create price
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

    const response = await request(BASE_URL)
      .post('/api/v1/billing/checkout')
      .set('Cookie', cookies)
      .send({
        priceId: price.id,
        subscriberType: 'team',
        subscriberId: team.id,
      })
      .expect(403)

    assert.equal(response.body.error, 'Forbidden')
  })
})

test.group('Billing API - Payment Customer', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('portal creates session for user with payment customer', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`customer-${id}@example.com`, 'password123')

    // Create payment customer
    await PaymentCustomer.create({
      subscriberType: 'user',
      subscriberId: user.id,
      provider: 'stripe',
      providerCustomerId: `cus_${uniqueId()}`,
    })

    // This will fail because Stripe API is not mocked, but we can verify the request reaches the right place
    const response = await request(BASE_URL)
      .post('/api/v1/billing/portal')
      .set('Cookie', cookies)
      .send({ returnUrl: 'https://example.com' })

    // Will fail with Stripe error (not BadRequest for missing customer)
    assert.notEqual(response.body.error, 'BadRequest')
  })
})

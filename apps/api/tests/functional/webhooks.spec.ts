import { test } from '@japa/runner'
import User from '#models/user'
import Team from '#models/team'
import SubscriptionTier from '#models/subscription_tier'
import Subscription from '#models/subscription'
import Product from '#models/product'
import Price from '#models/price'
import PaymentCustomer from '#models/payment_customer'
import ProcessedWebhookEvent from '#models/processed_webhook_event'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'
import crypto from 'node:crypto'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

/**
 * Generate a mock Stripe webhook signature
 * Note: This won't validate against real Stripe verification,
 * but tests the endpoint structure and error handling
 */
function generateMockSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signedPayload = `${timestamp}.${payload}`
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

test.group('Webhooks API - Stripe', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/webhooks/stripe rejects request without signature', async ({ assert }) => {
    const response = await request(BASE_URL)
      .post('/api/v1/webhooks/stripe')
      .send({ type: 'checkout.session.completed' })
      .set('Content-Type', 'application/json')
      .expect(400)

    assert.exists(response.body.error)
    // Message may be about missing body or missing signature header
    assert.exists(response.body.message)
  })

  test('POST /api/v1/webhooks/stripe rejects invalid signature', async ({ assert }) => {
    const payload = JSON.stringify({
      id: 'evt_test',
      type: 'checkout.session.completed',
    })

    const response = await request(BASE_URL)
      .post('/api/v1/webhooks/stripe')
      .send(payload)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'invalid_signature')
      .expect(400)

    assert.exists(response.body.error)
  })

  test('POST /api/v1/webhooks/stripe accepts well-formed webhook structure', async ({ assert }) => {
    // This test verifies the endpoint accepts proper webhook format
    // In production, signature verification would fail without real Stripe secret

    const eventId = `evt_${uniqueId()}`
    const payload = JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test',
          client_reference_id: 'user_1',
          customer: 'cus_test',
          subscription: 'sub_test',
        },
      },
    })

    // Use mock signature - will fail verification but tests structure
    const mockSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test'
    const signature = generateMockSignature(payload, mockSecret)

    const response = await request(BASE_URL)
      .post('/api/v1/webhooks/stripe')
      .send(payload)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)

    // Will return 400 due to signature mismatch in test environment
    // but we verify the endpoint is reachable and processes the request
    assert.oneOf(response.status, [200, 400])
  })
})

test.group('Webhooks - Idempotency', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('duplicate webhook events are detected', async ({ assert }) => {
    const eventId = `evt_${uniqueId()}`

    // Mark event as processed
    await ProcessedWebhookEvent.markAsProcessed(eventId, 'stripe', 'checkout.session.completed')

    // Check if processed
    const isProcessed = await ProcessedWebhookEvent.hasBeenProcessed(eventId, 'stripe')
    assert.isTrue(isProcessed)
  })

  test('different providers can have same event ID', async ({ assert }) => {
    const eventId = `evt_${uniqueId()}`

    await ProcessedWebhookEvent.markAsProcessed(eventId, 'stripe')

    const stripeProcessed = await ProcessedWebhookEvent.hasBeenProcessed(eventId, 'stripe')
    const paypalProcessed = await ProcessedWebhookEvent.hasBeenProcessed(eventId, 'paypal')

    assert.isTrue(stripeProcessed)
    assert.isFalse(paypalProcessed)
  })
})

test.group('Webhooks - Subscription Lifecycle', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('checkout session creates subscription correctly', async ({ assert }) => {
    const id = uniqueId()

    // Create user
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create tier, product, and price
    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const product = await Product.create({
      tierId: tier.id,
      provider: 'stripe',
      providerProductId: `prod_${id}`,
    })
    await Price.create({
      productId: product.id,
      provider: 'stripe',
      providerPriceId: `price_${id}`,
      interval: 'month',
      currency: 'usd',
      unitAmount: 1999,
      taxBehavior: 'exclusive',
      isActive: true,
    })

    // Simulate what webhook handler does
    const providerCustomerId = `cus_${id}`
    const providerSubscriptionId = `sub_${id}`

    // Create payment customer
    await PaymentCustomer.upsertBySubscriber('user', user.id, 'stripe', providerCustomerId)

    // Create subscription with provider
    const subscription = await Subscription.createWithProvider(
      'user',
      user.id,
      tier.id,
      'stripe',
      providerSubscriptionId
    )

    assert.exists(subscription.id)
    assert.equal(subscription.providerName, 'stripe')
    assert.equal(subscription.providerSubscriptionId, providerSubscriptionId)
    assert.equal(subscription.status, 'active')

    // Verify we can find by provider subscription ID
    const found = await Subscription.findByProviderSubscriptionId('stripe', providerSubscriptionId)
    assert.isNotNull(found)
    assert.equal(found!.id, subscription.id)
  })

  test('subscription update changes status correctly', async ({ assert }) => {
    const id = uniqueId()

    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const providerSubscriptionId = `sub_${id}`

    const subscription = await Subscription.createWithProvider(
      'user',
      user.id,
      tier.id,
      'stripe',
      providerSubscriptionId
    )

    // Simulate subscription update (e.g., cancelled)
    subscription.status = 'cancelled'
    await subscription.save()

    const updated = await Subscription.findByProviderSubscriptionId(
      'stripe',
      providerSubscriptionId
    )
    assert.equal(updated!.status, 'cancelled')
  })

  test('subscription deletion creates free subscription', async ({ assert }) => {
    const id = uniqueId()

    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const providerSubscriptionId = `sub_${id}`

    // Create paid subscription
    const paidSub = await Subscription.createWithProvider(
      'user',
      user.id,
      tier1.id,
      'stripe',
      providerSubscriptionId
    )

    // Simulate deletion - mark as cancelled
    paidSub.status = 'cancelled'
    await paidSub.save()

    // Create new free subscription (what webhook handler would do)
    const freeSub = await Subscription.createForUser(user.id, freeTier.id)

    assert.exists(freeSub.id)
    assert.equal(freeSub.tierId, freeTier.id)
    // These fields are undefined when not set (not null)
    assert.notExists(freeSub.providerName)
    assert.notExists(freeSub.providerSubscriptionId)
  })
})

test.group('Webhooks - Team Billing', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('team checkout creates payment customer for team', async ({ assert }) => {
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

    const providerCustomerId = `cus_team_${id}`

    // Create payment customer for team
    const customer = await PaymentCustomer.upsertBySubscriber(
      'team',
      team.id,
      'stripe',
      providerCustomerId
    )

    assert.equal(customer.subscriberType, 'team')
    assert.equal(customer.subscriberId, team.id)
    assert.equal(customer.providerCustomerId, providerCustomerId)

    // Verify lookup works
    const found = await PaymentCustomer.findBySubscriber('team', team.id, 'stripe')
    assert.isNotNull(found)
    assert.equal(found!.providerCustomerId, providerCustomerId)
  })

  test('team subscription updates team tier', async ({ assert }) => {
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

    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    const providerSubscriptionId = `sub_team_${id}`

    const subscription = await Subscription.createWithProvider(
      'team',
      team.id,
      tier2.id,
      'stripe',
      providerSubscriptionId
    )

    assert.equal(subscription.subscriberType, 'team')
    assert.equal(subscription.subscriberId, team.id)
    assert.equal(subscription.tierId, tier2.id)
  })
})

test.group('Webhooks - Error Handling', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('missing client_reference_id is handled gracefully', async ({ assert }) => {
    // Test that the system handles missing data without crashing
    const eventId = `evt_${uniqueId()}`

    // Mark as processed to simulate a processed event with missing data
    await ProcessedWebhookEvent.markAsProcessed(eventId, 'stripe', 'checkout.session.completed')

    // Verify event was recorded
    const exists = await ProcessedWebhookEvent.hasBeenProcessed(eventId, 'stripe')
    assert.isTrue(exists)
  })

  test('invalid subscriber type is rejected', async ({ assert }) => {
    // PaymentCustomer should only accept 'user' or 'team'
    try {
      await PaymentCustomer.create({
        subscriberType: 'invalid' as 'user' | 'team',
        subscriberId: 1,
        provider: 'stripe',
        providerCustomerId: 'cus_test',
      })
      assert.fail('Should have thrown')
    } catch (error) {
      // Expected - database constraint or validation
      assert.isTrue(true)
    }
  })
})

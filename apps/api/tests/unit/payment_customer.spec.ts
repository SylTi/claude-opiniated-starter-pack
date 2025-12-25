import { test } from '@japa/runner'
import User from '#models/user'
import Team from '#models/team'
import PaymentCustomer from '#models/payment_customer'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('PaymentCustomer Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('findBySubscriber returns null when not found', async ({ assert }) => {
    const customer = await PaymentCustomer.findBySubscriber('user', 999, 'stripe')
    assert.isNull(customer)
  })

  test('findOrCreateBySubscriber creates new customer for user', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const customer = await PaymentCustomer.findOrCreateBySubscriber(
      'user',
      user.id,
      'stripe',
      'cus_test123'
    )

    assert.exists(customer.id)
    assert.equal(customer.subscriberType, 'user')
    assert.equal(customer.subscriberId, user.id)
    assert.equal(customer.provider, 'stripe')
    assert.equal(customer.providerCustomerId, 'cus_test123')
  })

  test('findOrCreateBySubscriber returns existing customer', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const customer1 = await PaymentCustomer.findOrCreateBySubscriber(
      'user',
      user.id,
      'stripe',
      'cus_test123'
    )

    const customer2 = await PaymentCustomer.findOrCreateBySubscriber(
      'user',
      user.id,
      'stripe',
      'cus_different'
    )

    assert.equal(customer1.id, customer2.id)
    assert.equal(customer2.providerCustomerId, 'cus_test123') // Original value preserved
  })

  test('upsertBySubscriber creates new customer', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const customer = await PaymentCustomer.upsertBySubscriber(
      'user',
      user.id,
      'stripe',
      'cus_test123'
    )

    assert.exists(customer.id)
    assert.equal(customer.providerCustomerId, 'cus_test123')
  })

  test('upsertBySubscriber updates existing customer', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await PaymentCustomer.upsertBySubscriber('user', user.id, 'stripe', 'cus_old')
    const customer = await PaymentCustomer.upsertBySubscriber('user', user.id, 'stripe', 'cus_new')

    assert.equal(customer.providerCustomerId, 'cus_new')

    // Verify only one record exists
    const all = await PaymentCustomer.query()
      .where('subscriberType', 'user')
      .where('subscriberId', user.id)
    assert.equal(all.length, 1)
  })

  test('findOrCreateBySubscriber works for teams', async ({ assert }) => {
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

    const customer = await PaymentCustomer.findOrCreateBySubscriber(
      'team',
      team.id,
      'stripe',
      'cus_team123'
    )

    assert.equal(customer.subscriberType, 'team')
    assert.equal(customer.subscriberId, team.id)
    assert.equal(customer.providerCustomerId, 'cus_team123')
  })

  test('findByProviderCustomerId returns customer', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await PaymentCustomer.create({
      subscriberType: 'user',
      subscriberId: user.id,
      provider: 'stripe',
      providerCustomerId: 'cus_unique123',
    })

    const customer = await PaymentCustomer.findByProviderCustomerId('stripe', 'cus_unique123')
    assert.isNotNull(customer)
    assert.equal(customer!.subscriberId, user.id)
  })

  test('findByProviderCustomerId returns null for non-existent', async ({ assert }) => {
    const customer = await PaymentCustomer.findByProviderCustomerId('stripe', 'cus_nonexistent')
    assert.isNull(customer)
  })

  test('upsertBySubscriber creates customer for team', async ({ assert }) => {
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

    const customer = await PaymentCustomer.upsertBySubscriber(
      'team',
      team.id,
      'stripe',
      `cus_team_${id}`
    )

    assert.equal(customer.subscriberType, 'team')
    assert.equal(customer.subscriberId, team.id)
  })
})

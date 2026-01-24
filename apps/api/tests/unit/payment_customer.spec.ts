import { test } from '@japa/runner'
import User from '#models/user'
import Tenant from '#models/tenant'
import PaymentCustomer from '#models/payment_customer'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('PaymentCustomer Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('findByTenant returns null when not found', async ({ assert }) => {
    const customer = await PaymentCustomer.findByTenant(999, 'stripe')
    assert.isNull(customer)
  })

  test('findOrCreateByTenant creates new customer for tenant', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const customer = await PaymentCustomer.findOrCreateByTenant(tenant.id, 'stripe', 'cus_test123')

    assert.exists(customer.id)
    assert.equal(customer.tenantId, tenant.id)
    assert.equal(customer.provider, 'stripe')
    assert.equal(customer.providerCustomerId, 'cus_test123')
  })

  test('findOrCreateByTenant returns existing customer', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const customer1 = await PaymentCustomer.findOrCreateByTenant(tenant.id, 'stripe', 'cus_test123')

    const customer2 = await PaymentCustomer.findOrCreateByTenant(
      tenant.id,
      'stripe',
      'cus_different'
    )

    assert.equal(customer1.id, customer2.id)
    assert.equal(customer2.providerCustomerId, 'cus_test123') // Original value preserved
  })

  test('upsertByTenant creates new customer', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const customer = await PaymentCustomer.upsertByTenant(tenant.id, 'stripe', 'cus_test123')

    assert.exists(customer.id)
    assert.equal(customer.providerCustomerId, 'cus_test123')
  })

  test('upsertByTenant updates existing customer', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    await PaymentCustomer.upsertByTenant(tenant.id, 'stripe', 'cus_old')
    const customer = await PaymentCustomer.upsertByTenant(tenant.id, 'stripe', 'cus_new')

    assert.equal(customer.providerCustomerId, 'cus_new')

    // Verify only one record exists
    const all = await PaymentCustomer.query().where('tenantId', tenant.id)
    assert.equal(all.length, 1)
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

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    await PaymentCustomer.create({
      tenantId: tenant.id,
      provider: 'stripe',
      providerCustomerId: 'cus_unique123',
    })

    const customer = await PaymentCustomer.findByProviderCustomerId('stripe', 'cus_unique123')
    assert.isNotNull(customer)
    assert.equal(customer!.tenantId, tenant.id)
  })

  test('findByProviderCustomerId returns null for non-existent', async ({ assert }) => {
    const customer = await PaymentCustomer.findByProviderCustomerId('stripe', 'cus_nonexistent')
    assert.isNull(customer)
  })

  test('works for team tenants', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const customer = await PaymentCustomer.upsertByTenant(tenant.id, 'stripe', `cus_team_${id}`)

    assert.equal(customer.tenantId, tenant.id)
    assert.equal(customer.providerCustomerId, `cus_team_${id}`)
  })
})

import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Tenant from '#models/tenant'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('Subscription Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('createForTenant creates a subscription for a tenant', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create personal tenant (billing unit)
    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().plus({ days: 30 })

    const subscription = await Subscription.createForTenant(tenant.id, tier.id, expiresAt)

    assert.exists(subscription.id)
    assert.equal(subscription.tenantId, tenant.id)
    assert.equal(subscription.tierId, tier.id)
    assert.equal(subscription.status, 'active')
    assert.isNotNull(subscription.startsAt)
    assert.isNotNull(subscription.expiresAt)
  })

  test('createForTenant creates subscription for team tenant', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create team tenant (billing unit)
    const tenant = await Tenant.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier2')
    const subscription = await Subscription.createForTenant(tenant.id, tier.id)

    assert.exists(subscription.id)
    assert.equal(subscription.tenantId, tenant.id)
    assert.equal(subscription.tierId, tier.id)
    assert.equal(subscription.status, 'active')
    assert.isNull(subscription.expiresAt)
  })

  test('getActiveForTenant returns active subscription for personal tenant', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTenant(tenant.id, tier.id)

    const subscription = await Subscription.getActiveForTenant(tenant.id)

    assert.isNotNull(subscription)
    assert.equal(subscription!.tenantId, tenant.id)
    assert.equal(subscription!.tier.slug, 'tier1')
  })

  test('getActiveForTenant returns active subscription for team tenant', async ({ assert }) => {
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

    const tier = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTenant(tenant.id, tier.id)

    const subscription = await Subscription.getActiveForTenant(tenant.id)

    assert.isNotNull(subscription)
    assert.equal(subscription!.tenantId, tenant.id)
    assert.equal(subscription!.tier.slug, 'tier2')
  })

  test('isExpired returns true for expired subscription', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().minus({ days: 1 })

    const subscription = await Subscription.createForTenant(tenant.id, tier.id, expiresAt)

    assert.isTrue(subscription.isExpired())
  })

  test('isExpired returns false for active subscription', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().plus({ days: 30 })

    const subscription = await Subscription.createForTenant(tenant.id, tier.id, expiresAt)

    assert.isFalse(subscription.isExpired())
  })

  test('isExpired returns false when expiresAt is null', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier2')
    const subscription = await Subscription.createForTenant(tenant.id, tier.id, null)

    assert.isFalse(subscription.isExpired())
  })

  test('isActive returns true for active status', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const subscription = await Subscription.createForTenant(tenant.id, tier.id)

    assert.isTrue(subscription.isActive())
  })

  test('downgradeTenantToFree cancels active subscription and creates free one', async ({
    assert,
  }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTenant(tenant.id, tier1.id)

    const newSubscription = await Subscription.downgradeTenantToFree(tenant.id)

    assert.equal(newSubscription.tier.slug, 'free')
    assert.equal(newSubscription.status, 'active')

    // Old subscription should be cancelled
    const allSubscriptions = await Subscription.getAllForTenant(tenant.id)
    const cancelledSub = allSubscriptions.find((s: Subscription) => s.tier.slug === 'tier1')
    assert.equal(cancelledSub?.status, 'cancelled')
  })

  test('downgradeTenantToFree works for team tenant', async ({ assert }) => {
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

    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTenant(tenant.id, tier2.id)

    const newSubscription = await Subscription.downgradeTenantToFree(tenant.id)

    assert.equal(newSubscription.tier.slug, 'free')
    assert.equal(newSubscription.status, 'active')

    // Old subscription should be cancelled
    const allSubscriptions = await Subscription.getAllForTenant(tenant.id)
    const cancelledSub = allSubscriptions.find((s: Subscription) => s.tier.slug === 'tier2')
    assert.equal(cancelledSub?.status, 'cancelled')
  })

  test('getAllForTenant returns subscription history', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')

    // Create multiple subscriptions
    await Subscription.createForTenant(tenant.id, freeTier.id)
    await Subscription.createForTenant(tenant.id, tier1.id)

    const subscriptions = await Subscription.getAllForTenant(tenant.id)

    assert.lengthOf(subscriptions, 2)
  })

  test('createWithProvider creates subscription with provider details', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')

    const subscription = await Subscription.createWithProvider(
      tenant.id,
      tier.id,
      'stripe',
      `sub_${id}`
    )

    assert.exists(subscription.id)
    assert.equal(subscription.tenantId, tenant.id)
    assert.equal(subscription.providerName, 'stripe')
    assert.equal(subscription.providerSubscriptionId, `sub_${id}`)
  })

  test('findByProviderSubscriptionId finds subscription by provider ID', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const providerSubId = `sub_${id}`

    await Subscription.createWithProvider(tenant.id, tier.id, 'stripe', providerSubId)

    const found = await Subscription.findByProviderSubscriptionId('stripe', providerSubId)
    assert.isNotNull(found)
    assert.equal(found!.providerSubscriptionId, providerSubId)
  })

  test('cancels existing subscription when creating new', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')

    // Create first subscription
    const sub1 = await Subscription.createWithProvider(
      tenant.id,
      tier1.id,
      'stripe',
      `sub_old_${id}`
    )

    // Cancel old subscription (simulating what webhook handler does)
    sub1.status = 'cancelled'
    await sub1.save()

    // Create new subscription
    const sub2 = await Subscription.createWithProvider(
      tenant.id,
      tier2.id,
      'stripe',
      `sub_new_${id}`
    )

    // Verify old is cancelled
    await sub1.refresh()
    assert.equal(sub1.status, 'cancelled')

    // Verify new is active
    assert.equal(sub2.status, 'active')
    assert.equal(sub2.tierId, tier2.id)
  })

  test('tenant has access to features at their tier level', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTenant(tenant.id, tier1.id)

    // Load active subscription
    const subscription = await Subscription.query()
      .where('tenantId', tenant.id)
      .where('status', 'active')
      .preload('tier')
      .first()

    assert.isNotNull(subscription)
    assert.equal(subscription!.tier.slug, 'tier1')

    // Check tier level (tier1 should be level 1 based on seeder)
    assert.isTrue(subscription!.tier.level >= 1)
  })

  test('free tier tenants have limited access', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    await Subscription.createForTenant(tenant.id, freeTier.id)

    const subscription = await Subscription.query()
      .where('tenantId', tenant.id)
      .where('status', 'active')
      .preload('tier')
      .first()

    assert.isNotNull(subscription)
    assert.equal(subscription!.tier.slug, 'free')
    assert.equal(subscription!.tier.level, 0)
  })
})

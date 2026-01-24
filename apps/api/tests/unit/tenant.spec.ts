import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import User from '#models/user'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('Tenant Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('can create a tenant', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      fullName: 'Tenant Owner',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    assert.exists(tenant.id)
    assert.equal(tenant.name, 'Test Tenant')
    assert.equal(tenant.ownerId, owner.id)
  })

  test('slug must be unique', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await Tenant.create({
      name: 'Test Tenant',
      slug: `unique-slug-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    await assert.rejects(async () => {
      await Tenant.create({
        name: 'Another Tenant',
        slug: `unique-slug-${id}`,
        type: 'team',
        ownerId: owner.id,
      })
    })
  })

  test('getSubscriptionTier returns free tier when no subscription', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const tier = await tenant.getSubscriptionTier()
    assert.equal(tier.slug, 'free')
  })

  test('getSubscriptionTier returns correct tier when subscription exists', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTenant(tenant.id, tier2.id)

    const tier = await tenant.getSubscriptionTier()
    assert.equal(tier.slug, 'tier2')
  })

  test('getEffectiveMaxMembers uses maxMembers if set', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      maxMembers: 10,
      ownerId: owner.id,
    })

    const maxMembers = await tenant.getEffectiveMaxMembers()
    assert.equal(maxMembers, 10)
  })

  test('getEffectiveMaxMembers uses tier default if maxMembers not set', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    // Give tenant tier1 subscription (20 max members)
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTenant(tenant.id, tier1.id)
    await tenant.refresh()

    const maxMembers = await tenant.getEffectiveMaxMembers()
    assert.equal(maxMembers, 20)
  })

  test('getEffectiveMaxMembers returns null for tier2 (unlimited)', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    // Give tenant tier2 subscription (unlimited members)
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTenant(tenant.id, tier2.id)
    await tenant.refresh()

    const maxMembers = await tenant.getEffectiveMaxMembers()
    assert.isNull(maxMembers)
  })

  test('canAddMember returns true when below limit', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    // Free tier has 5 max members
    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    await Subscription.createForTenant(tenant.id, freeTier.id)
    await tenant.refresh()

    assert.isTrue(await tenant.canAddMember(4))
    assert.isFalse(await tenant.canAddMember(5))
    assert.isFalse(await tenant.canAddMember(6))
  })

  test('canAddMember returns true for unlimited tier', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    // Tier2 has unlimited members
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTenant(tenant.id, tier2.id)
    await tenant.refresh()

    assert.isTrue(await tenant.canAddMember(100))
    assert.isTrue(await tenant.canAddMember(1000))
  })

  test('isSubscriptionExpired returns true for expired subscription', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().minus({ days: 1 })
    await Subscription.createForTenant(tenant.id, tier1.id, expiresAt)

    assert.isTrue(await tenant.isSubscriptionExpired())
  })

  test('isSubscriptionExpired returns false for active subscription', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().plus({ days: 30 })
    await Subscription.createForTenant(tenant.id, tier1.id, expiresAt)

    assert.isFalse(await tenant.isSubscriptionExpired())
  })

  test('isSubscriptionExpired returns false when no subscription', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    assert.isFalse(await tenant.isSubscriptionExpired())
  })

  test('hasAccessToTier returns true for same or lower tier', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().plus({ days: 30 })
    await Subscription.createForTenant(tenant.id, tier1.id, expiresAt)

    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')

    assert.isTrue(await tenant.hasAccessToTier(freeTier))
    assert.isTrue(await tenant.hasAccessToTier(tier1))
    assert.isFalse(await tenant.hasAccessToTier(tier2))
  })

  test('hasAccessToTier returns free only when subscription expired', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    const expiresAt = DateTime.now().minus({ days: 1 })
    await Subscription.createForTenant(tenant.id, tier2.id, expiresAt)

    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')

    assert.isTrue(await tenant.hasAccessToTier(freeTier))
    assert.isFalse(await tenant.hasAccessToTier(tier1))
    assert.isFalse(await tenant.hasAccessToTier(tier2))
  })
})

test.group('TenantMembership Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('can create a tenant membership', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: user.id,
    })

    const member = await TenantMembership.create({
      userId: user.id,
      tenantId: tenant.id,
      role: 'owner',
    })

    assert.exists(member.id)
    assert.equal(member.userId, user.id)
    assert.equal(member.tenantId, tenant.id)
    assert.equal(member.role, 'owner')
  })

  test('isOwner returns true for owner role', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: user.id,
    })

    const owner = await TenantMembership.create({
      userId: user.id,
      tenantId: tenant.id,
      role: 'owner',
    })

    assert.isTrue(owner.isOwner())
    assert.isTrue(owner.isAdmin())
  })

  test('isAdmin returns true for admin role', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const adminUser = await User.create({
      email: `admin-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const admin = await TenantMembership.create({
      userId: adminUser.id,
      tenantId: tenant.id,
      role: 'admin',
    })

    assert.isFalse(admin.isOwner())
    assert.isTrue(admin.isAdmin())
  })

  test('isAdmin returns false for member role', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const memberUser = await User.create({
      email: `member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const member = await TenantMembership.create({
      userId: memberUser.id,
      tenantId: tenant.id,
      role: 'member',
    })

    assert.isFalse(member.isOwner())
    assert.isFalse(member.isAdmin())
  })

  test('user-tenant membership must be unique', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: user.id,
    })

    await TenantMembership.create({
      userId: user.id,
      tenantId: tenant.id,
      role: 'owner',
    })

    await assert.rejects(async () => {
      await TenantMembership.create({
        userId: user.id,
        tenantId: tenant.id,
        role: 'member',
      })
    })
  })
})

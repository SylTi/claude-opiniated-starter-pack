import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Team from '#models/team'
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

  test('createForUser creates a subscription for a user', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().plus({ days: 30 })

    const subscription = await Subscription.createForUser(user.id, tier.id, expiresAt)

    assert.exists(subscription.id)
    assert.equal(subscription.subscriberType, 'user')
    assert.equal(subscription.subscriberId, user.id)
    assert.equal(subscription.tierId, tier.id)
    assert.equal(subscription.status, 'active')
    assert.isNotNull(subscription.startsAt)
    assert.isNotNull(subscription.expiresAt)
  })

  test('createForTeam creates a subscription for a team', async ({ assert }) => {
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

    const tier = await SubscriptionTier.findBySlugOrFail('tier2')
    const subscription = await Subscription.createForTeam(team.id, tier.id)

    assert.exists(subscription.id)
    assert.equal(subscription.subscriberType, 'team')
    assert.equal(subscription.subscriberId, team.id)
    assert.equal(subscription.tierId, tier.id)
    assert.equal(subscription.status, 'active')
    assert.isNull(subscription.expiresAt)
  })

  test('getActiveForUser returns active subscription', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForUser(user.id, tier.id)

    const subscription = await Subscription.getActiveForUser(user.id)

    assert.isNotNull(subscription)
    assert.equal(subscription!.subscriberType, 'user')
    assert.equal(subscription!.subscriberId, user.id)
    assert.equal(subscription!.tier.slug, 'tier1')
  })

  test('getActiveForTeam returns active subscription', async ({ assert }) => {
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

    const tier = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTeam(team.id, tier.id)

    const subscription = await Subscription.getActiveForTeam(team.id)

    assert.isNotNull(subscription)
    assert.equal(subscription!.subscriberType, 'team')
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

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().minus({ days: 1 })

    const subscription = await Subscription.createForUser(user.id, tier.id, expiresAt)

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

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().plus({ days: 30 })

    const subscription = await Subscription.createForUser(user.id, tier.id, expiresAt)

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

    const tier = await SubscriptionTier.findBySlugOrFail('tier2')
    const subscription = await Subscription.createForUser(user.id, tier.id, null)

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

    const tier = await SubscriptionTier.findBySlugOrFail('tier1')
    const subscription = await Subscription.createForUser(user.id, tier.id)

    assert.isTrue(subscription.isActive())
  })

  test('downgradeUserToFree cancels active subscription and creates free one', async ({
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

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForUser(user.id, tier1.id)

    const newSubscription = await Subscription.downgradeUserToFree(user.id)

    assert.equal(newSubscription.tier.slug, 'free')
    assert.equal(newSubscription.status, 'active')

    // Old subscription should be cancelled
    const allSubscriptions = await Subscription.getAllForUser(user.id)
    const cancelledSub = allSubscriptions.find((s) => s.tier.slug === 'tier1')
    assert.equal(cancelledSub?.status, 'cancelled')
  })

  test('downgradeTeamToFree cancels active subscription and creates free one', async ({
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

    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTeam(team.id, tier2.id)

    const newSubscription = await Subscription.downgradeTeamToFree(team.id)

    assert.equal(newSubscription.tier.slug, 'free')
    assert.equal(newSubscription.status, 'active')

    // Old subscription should be cancelled
    const allSubscriptions = await Subscription.getAllForTeam(team.id)
    const cancelledSub = allSubscriptions.find((s) => s.tier.slug === 'tier2')
    assert.equal(cancelledSub?.status, 'cancelled')
  })

  test('getAllForUser returns subscription history', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')

    // Create multiple subscriptions
    await Subscription.createForUser(user.id, freeTier.id)
    await Subscription.createForUser(user.id, tier1.id)

    const subscriptions = await Subscription.getAllForUser(user.id)

    assert.lengthOf(subscriptions, 2)
  })
})

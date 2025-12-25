import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Team from '#models/team'
import TeamMember from '#models/team_member'
import User from '#models/user'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('Team Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('can create a team', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      fullName: 'Team Owner',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    assert.exists(team.id)
    assert.equal(team.name, 'Test Team')
    assert.equal(team.ownerId, owner.id)
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

    await Team.create({
      name: 'Test Team',
      slug: `unique-slug-${id}`,
      ownerId: owner.id,
    })

    await assert.rejects(async () => {
      await Team.create({
        name: 'Another Team',
        slug: `unique-slug-${id}`,
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    const tier = await team.getSubscriptionTier()
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTeam(team.id, tier2.id)

    const tier = await team.getSubscriptionTier()
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      maxMembers: 10,
      ownerId: owner.id,
    })

    const maxMembers = await team.getEffectiveMaxMembers()
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    // Give team tier1 subscription (20 max members)
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTeam(team.id, tier1.id)
    await team.refresh()

    const maxMembers = await team.getEffectiveMaxMembers()
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    // Give team tier2 subscription (unlimited members)
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTeam(team.id, tier2.id)
    await team.refresh()

    const maxMembers = await team.getEffectiveMaxMembers()
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    // Free tier has 5 max members
    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    await Subscription.createForTeam(team.id, freeTier.id)
    await team.refresh()

    assert.isTrue(await team.canAddMember(4))
    assert.isFalse(await team.canAddMember(5))
    assert.isFalse(await team.canAddMember(6))
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    // Tier2 has unlimited members
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTeam(team.id, tier2.id)
    await team.refresh()

    assert.isTrue(await team.canAddMember(100))
    assert.isTrue(await team.canAddMember(1000))
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().minus({ days: 1 })
    await Subscription.createForTeam(team.id, tier1.id, expiresAt)

    assert.isTrue(await team.isSubscriptionExpired())
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().plus({ days: 30 })
    await Subscription.createForTeam(team.id, tier1.id, expiresAt)

    assert.isFalse(await team.isSubscriptionExpired())
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    assert.isFalse(await team.isSubscriptionExpired())
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().plus({ days: 30 })
    await Subscription.createForTeam(team.id, tier1.id, expiresAt)

    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')

    assert.isTrue(await team.hasAccessToTier(freeTier))
    assert.isTrue(await team.hasAccessToTier(tier1))
    assert.isFalse(await team.hasAccessToTier(tier2))
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    const expiresAt = DateTime.now().minus({ days: 1 })
    await Subscription.createForTeam(team.id, tier2.id, expiresAt)

    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')

    assert.isTrue(await team.hasAccessToTier(freeTier))
    assert.isFalse(await team.hasAccessToTier(tier1))
    assert.isFalse(await team.hasAccessToTier(tier2))
  })
})

test.group('TeamMember Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('can create a team member', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: user.id,
    })

    const member = await TeamMember.create({
      userId: user.id,
      teamId: team.id,
      role: 'owner',
    })

    assert.exists(member.id)
    assert.equal(member.userId, user.id)
    assert.equal(member.teamId, team.id)
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: user.id,
    })

    const owner = await TeamMember.create({
      userId: user.id,
      teamId: team.id,
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    const admin = await TeamMember.create({
      userId: adminUser.id,
      teamId: team.id,
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

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: owner.id,
    })

    const member = await TeamMember.create({
      userId: memberUser.id,
      teamId: team.id,
      role: 'member',
    })

    assert.isFalse(member.isOwner())
    assert.isFalse(member.isAdmin())
  })

  test('user-team membership must be unique', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: user.id,
    })

    await TeamMember.create({
      userId: user.id,
      teamId: team.id,
      role: 'owner',
    })

    await assert.rejects(async () => {
      await TeamMember.create({
        userId: user.id,
        teamId: team.id,
        role: 'member',
      })
    })
  })
})

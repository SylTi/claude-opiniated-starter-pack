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

test.group('User Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('can create a user', async ({ assert }) => {
    const user = await User.create({
      email: 'create-test@example.com',
      password: 'password123',
      fullName: 'Test User',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    assert.exists(user.id)
    assert.equal(user.email, 'create-test@example.com')
    assert.equal(user.fullName, 'Test User')
    assert.equal(user.role, 'user')
    assert.isFalse(user.emailVerified)
    assert.isFalse(user.mfaEnabled)
    assert.exists(user.createdAt)
    assert.exists(user.updatedAt)
  })

  test('password is hashed on save', async ({ assert }) => {
    const plainPassword = 'password123'
    const user = await User.create({
      email: 'hash-test@example.com',
      password: plainPassword,
      fullName: 'Test User',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    assert.isNotNull(user.password)
    assert.notEqual(user.password!, plainPassword, 'Password should be hashed')
    assert.isTrue(user.password!.length > plainPassword.length)
  })

  test('email must be unique', async ({ assert }) => {
    await User.create({
      email: 'unique-test@example.com',
      password: 'password123',
      fullName: 'Test User',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    await assert.rejects(async () => {
      await User.create({
        email: 'unique-test@example.com',
        password: 'password456',
        fullName: 'Another User',
        role: 'user',
        emailVerified: false,
        mfaEnabled: false,
      })
    })
  })

  test('can update user', async ({ assert }) => {
    const user = await User.create({
      email: 'update-test@example.com',
      password: 'password123',
      fullName: 'Test User',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    user.fullName = 'Updated Name'
    await user.save()

    const updatedUser = await User.find(user.id)
    assert.equal(updatedUser?.fullName, 'Updated Name')
  })

  test('can delete user', async ({ assert }) => {
    const user = await User.create({
      email: 'delete-test@example.com',
      password: 'password123',
      fullName: 'Test User',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    await user.delete()

    const deletedUser = await User.find(user.id)
    assert.isNull(deletedUser)
  })

  test('fullName is optional', async ({ assert }) => {
    const user = await User.create({
      email: 'optional-name@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    assert.exists(user.id)
    assert.isUndefined(user.fullName)
  })

  test('password can be null for OAuth users', async ({ assert }) => {
    const user = await User.create({
      email: 'oauth@example.com',
      password: null,
      fullName: 'OAuth User',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    assert.exists(user.id)
    assert.isNull(user.password)
  })

  test('user role helpers work correctly', async ({ assert }) => {
    const admin = await User.create({
      email: 'admin@example.com',
      password: 'password123',
      fullName: 'Admin User',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
    })

    const user = await User.create({
      email: 'regular-user@example.com',
      password: 'password123',
      fullName: 'Regular User',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    assert.isTrue(admin.isAdmin())
    assert.isTrue(admin.hasRole('admin'))
    assert.isFalse(user.isAdmin())
    assert.isTrue(user.hasRole('user'))
  })

  test('isTeamMember returns true when user has currentTeamId', async ({ assert }) => {
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

    const user = await User.create({
      email: `team-member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      currentTeamId: team.id,
    })

    assert.isTrue(user.isTeamMember())
  })

  test('isTeamMember returns false when currentTeamId is null', async ({ assert }) => {
    const user = await User.create({
      email: 'no-team@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      currentTeamId: null,
    })

    assert.isFalse(user.isTeamMember())
  })

  test('getMfaBackupCodes returns empty array when no codes set', async ({ assert }) => {
    const user = await User.create({
      email: 'no-mfa@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      mfaBackupCodes: null,
    })

    const codes = user.getMfaBackupCodes()
    assert.isArray(codes)
    assert.lengthOf(codes, 0)
  })

  test('getMfaBackupCodes returns parsed codes when set', async ({ assert }) => {
    const backupCodes = ['code1', 'code2', 'code3']
    const user = await User.create({
      email: 'mfa-codes@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: true,
      mfaBackupCodes: JSON.stringify(backupCodes),
    })

    const codes = user.getMfaBackupCodes()
    assert.deepEqual(codes, backupCodes)
  })

  test('getMfaBackupCodes returns empty array for invalid JSON', async ({ assert }) => {
    const user = await User.create({
      email: 'invalid-json@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: true,
      mfaBackupCodes: 'invalid-json-string',
    })

    const codes = user.getMfaBackupCodes()
    assert.isArray(codes)
    assert.lengthOf(codes, 0)
  })

  test('setMfaBackupCodes stores codes as JSON string', async ({ assert }) => {
    const user = await User.create({
      email: 'set-mfa@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: true,
    })

    const backupCodes = ['backup1', 'backup2', 'backup3']
    user.setMfaBackupCodes(backupCodes)

    assert.equal(user.mfaBackupCodes, JSON.stringify(backupCodes))

    const retrievedCodes = user.getMfaBackupCodes()
    assert.deepEqual(retrievedCodes, backupCodes)
  })

  test('getSubscriptionTier returns free tier when no subscription', async ({ assert }) => {
    const user = await User.create({
      email: 'no-sub@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tier = await user.getSubscriptionTier()
    assert.equal(tier.slug, 'free')
  })

  test('getSubscriptionTier returns correct tier when subscription exists', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `tier1-user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForUser(user.id, tier1.id)

    const tier = await user.getSubscriptionTier()
    assert.equal(tier.slug, 'tier1')
  })

  test('hasAccessToTier returns correct values', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `tier1-access-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForUser(user.id, tier1.id)

    const freeTier = await SubscriptionTier.findBySlugOrFail('free')
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')

    assert.isTrue(await user.hasAccessToTier(freeTier))
    assert.isTrue(await user.hasAccessToTier(tier1))
    assert.isFalse(await user.hasAccessToTier(tier2))
  })

  test('isSubscriptionExpired returns false when no subscription', async ({ assert }) => {
    const user = await User.create({
      email: 'no-sub-expired@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const isExpired = await user.isSubscriptionExpired()
    assert.isFalse(isExpired)
  })

  test('isSubscriptionExpired returns true for expired subscription', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `expired-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().minus({ days: 1 })
    await Subscription.createForUser(user.id, tier1.id, expiresAt)

    const isExpired = await user.isSubscriptionExpired()
    assert.isTrue(isExpired)
  })

  test('isSubscriptionExpired returns false for active subscription', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `active-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().plus({ days: 30 })
    await Subscription.createForUser(user.id, tier1.id, expiresAt)

    const isExpired = await user.isSubscriptionExpired()
    assert.isFalse(isExpired)
  })

  test('getEffectiveSubscriptionTier uses team subscription when in team', async ({ assert }) => {
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

    // Give team tier2 subscription
    const tier2 = await SubscriptionTier.findBySlugOrFail('tier2')
    await Subscription.createForTeam(team.id, tier2.id)

    const user = await User.create({
      email: `member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      currentTeamId: team.id,
    })

    // User has no personal subscription but is in a team with tier2
    const effectiveTier = await user.getEffectiveSubscriptionTier()
    assert.equal(effectiveTier.slug, 'tier2')
  })

  test('getEffectiveSubscriptionTier falls back to personal when team subscription expired', async ({
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

    // Give team expired tier1 subscription
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    const expiresAt = DateTime.now().minus({ days: 1 })
    await Subscription.createForTeam(team.id, tier1.id, expiresAt)

    const user = await User.create({
      email: `member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      currentTeamId: team.id,
    })

    // User has no personal subscription, team's is expired -> should get free
    const effectiveTier = await user.getEffectiveSubscriptionTier()
    assert.equal(effectiveTier.slug, 'free')
  })
})

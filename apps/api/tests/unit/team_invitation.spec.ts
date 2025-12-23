import { test } from '@japa/runner'
import Team from '#models/team'
import TeamInvitation from '#models/team_invitation'
import User from '#models/user'
import { truncateAllTables } from '../bootstrap.js'
import { DateTime } from 'luxon'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('TeamInvitation Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('can create a team invitation', async ({ assert }) => {
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

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `invited-${id}@example.com`,
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    assert.exists(invitation.id)
    assert.equal(invitation.teamId, team.id)
    assert.equal(invitation.invitedById, owner.id)
    assert.equal(invitation.status, 'pending')
    assert.equal(invitation.role, 'member')
  })

  test('generateToken creates a unique token', async ({ assert }) => {
    const token1 = TeamInvitation.generateToken()
    const token2 = TeamInvitation.generateToken()

    assert.isString(token1)
    assert.isString(token2)
    assert.equal(token1.length, 64) // 32 bytes * 2 hex chars
    assert.notEqual(token1, token2)
  })

  test('isExpired returns true for expired invitation', async ({ assert }) => {
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

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `invited-${id}@example.com`,
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    assert.isTrue(invitation.isExpired())
  })

  test('isExpired returns false for active invitation', async ({ assert }) => {
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

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `invited-${id}@example.com`,
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    assert.isFalse(invitation.isExpired())
  })

  test('isValid returns true for pending and non-expired invitation', async ({ assert }) => {
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

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `invited-${id}@example.com`,
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    assert.isTrue(invitation.isValid())
  })

  test('isValid returns false for accepted invitation', async ({ assert }) => {
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

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `invited-${id}@example.com`,
      token: TeamInvitation.generateToken(),
      status: 'accepted',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    assert.isFalse(invitation.isValid())
  })

  test('isValid returns false for expired invitation', async ({ assert }) => {
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

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `invited-${id}@example.com`,
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().minus({ hours: 1 }),
    })

    assert.isFalse(invitation.isValid())
  })

  test('isValid returns false for declined invitation', async ({ assert }) => {
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

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `invited-${id}@example.com`,
      token: TeamInvitation.generateToken(),
      status: 'declined',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    assert.isFalse(invitation.isValid())
  })

  test('token must be unique', async ({ assert }) => {
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

    const token = TeamInvitation.generateToken()

    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `invited1-${id}@example.com`,
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    await assert.rejects(async () => {
      await TeamInvitation.create({
        teamId: team.id,
        invitedById: owner.id,
        email: `invited2-${id}@example.com`,
        token: token, // Same token
        status: 'pending',
        role: 'member',
        expiresAt: DateTime.now().plus({ days: 7 }),
      })
    })
  })

  test('can invite with admin role', async ({ assert }) => {
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

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `admin-${id}@example.com`,
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'admin',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    assert.equal(invitation.role, 'admin')
  })
})

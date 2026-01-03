import { test } from '@japa/runner'
import User from '#models/user'
import Team from '#models/team'
import TeamMember from '#models/team_member'
import TeamInvitation from '#models/team_invitation'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'
import { DateTime } from 'luxon'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

async function loginAndGetCookie(email: string, password: string): Promise<string[]> {
  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`)
  }

  const cookies = response.headers['set-cookie']
  if (!cookies) return []
  return Array.isArray(cookies) ? cookies : [cookies]
}

test.group('Teams API', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/teams requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/teams').expect(401)
  })

  test('POST /api/v1/teams creates a new team', async ({ assert }) => {
    const user = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .post('/api/v1/teams')
      .set('Cookie', cookies)
      .send({ name: 'My Team' })
      .expect(201)

    assert.exists(response.body.data.id)
    assert.equal(response.body.data.name, 'My Team')
    assert.equal(response.body.data.ownerId, user.id)
  })

  test('POST /api/v1/teams requires a team name', async () => {
    await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post('/api/v1/teams')
      .set('Cookie', cookies)
      .send({ name: '' })
      .expect(422)
  })

  test('GET /api/v1/teams/:id returns team details', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/teams/${team.id}`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.id, team.id)
    assert.equal(response.body.data.name, 'Test Team')
    assert.isArray(response.body.data.members)
  })

  test('GET /api/v1/teams/:id returns 403 for non-members', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'other@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    const cookies = await loginAndGetCookie('other@example.com', 'password123')

    await request(BASE_URL).get(`/api/v1/teams/${team.id}`).set('Cookie', cookies).expect(403)
  })
})

test.group('Teams API - Update, Switch, and Members', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/teams returns user teams', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL).get('/api/v1/teams').set('Cookie', cookies).expect(200)

    assert.isArray(response.body.data)
    assert.equal(response.body.data.length, 1)
    assert.equal(response.body.data[0].name, 'Test Team')
  })

  test('PUT /api/v1/teams/:id updates team name', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Old Name',
      slug: 'old-name',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .put(`/api/v1/teams/${team.id}`)
      .set('Cookie', cookies)
      .send({ name: 'New Name' })
      .expect(200)

    assert.equal(response.body.data.name, 'New Name')
  })

  test('PUT /api/v1/teams/:id requires admin role', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member = await User.create({
      email: 'member@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    await TeamMember.create({
      userId: member.id,
      teamId: team.id,
      role: 'member',
    })

    member.currentTeamId = team.id
    await member.save()

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    await request(BASE_URL)
      .put(`/api/v1/teams/${team.id}`)
      .set('Cookie', cookies)
      .send({ name: 'New Name' })
      .expect(403)
  })

  test('POST /api/v1/teams/:id/switch switches current team', async ({ assert }) => {
    const user = await User.create({
      email: 'user@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team1 = await Team.create({
      name: 'Team 1',
      slug: 'team-1',
      ownerId: user.id,
    })

    const team2 = await Team.create({
      name: 'Team 2',
      slug: 'team-2',
      ownerId: user.id,
    })

    await TeamMember.create({ userId: user.id, teamId: team1.id, role: 'owner' })
    await TeamMember.create({ userId: user.id, teamId: team2.id, role: 'owner' })

    user.currentTeamId = team1.id
    await user.save()

    const cookies = await loginAndGetCookie('user@example.com', 'password123')

    const response = await request(BASE_URL)
      .post(`/api/v1/teams/${team2.id}/switch`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.currentTeamId, team2.id)
  })

  test('POST /api/v1/teams/:id/switch requires membership', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'other@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    const cookies = await loginAndGetCookie('other@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/switch`)
      .set('Cookie', cookies)
      .expect(403)
  })

  test('POST /api/v1/teams/:id/members adds member to team', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const newMember = await User.create({
      email: 'newmember@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/members`)
      .set('Cookie', cookies)
      .send({ email: 'newmember@example.com', role: 'member' })
      .expect(201)

    assert.equal(response.body.data.email, 'newmember@example.com')
    assert.equal(response.body.data.role, 'member')

    const membership = await TeamMember.query()
      .where('userId', newMember.id)
      .where('teamId', team.id)
      .first()
    assert.exists(membership)
  })

  test('POST /api/v1/teams/:id/members requires email', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/members`)
      .set('Cookie', cookies)
      .send({})
      .expect(422)
  })

  test('POST /api/v1/teams/:id/members returns 404 for unknown email', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/members`)
      .set('Cookie', cookies)
      .send({ email: 'unknown@example.com' })
      .expect(404)
  })

  test('POST /api/v1/teams/:id/members returns 400 for existing member', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/members`)
      .set('Cookie', cookies)
      .send({ email: 'owner@example.com' })
      .expect(400)
  })

  test('POST /api/v1/teams/:id/members enforces max members limit', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'newmember@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      maxMembers: 1,
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/members`)
      .set('Cookie', cookies)
      .send({ email: 'newmember@example.com' })
      .expect(400)
  })

  test('DELETE /api/v1/teams/:id/members/:userId removes member', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member = await User.create({
      email: 'member@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    await TeamMember.create({ userId: member.id, teamId: team.id, role: 'member' })

    owner.currentTeamId = team.id
    await owner.save()
    member.currentTeamId = team.id
    await member.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/teams/${team.id}/members/${member.id}`)
      .set('Cookie', cookies)
      .expect(200)

    const membership = await TeamMember.query()
      .where('userId', member.id)
      .where('teamId', team.id)
      .first()
    assert.isNull(membership)
  })

  test('DELETE /api/v1/teams/:id/members/:userId requires admin role', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member = await User.create({
      email: 'member@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member2 = await User.create({
      email: 'member2@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    await TeamMember.create({ userId: member.id, teamId: team.id, role: 'member' })
    await TeamMember.create({ userId: member2.id, teamId: team.id, role: 'member' })

    member.currentTeamId = team.id
    await member.save()

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/teams/${team.id}/members/${member2.id}`)
      .set('Cookie', cookies)
      .expect(403)
  })

  test('DELETE /api/v1/teams/:id/members/:userId cannot remove owner', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const admin = await User.create({
      email: 'admin@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    await TeamMember.create({ userId: admin.id, teamId: team.id, role: 'admin' })

    admin.currentTeamId = team.id
    await admin.save()

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/teams/${team.id}/members/${owner.id}`)
      .set('Cookie', cookies)
      .expect(400)
  })

  test('DELETE /api/v1/teams/:id/members/:userId returns 404 for non-member', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/teams/${team.id}/members/999`)
      .set('Cookie', cookies)
      .expect(404)
  })

  test('POST /api/v1/teams/:id/leave allows member to leave', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member = await User.create({
      email: 'member@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    await TeamMember.create({ userId: member.id, teamId: team.id, role: 'member' })

    member.currentTeamId = team.id
    await member.save()

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/leave`)
      .set('Cookie', cookies)
      .expect(200)

    const membership = await TeamMember.query()
      .where('userId', member.id)
      .where('teamId', team.id)
      .first()
    assert.isNull(membership)
  })

  test('POST /api/v1/teams/:id/leave owner cannot leave', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/leave`)
      .set('Cookie', cookies)
      .expect(400)
  })

  test('POST /api/v1/teams/:id/leave returns 404 for non-member', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'other@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    const cookies = await loginAndGetCookie('other@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/leave`)
      .set('Cookie', cookies)
      .expect(404)
  })

  test('DELETE /api/v1/teams/:id deletes team', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL).delete(`/api/v1/teams/${team.id}`).set('Cookie', cookies).expect(200)

    const deletedTeam = await Team.find(team.id)
    assert.isNull(deletedTeam)
  })

  test('DELETE /api/v1/teams/:id only owner can delete', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const admin = await User.create({
      email: 'admin@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    await TeamMember.create({ userId: admin.id, teamId: team.id, role: 'admin' })

    admin.currentTeamId = team.id
    await admin.save()

    const cookies = await loginAndGetCookie('admin@example.com', 'password123')

    await request(BASE_URL).delete(`/api/v1/teams/${team.id}`).set('Cookie', cookies).expect(403)
  })

  test('DELETE /api/v1/teams/:id returns 404 for unknown team', async () => {
    await User.create({
      email: 'user@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('user@example.com', 'password123')

    await request(BASE_URL).delete('/api/v1/teams/999').set('Cookie', cookies).expect(404)
  })

  test('POST /api/v1/teams generates unique slug for duplicate names', async ({ assert }) => {
    const user = await User.create({
      email: 'user@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create first team
    await Team.create({
      name: 'My Team',
      slug: 'my-team',
      ownerId: user.id,
    })

    const cookies = await loginAndGetCookie('user@example.com', 'password123')

    // Create second team with same name
    const response = await request(BASE_URL)
      .post('/api/v1/teams')
      .set('Cookie', cookies)
      .send({ name: 'My Team' })
      .expect(201)

    assert.equal(response.body.data.name, 'My Team')
    assert.notEqual(response.body.data.slug, 'my-team') // Should be different
    assert.match(response.body.data.slug, /^my-team-\d+$/)
  })
})

test.group('Team Invitations API', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/teams/:id/invitations sends an invitation', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    // Give team a paid subscription
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTeam(team.id, tier1.id)

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/invitations`)
      .set('Cookie', cookies)
      .send({ email: 'invited@example.com', role: 'member' })
      .expect(201)

    assert.exists(response.body.data.id)
    assert.equal(response.body.data.email, 'invited@example.com')
    assert.equal(response.body.data.role, 'member')
    assert.equal(response.body.data.status, 'pending')
    assert.exists(response.body.data.invitationLink)
  })

  test('POST /api/v1/teams/:id/invitations requires paid subscription', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/invitations`)
      .set('Cookie', cookies)
      .send({ email: 'invited@example.com' })
      .expect(403)
  })

  test('POST /api/v1/teams/:id/invitations requires admin role', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member = await User.create({
      email: 'member@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    await TeamMember.create({
      userId: member.id,
      teamId: team.id,
      role: 'member', // Not admin
    })

    member.currentTeamId = team.id
    await member.save()

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/invitations`)
      .set('Cookie', cookies)
      .send({ email: 'invited@example.com' })
      .expect(403)
  })

  test('GET /api/v1/teams/:id/invitations lists invitations', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    owner.currentTeamId = team.id
    await owner.save()

    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited1@example.com',
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited2@example.com',
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'admin',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    const response = await request(BASE_URL)
      .get(`/api/v1/teams/${team.id}/invitations`)
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
    assert.equal(response.body.data.length, 2)
  })

  test('GET /api/v1/invitations/:token returns invitation details (public)', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const response = await request(BASE_URL).get(`/api/v1/invitations/${token}`).expect(200)

    assert.equal(response.body.data.email, 'invited@example.com')
    assert.equal(response.body.data.team.name, 'Test Team')
  })

  test('GET /api/v1/invitations/:token returns 404 for invalid token', async () => {
    await request(BASE_URL).get('/api/v1/invitations/invalid-token').expect(404)
  })

  test('POST /api/v1/invitations/:token/accept accepts the invitation', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const invitedUser = await User.create({
      email: 'invited@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('invited@example.com', 'password123')

    const response = await request(BASE_URL)
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.teamId, team.id)
    assert.equal(response.body.data.teamName, 'Test Team')

    // Verify user is now a team member
    const membership = await TeamMember.query()
      .where('userId', invitedUser.id)
      .where('teamId', team.id)
      .first()
    assert.exists(membership)
    assert.equal(membership?.role, 'member')
  })

  test('POST /api/v1/invitations/:token/accept requires matching email', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'other@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com', // Different email
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('other@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Cookie', cookies)
      .expect(403)
  })

  test('POST /api/v1/invitations/:token/decline declines the invitation', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'invited@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    const token = TeamInvitation.generateToken()
    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('invited@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/invitations/${token}/decline`)
      .set('Cookie', cookies)
      .expect(200)

    // Verify invitation is declined
    await invitation.refresh()
    assert.equal(invitation.status, 'declined')
  })

  test('DELETE /api/v1/teams/:id/invitations/:invitationId cancels invitation', async ({
    assert,
  }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    owner.currentTeamId = team.id
    await owner.save()

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/teams/${team.id}/invitations/${invitation.id}`)
      .set('Cookie', cookies)
      .expect(200)

    // Verify invitation is deleted
    const deleted = await TeamInvitation.find(invitation.id)
    assert.isNull(deleted)
  })
})

test.group('Team Invitations API - Edge Cases', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/invitations/:token returns 400 for already accepted invitation', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'accepted',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    await request(BASE_URL).get(`/api/v1/invitations/${token}`).expect(400)
  })

  test('GET /api/v1/invitations/:token returns 400 for expired invitation', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    await request(BASE_URL).get(`/api/v1/invitations/${token}`).expect(400)
  })

  test('POST /api/v1/invitations/:token/accept returns 400 for expired invitation', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'invited@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    const cookies = await loginAndGetCookie('invited@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Cookie', cookies)
      .expect(400)
  })

  test('POST /api/v1/invitations/:token/accept returns 404 for invalid token', async () => {
    await User.create({
      email: 'invited@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('invited@example.com', 'password123')

    await request(BASE_URL)
      .post('/api/v1/invitations/invalid-token/accept')
      .set('Cookie', cookies)
      .expect(404)
  })

  test('POST /api/v1/invitations/:token/accept returns 400 for already accepted invitation', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'invited@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'accepted',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('invited@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Cookie', cookies)
      .expect(400)
  })

  test('POST /api/v1/invitations/:token/accept returns 400 when user is already a member', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member = await User.create({
      email: 'member@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    await TeamMember.create({ userId: member.id, teamId: team.id, role: 'member' })

    member.currentTeamId = team.id
    await member.save()

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'member@example.com',
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Cookie', cookies)
      .expect(400)
  })

  test('POST /api/v1/invitations/:token/accept returns 400 when team is at member limit', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'invited@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      maxMembers: 1,
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('invited@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Cookie', cookies)
      .expect(400)
  })

  test('POST /api/v1/invitations/:token/decline returns 404 for invalid token', async () => {
    await User.create({
      email: 'user@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const cookies = await loginAndGetCookie('user@example.com', 'password123')

    await request(BASE_URL)
      .post('/api/v1/invitations/invalid-token/decline')
      .set('Cookie', cookies)
      .expect(404)
  })

  test('POST /api/v1/invitations/:token/decline returns 403 for wrong email', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'other@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('other@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/invitations/${token}/decline`)
      .set('Cookie', cookies)
      .expect(403)
  })

  test('POST /api/v1/invitations/:token/decline returns 400 for already processed invitation', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await User.create({
      email: 'invited@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: token,
      status: 'declined',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('invited@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/invitations/${token}/decline`)
      .set('Cookie', cookies)
      .expect(400)
  })

  test('DELETE /api/v1/teams/:id/invitations/:invitationId returns 404 for invalid invitation', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/teams/${team.id}/invitations/999`)
      .set('Cookie', cookies)
      .expect(404)
  })

  test('DELETE /api/v1/teams/:id/invitations/:invitationId requires admin role', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member = await User.create({
      email: 'member@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    await TeamMember.create({ userId: member.id, teamId: team.id, role: 'member' })

    member.currentTeamId = team.id
    await member.save()

    const invitation = await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    await request(BASE_URL)
      .delete(`/api/v1/teams/${team.id}/invitations/${invitation.id}`)
      .set('Cookie', cookies)
      .expect(403)
  })

  test('GET /api/v1/teams/:id/invitations requires admin role', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member = await User.create({
      email: 'member@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    await TeamMember.create({ userId: member.id, teamId: team.id, role: 'member' })

    member.currentTeamId = team.id
    await member.save()

    const cookies = await loginAndGetCookie('member@example.com', 'password123')

    await request(BASE_URL)
      .get(`/api/v1/teams/${team.id}/invitations`)
      .set('Cookie', cookies)
      .expect(403)
  })

  test('POST /api/v1/teams/:id/invitations requires email', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/invitations`)
      .set('Cookie', cookies)
      .send({})
      .expect(422)
  })

  test('POST /api/v1/teams/:id/invitations returns 400 for existing pending invitation', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    // Give team a paid subscription
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTeam(team.id, tier1.id)

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com',
      token: TeamInvitation.generateToken(),
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/invitations`)
      .set('Cookie', cookies)
      .send({ email: 'invited@example.com' })
      .expect(400)
  })

  test('POST /api/v1/teams/:id/invitations returns 400 for existing team member', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const member = await User.create({
      email: 'member@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    // Give team a paid subscription
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTeam(team.id, tier1.id)

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    await TeamMember.create({ userId: member.id, teamId: team.id, role: 'member' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/invitations`)
      .set('Cookie', cookies)
      .send({ email: 'member@example.com' })
      .expect(400)
  })

  test('POST /api/v1/teams/:id/invitations returns 400 when team at member limit', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      maxMembers: 1,
      ownerId: owner.id,
    })

    // Give team a paid subscription
    const tier1 = await SubscriptionTier.findBySlugOrFail('tier1')
    await Subscription.createForTeam(team.id, tier1.id)

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    owner.currentTeamId = team.id
    await owner.save()

    const cookies = await loginAndGetCookie('owner@example.com', 'password123')

    await request(BASE_URL)
      .post(`/api/v1/teams/${team.id}/invitations`)
      .set('Cookie', cookies)
      .send({ email: 'new@example.com' })
      .expect(400)
  })
})

test.group('Registration with Invitation', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/auth/register with valid invitation token joins team', async ({ assert }) => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    await TeamMember.create({
      userId: owner.id,
      teamId: team.id,
      role: 'owner',
    })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'newuser@example.com',
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const response = await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
        invitationToken: token,
      })
      .expect(201)

    assert.exists(response.body.data.id)
    assert.equal(response.body.data.email, 'newuser@example.com')
    assert.equal(response.body.data.currentTeamId, team.id)
    assert.exists(response.body.data.joinedTeam)
    assert.equal(response.body.data.joinedTeam.name, 'Test Team')

    // Verify membership was created
    const newUser = await User.findByOrFail('email', 'newuser@example.com')
    const membership = await TeamMember.query()
      .where('userId', newUser.id)
      .where('teamId', team.id)
      .first()
    assert.exists(membership)
  })

  test('POST /api/v1/auth/register with invalid token returns error', async () => {
    await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
        invitationToken: 'invalid-token',
      })
      .expect(400)
  })

  test('POST /api/v1/auth/register with mismatched email returns error', async () => {
    const owner = await User.create({
      email: 'owner@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Team.create({
      name: 'Test Team',
      slug: 'test-team',
      ownerId: owner.id,
    })

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: 'invited@example.com', // Different email
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: 'different@example.com', // Doesn't match invitation
        password: 'password123',
        fullName: 'New User',
        invitationToken: token,
      })
      .expect(400)
  })
})

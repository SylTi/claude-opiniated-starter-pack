import { test } from '@japa/runner'
import User from '#models/user'
import Team from '#models/team'
import TeamMember from '#models/team_member'
import EmailVerificationToken from '#models/email_verification_token'
import PasswordResetToken from '#models/password_reset_token'
import LoginHistory from '#models/login_history'
import AuthService from '#services/auth_service'
import { truncateAllTables } from '../bootstrap.js'
import request from 'supertest'
import { DateTime } from 'luxon'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUserAndLogin(
  email: string,
  password: string,
  options: { emailVerified?: boolean; mfaEnabled?: boolean; fullName?: string } = {}
): Promise<{ user: User; cookies: string[] }> {
  const user = await User.create({
    email,
    password,
    fullName: options.fullName ?? 'Test User',
    role: 'user',
    emailVerified: options.emailVerified ?? true,
    mfaEnabled: options.mfaEnabled ?? false,
  })

  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`)
  }

  const cookies = response.headers['set-cookie']
  return { user, cookies: Array.isArray(cookies) ? cookies : [] }
}

test.group('Auth API - Registration & Login', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/auth/register creates a new user', async ({ assert }) => {
    const id = uniqueId()
    const email = `register-${id}@example.com`

    const response = await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'password123',
        fullName: 'New User',
      })
      .expect(201)

    assert.exists(response.body.message)

    const user = await User.findBy('email', email)
    assert.exists(user)
    assert.equal(user!.email, email)
    assert.equal(user!.fullName, 'New User')
    assert.isFalse(user!.emailVerified)
  })

  test('POST /api/v1/auth/register fails with duplicate email', async () => {
    const id = uniqueId()
    const email = `duplicate-${id}@example.com`

    await User.create({
      email,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'password123',
      })
      .expect(201)

    assert.exists(response.body.message)

    const users = await User.query().where('email', email)
    assert.equal(users.length, 1)
  })

  test('POST /api/v1/auth/login succeeds with valid credentials', async ({ assert }) => {
    const id = uniqueId()

    await User.create({
      email: `login-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `login-${id}@example.com`,
        password: 'password123',
      })
      .expect(200)

    assert.exists(response.body.data.id)
    assert.equal(response.body.data.email, `login-${id}@example.com`)
    assert.exists(response.headers['set-cookie'])
  })

  test('POST /api/v1/auth/login fails with invalid credentials', async () => {
    const id = uniqueId()

    await User.create({
      email: `invalid-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `invalid-${id}@example.com`,
        password: 'wrongpassword',
      })
      .expect(401)
  })

  test('POST /api/v1/auth/login records failed attempt', async ({ assert }) => {
    const id = uniqueId()

    const user = await User.create({
      email: `fail-record-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `fail-record-${id}@example.com`,
        password: 'wrongpassword',
      })
      .expect(401)

    const history = await LoginHistory.query().where('user_id', user.id).first()
    assert.exists(history)
    assert.isFalse(history!.success)
    assert.equal(history!.failureReason, 'Invalid credentials')
  })

  test('POST /api/v1/auth/logout logs out user', async () => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`logout-${id}@example.com`, 'password123')

    await request(BASE_URL).post('/api/v1/auth/logout').set('Cookie', cookies).expect(200)

    // Verify we're logged out by trying to access /me
    await request(BASE_URL).get('/api/v1/auth/me').set('Cookie', cookies).expect(401)
  })
})

test.group('Auth API - Profile', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/auth/me returns current user', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`me-${id}@example.com`, 'password123', {
      fullName: 'Test User',
    })

    const response = await request(BASE_URL)
      .get('/api/v1/auth/me')
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.id, user.id)
    assert.equal(response.body.data.email, `me-${id}@example.com`)
    assert.equal(response.body.data.fullName, 'Test User')
  })

  test('GET /api/v1/auth/me returns current user with team info', async ({ assert }) => {
    const id = uniqueId()
    const { user, cookies } = await createUserAndLogin(`me-team-${id}@example.com`, 'password123', {
      fullName: 'Team User',
    })

    // Create a team and assign user to it
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

    // Update user's currentTeamId
    user.currentTeamId = team.id
    await user.save()

    const response = await request(BASE_URL)
      .get('/api/v1/auth/me')
      .set('Cookie', cookies)
      .expect(200)

    assert.equal(response.body.data.id, user.id)
    assert.equal(response.body.data.currentTeamId, team.id)
    assert.exists(response.body.data.currentTeam)
    assert.equal(response.body.data.currentTeam.id, team.id)
    assert.equal(response.body.data.currentTeam.name, 'Test Team')
  })

  test('GET /api/v1/auth/me requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/auth/me').expect(401)
  })

  test('PUT /api/v1/auth/profile updates user profile', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`profile-${id}@example.com`, 'password123')

    const response = await request(BASE_URL)
      .put('/api/v1/auth/profile')
      .set('Cookie', cookies)
      .send({
        fullName: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.png',
      })
      .expect(200)

    assert.equal(response.body.data.fullName, 'Updated Name')
    assert.equal(response.body.data.avatarUrl, 'https://example.com/avatar.png')
  })

  test('PUT /api/v1/auth/profile allows partial updates', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`partial-${id}@example.com`, 'password123', {
      fullName: 'Original Name',
    })

    const response = await request(BASE_URL)
      .put('/api/v1/auth/profile')
      .set('Cookie', cookies)
      .send({
        avatarUrl: 'https://example.com/new-avatar.png',
      })
      .expect(200)

    // fullName should remain unchanged
    assert.equal(response.body.data.fullName, 'Original Name')
    assert.equal(response.body.data.avatarUrl, 'https://example.com/new-avatar.png')
  })

  test('PUT /api/v1/auth/profile requires authentication', async () => {
    await request(BASE_URL).put('/api/v1/auth/profile').send({ fullName: 'Test' }).expect(401)
  })
})

test.group('Auth API - Password', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('PUT /api/v1/auth/password changes password', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`change-pwd-${id}@example.com`, 'oldpassword')

    await request(BASE_URL)
      .put('/api/v1/auth/password')
      .set('Cookie', cookies)
      .send({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
        newPasswordConfirmation: 'newpassword123',
      })
      .expect(200)

    // Verify new password works
    const loginResponse = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `change-pwd-${id}@example.com`,
        password: 'newpassword123',
      })

    assert.equal(loginResponse.status, 200)
  })

  test('PUT /api/v1/auth/password fails with wrong current password', async () => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`wrong-pwd-${id}@example.com`, 'correctpassword')

    await request(BASE_URL)
      .put('/api/v1/auth/password')
      .set('Cookie', cookies)
      .send({
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
        newPasswordConfirmation: 'newpassword123',
      })
      .expect(400)
  })

  test('PUT /api/v1/auth/password requires authentication', async () => {
    await request(BASE_URL)
      .put('/api/v1/auth/password')
      .send({
        currentPassword: 'old',
        newPassword: 'new',
      })
      .expect(401)
  })

  test('POST /api/v1/auth/forgot-password creates reset token', async ({ assert }) => {
    const id = uniqueId()

    const user = await User.create({
      email: `forgot-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await request(BASE_URL)
      .post('/api/v1/auth/forgot-password')
      .send({ email: `forgot-${id}@example.com` })
      .expect(200)

    const token = await PasswordResetToken.query().where('user_id', user.id).first()
    assert.exists(token)
  })

  test('POST /api/v1/auth/forgot-password succeeds for non-existent email', async () => {
    // Should not reveal if email exists
    await request(BASE_URL)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' })
      .expect(200)
  })

  test('POST /api/v1/auth/reset-password resets password', async ({ assert }) => {
    const id = uniqueId()
    const authService = new AuthService()

    const user = await User.create({
      email: `reset-${id}@example.com`,
      password: 'oldpassword',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const token = await authService.createPasswordResetToken(user)

    await request(BASE_URL)
      .post('/api/v1/auth/reset-password')
      .send({
        token,
        password: 'newpassword123',
        passwordConfirmation: 'newpassword123',
      })
      .expect(200)

    // Verify new password works
    const loginResponse = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `reset-${id}@example.com`,
        password: 'newpassword123',
      })

    assert.equal(loginResponse.status, 200)
  })

  test('POST /api/v1/auth/reset-password fails with invalid token', async () => {
    await request(BASE_URL)
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'invalid-token',
        password: 'newpassword123',
        passwordConfirmation: 'newpassword123',
      })
      .expect(400)
  })
})

test.group('Auth API - Email Verification', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/auth/verify-email/:token verifies email', async ({ assert }) => {
    const id = uniqueId()
    const authService = new AuthService()

    const user = await User.create({
      email: `verify-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    const token = await authService.createEmailVerificationToken(user)

    await request(BASE_URL).get(`/api/v1/auth/verify-email/${token}`).expect(200)

    await user.refresh()
    assert.isTrue(user.emailVerified)
  })

  test('GET /api/v1/auth/verify-email/:token fails with invalid token', async () => {
    await request(BASE_URL).get('/api/v1/auth/verify-email/invalid-token').expect(400)
  })

  test('GET /api/v1/auth/verify-email/:token fails with expired token', async ({ assert }) => {
    const id = uniqueId()

    const user = await User.create({
      email: `expired-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    // Create expired token manually
    const token = 'expired-token-123'
    await EmailVerificationToken.create({
      userId: user.id,
      token,
      expiresAt: DateTime.now().minus({ hours: 1 }),
    })

    await request(BASE_URL).get(`/api/v1/auth/verify-email/${token}`).expect(400)

    await user.refresh()
    assert.isFalse(user.emailVerified)
  })

  test('POST /api/v1/auth/resend-verification sends new token', async ({ assert }) => {
    const id = uniqueId()

    const user = await User.create({
      email: `resend-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    const loginResponse = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `resend-${id}@example.com`,
        password: 'password123',
      })

    const setCookie = loginResponse.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie : []

    await request(BASE_URL)
      .post('/api/v1/auth/resend-verification')
      .set('Cookie', cookies)
      .expect(200)

    const token = await EmailVerificationToken.query().where('user_id', user.id).first()
    assert.exists(token)
  })

  test('POST /api/v1/auth/resend-verification fails if already verified', async () => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`verified-${id}@example.com`, 'password123', {
      emailVerified: true,
    })

    await request(BASE_URL)
      .post('/api/v1/auth/resend-verification')
      .set('Cookie', cookies)
      .expect(400)
  })
})

test.group('Auth API - Registration Edge Cases', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/auth/register fails with expired invitation token', async () => {
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

    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })
    const { default: TeamInvitation } = await import('#models/team_invitation')

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `newuser-${id}@example.com`,
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().minus({ days: 1 }), // Expired
    })

    await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: `newuser-${id}@example.com`,
        password: 'password123',
        fullName: 'New User',
        invitationToken: token,
      })
      .expect(400)
  })

  test('POST /api/v1/auth/register fails when team is at member limit', async () => {
    const id = uniqueId()

    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create 5 more users to fill the team (free tier max is 5)
    const teamMembers = []
    for (let i = 0; i < 4; i++) {
      teamMembers.push(
        await User.create({
          email: `member${i}-${id}@example.com`,
          password: 'password123',
          role: 'user',
          emailVerified: true,
          mfaEnabled: false,
        })
      )
    }

    const team = await Team.create({
      name: 'Full Team',
      slug: `full-team-${id}`,
      ownerId: owner.id,
      maxMembers: 5,
    })

    // Add owner
    await TeamMember.create({ userId: owner.id, teamId: team.id, role: 'owner' })

    // Add 4 members (total 5)
    for (const member of teamMembers) {
      await TeamMember.create({ userId: member.id, teamId: team.id, role: 'member' })
    }

    const { default: TeamInvitation } = await import('#models/team_invitation')

    const token = TeamInvitation.generateToken()
    await TeamInvitation.create({
      teamId: team.id,
      invitedById: owner.id,
      email: `newuser-${id}@example.com`,
      token: token,
      status: 'pending',
      role: 'member',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: `newuser-${id}@example.com`,
        password: 'password123',
        fullName: 'New User',
        invitationToken: token,
      })
      .expect(400)
  })
})

test.group('Auth API - MFA Login', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('POST /api/v1/auth/login with MFA enabled returns requiresMfa without code', async ({
    assert,
  }) => {
    const id = uniqueId()

    await User.create({
      email: `mfa-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'TESTSECRET',
    })

    const response = await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `mfa-${id}@example.com`,
        password: 'password123',
      })
      .expect(200)

    assert.isTrue(response.body.data.requiresMfa)
    assert.equal(response.body.message, 'MFA code required')
  })

  test('POST /api/v1/auth/login with MFA enabled fails with invalid code', async () => {
    const id = uniqueId()

    await User.create({
      email: `mfa-invalid-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'TESTSECRET',
    })

    await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `mfa-invalid-${id}@example.com`,
        password: 'password123',
        mfaCode: '000000',
      })
      .expect(401)
  })
})

test.group('Auth API - Login History', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('GET /api/v1/auth/login-history returns user login history', async ({ assert }) => {
    const id = uniqueId()
    const { cookies } = await createUserAndLogin(`history-${id}@example.com`, 'password123')

    // Login was already recorded from createUserAndLogin
    // Add another failed attempt
    await request(BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: `history-${id}@example.com`,
        password: 'wrongpassword',
      })

    const response = await request(BASE_URL)
      .get('/api/v1/auth/login-history')
      .set('Cookie', cookies)
      .expect(200)

    assert.isArray(response.body.data)
    assert.isAtLeast(response.body.data.length, 1)

    const entry = response.body.data[0]
    assert.exists(entry.id)
    assert.exists(entry.loginMethod)
    assert.exists(entry.createdAt)
  })

  test('GET /api/v1/auth/login-history requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/auth/login-history').expect(401)
  })
})

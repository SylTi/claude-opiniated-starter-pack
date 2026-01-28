import { test } from '@japa/runner'
import User from '#models/user'
import LoginHistory from '#models/login_history'
import PasswordResetToken from '#models/password_reset_token'
import EmailVerificationToken from '#models/email_verification_token'
import AuthService from '#services/auth_service'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('AuthService', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('register creates a new user with verification token', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const result = await authService.register({
      email: `test-${id}@example.com`,
      password: 'password123',
      fullName: 'Test User',
    })

    assert.exists(result.user)
    assert.exists(result.verificationToken)
    assert.equal(result.user.email, `test-${id}@example.com`)
    assert.equal(result.user.fullName, 'Test User')
    assert.isFalse(result.user.emailVerified)
    assert.equal(result.user.role, 'user')

    // Verify token was created in database (tokens are stored hashed, use findByPlainToken)
    const token = await EmailVerificationToken.findByPlainToken(result.verificationToken)
    assert.exists(token)
    assert.equal(token!.userId, result.user.id)
  })

  test('login returns user and requiresMfa flag', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    await User.create({
      email: `login-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const result = await authService.login(`login-${id}@example.com`, 'password123')

    assert.exists(result.user)
    assert.isFalse(result.requiresMfa)
    assert.equal(result.user.email, `login-${id}@example.com`)
  })

  test('login returns requiresMfa true when MFA is enabled', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    await User.create({
      email: `mfa-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'testsecret',
    })

    const result = await authService.login(`mfa-${id}@example.com`, 'password123')

    assert.exists(result.user)
    assert.isTrue(result.requiresMfa)
  })

  test('recordLoginAttempt creates login history entry', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `history-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await authService.recordLoginAttempt(user.id, 'password', true, '127.0.0.1', 'Mozilla/5.0')

    const history = await LoginHistory.query().where('user_id', user.id).first()
    assert.exists(history)
    assert.equal(history!.loginMethod, 'password')
    assert.isTrue(history!.success)
    assert.equal(history!.ipAddress, '127.0.0.1')
  })

  test('recordLoginAttempt records failed attempt with reason', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `failed-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await authService.recordLoginAttempt(
      user.id,
      'password',
      false,
      '127.0.0.1',
      'Mozilla/5.0',
      'Invalid credentials'
    )

    const history = await LoginHistory.query().where('user_id', user.id).first()
    assert.exists(history)
    assert.isFalse(history!.success)
    assert.equal(history!.failureReason, 'Invalid credentials')
  })

  test('createPasswordResetToken creates a token and deletes old ones', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `reset-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create first token
    const token1 = await authService.createPasswordResetToken(user)
    assert.exists(token1)
    assert.isString(token1)
    assert.equal(token1.length, 64) // 32 bytes hex = 64 chars

    // Create second token - should delete the first
    const token2 = await authService.createPasswordResetToken(user)
    assert.notEqual(token1, token2)

    // Verify old token is deleted (tokens are stored hashed, use findByPlainToken)
    const oldToken = await PasswordResetToken.findByPlainToken(token1)
    assert.isNull(oldToken)

    // Verify new token exists
    const newToken = await PasswordResetToken.findByPlainToken(token2)
    assert.exists(newToken)
  })

  test('verifyPasswordResetToken returns user for valid token', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `verify-reset-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const token = await authService.createPasswordResetToken(user)
    const result = await authService.verifyPasswordResetToken(token)

    assert.exists(result)
    assert.equal(result!.id, user.id)
  })

  test('verifyPasswordResetToken returns null for invalid token', async ({ assert }) => {
    const authService = new AuthService()

    const result = await authService.verifyPasswordResetToken('invalid-token')
    assert.isNull(result)
  })

  test('resetPassword changes password and deletes token', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `reset-pwd-${id}@example.com`,
      password: 'oldpassword',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const token = await authService.createPasswordResetToken(user)
    const success = await authService.resetPassword(token, 'newpassword123')

    assert.isTrue(success)

    // Verify token is deleted
    const deletedToken = await PasswordResetToken.findBy('token', token)
    assert.isNull(deletedToken)

    // Verify new password works
    const loginResult = await authService.login(user.email, 'newpassword123')
    assert.exists(loginResult.user)
  })

  test('resetPassword returns false for invalid token', async ({ assert }) => {
    const authService = new AuthService()

    const success = await authService.resetPassword('invalid-token', 'newpassword')
    assert.isFalse(success)
  })

  test('createEmailVerificationToken creates a token', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `verify-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    const token = await authService.createEmailVerificationToken(user)

    assert.exists(token)
    assert.isString(token)
    assert.equal(token.length, 64)

    // Token is stored hashed, so use findByPlainToken to lookup
    const dbToken = await EmailVerificationToken.findByPlainToken(token)
    assert.exists(dbToken)
    assert.equal(dbToken!.userId, user.id)
  })

  test('verifyEmail marks user as verified and deletes token', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `verify-email-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: false,
      mfaEnabled: false,
    })

    const token = await authService.createEmailVerificationToken(user)
    const success = await authService.verifyEmail(token)

    assert.isTrue(success)

    // Verify user is now verified
    await user.refresh()
    assert.isTrue(user.emailVerified)
    assert.exists(user.emailVerifiedAt)

    // Verify token is deleted
    const deletedToken = await EmailVerificationToken.findBy('token', token)
    assert.isNull(deletedToken)
  })

  test('verifyEmail returns false for invalid token', async ({ assert }) => {
    const authService = new AuthService()

    const success = await authService.verifyEmail('invalid-token')
    assert.isFalse(success)
  })

  test('changePassword validates current password and updates', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `change-pwd-${id}@example.com`,
      password: 'oldpassword',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const success = await authService.changePassword(user, 'oldpassword', 'newpassword123')
    assert.isTrue(success)

    // Verify new password works
    const loginResult = await authService.login(user.email, 'newpassword123')
    assert.exists(loginResult.user)
  })

  test('changePassword returns false for wrong current password', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `wrong-pwd-${id}@example.com`,
      password: 'correctpassword',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const success = await authService.changePassword(user, 'wrongpassword', 'newpassword123')
    assert.isFalse(success)
  })

  test('findByEmail returns user when found', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    await User.create({
      email: `find-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const user = await authService.findByEmail(`find-${id}@example.com`)
    assert.exists(user)
    assert.equal(user!.email, `find-${id}@example.com`)
  })

  test('findByEmail returns null when not found', async ({ assert }) => {
    const authService = new AuthService()

    const user = await authService.findByEmail('nonexistent@example.com')
    assert.isNull(user)
  })

  test('getLoginHistory returns recent login entries', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `history-get-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create multiple login history entries
    await authService.recordLoginAttempt(user.id, 'password', true, '127.0.0.1', 'Chrome')
    await authService.recordLoginAttempt(
      user.id,
      'password',
      false,
      '127.0.0.2',
      'Firefox',
      'Bad password'
    )
    await authService.recordLoginAttempt(user.id, 'mfa', true, '127.0.0.1', 'Chrome')

    const history = await authService.getLoginHistory(user.id)

    assert.lengthOf(history, 3)
    // Should be ordered by created_at desc
    assert.equal(history[0].loginMethod, 'mfa')
    assert.equal(history[1].loginMethod, 'password')
  })

  test('getLoginHistory respects limit parameter', async ({ assert }) => {
    const authService = new AuthService()
    const id = uniqueId()

    const user = await User.create({
      email: `history-limit-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create 5 login history entries
    for (let i = 0; i < 5; i++) {
      await authService.recordLoginAttempt(user.id, 'password', true, '127.0.0.1', 'Chrome')
    }

    const history = await authService.getLoginHistory(user.id, 3)
    assert.lengthOf(history, 3)
  })
})

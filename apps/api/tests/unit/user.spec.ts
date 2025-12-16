import { test } from '@japa/runner'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('User Model', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
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
})

import { test } from '@japa/runner'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('User Model', (group) => {
  group.each.setup(async () => {
    await testUtils.db().truncate()
  })

  test('can create a user', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    assert.exists(user.id)
    assert.equal(user.email, 'test@example.com')
    assert.equal(user.fullName, 'Test User')
    assert.exists(user.createdAt)
    assert.exists(user.updatedAt)
  })

  test('password is hashed on save', async ({ assert }) => {
    const plainPassword = 'password123'
    const user = await User.create({
      email: 'test@example.com',
      password: plainPassword,
      fullName: 'Test User',
    })

    assert.notEqual(user.password, plainPassword, 'Password should be hashed')
    assert.isTrue(user.password.length > plainPassword.length)
  })

  test('email must be unique', async ({ assert }) => {
    await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    await assert.rejects(async () => {
      await User.create({
        email: 'test@example.com',
        password: 'password456',
        fullName: 'Another User',
      })
    }, 'Should reject duplicate email')
  })

  test('can update user', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    user.fullName = 'Updated Name'
    await user.save()

    const updatedUser = await User.find(user.id)
    assert.equal(updatedUser?.fullName, 'Updated Name')
  })

  test('can delete user', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    await user.delete()

    const deletedUser = await User.find(user.id)
    assert.isNull(deletedUser)
  })

  test('fullName is optional', async ({ assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
    })

    assert.exists(user.id)
    assert.isNull(user.fullName)
  })
})

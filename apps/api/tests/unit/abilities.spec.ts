import { test } from '@japa/runner'
import { Bouncer } from '@adonisjs/bouncer'
import User from '#models/user'
import * as abilities from '#abilities/main'
import { truncateAllTables } from '../bootstrap.js'

/**
 * Helper to create a bouncer instance for testing
 */
function createBouncer(user: User | null) {
  return new Bouncer(() => user, abilities, {})
}

// isAdmin ability tests
test.group('Abilities - isAdmin', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('allows admin user', async ({ assert }) => {
    const admin = await User.create({
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(admin)
    const result = await bouncer.allows('isAdmin')
    assert.isTrue(result)
  })

  test('denies regular user', async ({ assert }) => {
    const user = await User.create({
      email: 'user@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(user)
    const result = await bouncer.allows('isAdmin')
    assert.isFalse(result)
  })

  test('denies guest user', async ({ assert }) => {
    const guest = await User.create({
      email: 'guest@example.com',
      password: 'password123',
      role: 'guest',
      emailVerified: false,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(guest)
    const result = await bouncer.allows('isAdmin')
    assert.isFalse(result)
  })

  test('denies null user', async ({ assert }) => {
    const bouncer = createBouncer(null)
    const result = await bouncer.allows('isAdmin')
    assert.isFalse(result)
  })
})

// accessAdminPanel ability tests
test.group('Abilities - accessAdminPanel', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('allows admin user', async ({ assert }) => {
    const admin = await User.create({
      email: 'admin-panel@example.com',
      password: 'password123',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(admin)
    const result = await bouncer.allows('accessAdminPanel')
    assert.isTrue(result)
  })

  test('denies regular user', async ({ assert }) => {
    const user = await User.create({
      email: 'user-panel@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(user)
    const result = await bouncer.allows('accessAdminPanel')
    assert.isFalse(result)
  })
})

// manageUsers ability tests
test.group('Abilities - manageUsers', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('allows admin user', async ({ assert }) => {
    const admin = await User.create({
      email: 'admin-manage@example.com',
      password: 'password123',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(admin)
    const result = await bouncer.allows('manageUsers')
    assert.isTrue(result)
  })

  test('denies regular user', async ({ assert }) => {
    const user = await User.create({
      email: 'user-manage@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(user)
    const result = await bouncer.allows('manageUsers')
    assert.isFalse(result)
  })

  test('denies null user', async ({ assert }) => {
    const bouncer = createBouncer(null)
    const result = await bouncer.allows('manageUsers')
    assert.isFalse(result)
  })
})

// editOwnProfile ability tests
test.group('Abilities - editOwnProfile', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('allows user to edit their own profile', async ({ assert }) => {
    const user = await User.create({
      email: 'edit-own@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(user)
    const result = await bouncer.allows('editOwnProfile', user)
    assert.isTrue(result)
  })

  test('denies user editing another user profile', async ({ assert }) => {
    const user = await User.create({
      email: 'user1-edit@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const otherUser = await User.create({
      email: 'user2-edit@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(user)
    const result = await bouncer.allows('editOwnProfile', otherUser)
    assert.isFalse(result)
  })

  test('denies admin editing another user profile via editOwnProfile', async ({ assert }) => {
    const admin = await User.create({
      email: 'admin-edit@example.com',
      password: 'password123',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
    })

    const otherUser = await User.create({
      email: 'target-edit@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(admin)
    // editOwnProfile checks user.id === targetUser.id, not admin role
    const result = await bouncer.allows('editOwnProfile', otherUser)
    assert.isFalse(result)
  })

  test('allows admin to edit their own profile', async ({ assert }) => {
    const admin = await User.create({
      email: 'admin-own-edit@example.com',
      password: 'password123',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(admin)
    const result = await bouncer.allows('editOwnProfile', admin)
    assert.isTrue(result)
  })
})

// viewUserProfile ability tests
test.group('Abilities - viewUserProfile', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('allows user to view own profile', async ({ assert }) => {
    const user = await User.create({
      email: 'view-own@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(user)
    const result = await bouncer.allows('viewUserProfile', user)
    assert.isTrue(result)
  })

  test('allows admin to view any user profile', async ({ assert }) => {
    const admin = await User.create({
      email: 'admin-view@example.com',
      password: 'password123',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
    })

    const otherUser = await User.create({
      email: 'other-view@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(admin)
    const result = await bouncer.allows('viewUserProfile', otherUser)
    assert.isTrue(result)
  })

  test('denies regular user viewing another user profile', async ({ assert }) => {
    const user = await User.create({
      email: 'viewer@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const otherUser = await User.create({
      email: 'target@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(user)
    const result = await bouncer.allows('viewUserProfile', otherUser)
    assert.isFalse(result)
  })

  test('denies null user viewing any profile', async ({ assert }) => {
    const targetUser = await User.create({
      email: 'target-null@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(null)
    const result = await bouncer.allows('viewUserProfile', targetUser)
    assert.isFalse(result)
  })

  test('allows admin to view own profile', async ({ assert }) => {
    const admin = await User.create({
      email: 'admin-own-view@example.com',
      password: 'password123',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
    })

    const bouncer = createBouncer(admin)
    const result = await bouncer.allows('viewUserProfile', admin)
    assert.isTrue(result)
  })
})

// User model methods tests
test.group('Abilities - User model methods', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('isAdmin returns true for admin role', async ({ assert }) => {
    const admin = await User.create({
      email: 'model-admin@example.com',
      password: 'password123',
      role: 'admin',
      emailVerified: true,
      mfaEnabled: false,
    })

    assert.isTrue(admin.isAdmin())
  })

  test('isAdmin returns false for user role', async ({ assert }) => {
    const user = await User.create({
      email: 'model-user@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    assert.isFalse(user.isAdmin())
  })

  test('hasRole returns true for matching role', async ({ assert }) => {
    const user = await User.create({
      email: 'hasrole@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    assert.isTrue(user.hasRole('user'))
    assert.isFalse(user.hasRole('admin'))
  })
})

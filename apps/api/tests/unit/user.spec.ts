import { test } from '@japa/runner'
import User from '#models/user'
import Tenant from '#models/tenant'
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

  test('hasTenant returns true when user has currentTenantId', async ({ assert }) => {
    const id = uniqueId()
    const owner = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'team',
      ownerId: owner.id,
    })

    const user = await User.create({
      email: `tenant-member-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      currentTenantId: tenant.id,
    })

    assert.isTrue(user.hasTenant())
  })

  test('hasTenant returns false when currentTenantId is null', async ({ assert }) => {
    const user = await User.create({
      email: 'no-tenant@example.com',
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      currentTenantId: null,
    })

    assert.isFalse(user.hasTenant())
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
})

test.group('User Balance Methods (Deprecated - Tenant is billing unit)', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('addCredit increases user balance', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      balance: 1000,
      balanceCurrency: 'usd',
    })

    const newBalance = await user.addCredit(5000, 'usd')

    assert.equal(newBalance, 6000)
    await user.refresh()
    assert.equal(user.balance, 6000)
  })

  test('addCredit sets currency for new balance', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await user.addCredit(5000, 'eur')

    await user.refresh()
    assert.equal(user.balance, 5000)
    assert.equal(user.balanceCurrency, 'eur')
  })

  test('getBalance returns current balance and currency', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
      balance: 7500,
      balanceCurrency: 'usd',
    })

    const balance = user.getBalance()

    assert.equal(balance.balance, 7500)
    assert.equal(balance.currency, 'usd')
  })
})

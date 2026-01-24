import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Coupon from '#models/coupon'
import User from '#models/user'
import Tenant from '#models/tenant'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('Coupon Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('findByCode finds coupon case-insensitively', async ({ assert }) => {
    const id = uniqueId()
    await Coupon.create({
      code: `GIFT${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
    })

    const found = await Coupon.findByCode(`gift${id}`)
    assert.isNotNull(found)
    assert.equal(found!.code, `GIFT${id}`.toUpperCase())
  })

  test('findByCode returns null for non-existent code', async ({ assert }) => {
    const found = await Coupon.findByCode('NONEXISTENT')
    assert.isNull(found)
  })

  test('isExpired returns true for expired coupon', async ({ assert }) => {
    const id = uniqueId()
    const coupon = await Coupon.create({
      code: `EXPIRED${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    assert.isTrue(coupon.isExpired())
  })

  test('isExpired returns false for non-expired coupon', async ({ assert }) => {
    const id = uniqueId()
    const coupon = await Coupon.create({
      code: `VALID${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
      expiresAt: DateTime.now().plus({ days: 30 }),
    })

    assert.isFalse(coupon.isExpired())
  })

  test('isExpired returns false for coupon without expiration', async ({ assert }) => {
    const id = uniqueId()
    const coupon = await Coupon.create({
      code: `NOEXPIRE${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
    })

    assert.isFalse(coupon.isExpired())
  })

  test('isRedeemable returns true for active non-expired unredeemed coupon', async ({ assert }) => {
    const id = uniqueId()
    const coupon = await Coupon.create({
      code: `REDEEMABLE${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
    })

    // Refresh to get accurate values from DB
    await coupon.refresh()
    assert.isTrue(coupon.isRedeemable())
  })

  test('isRedeemable returns false for inactive coupon', async ({ assert }) => {
    const id = uniqueId()
    const coupon = await Coupon.create({
      code: `INACTIVE${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: false,
    })

    assert.isFalse(coupon.isRedeemable())
  })

  test('isRedeemable returns false for expired coupon', async ({ assert }) => {
    const id = uniqueId()
    const coupon = await Coupon.create({
      code: `EXPIRED${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    assert.isFalse(coupon.isRedeemable())
  })

  test('isRedeemable returns false for already redeemed coupon', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const coupon = await Coupon.create({
      code: `REDEEMED${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: false,
      redeemedByUserId: user.id,
      redeemedAt: DateTime.now(),
    })

    assert.isFalse(coupon.isRedeemable())
  })

  test('redeemForTenant marks coupon as redeemed and updates tenant balance', async ({
    assert,
  }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    // Create a personal tenant for the user (tenant is the billing unit)
    const tenant = await Tenant.create({
      name: `${user.fullName || 'User'}'s Workspace`,
      slug: `personal-${id}`,
      type: 'personal',
      ownerId: user.id,
      balance: 1000,
      balanceCurrency: 'usd',
    })

    const coupon = await Coupon.create({
      code: `REDEEM${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: true,
    })

    // Refresh to get accurate values from DB
    await coupon.refresh()
    const newBalance = await coupon.redeemForTenant(tenant.id, user.id)

    assert.equal(newBalance, 6000) // 1000 + 5000

    // Verify coupon state
    await coupon.refresh()
    assert.equal(coupon.redeemedByUserId, user.id)
    assert.isNotNull(coupon.redeemedAt)
    assert.isFalse(coupon.isActive)

    // Verify tenant balance
    await tenant.refresh()
    assert.equal(tenant.balance, 6000)
  })

  test('redeemForTenant marks coupon as redeemed and updates team balance', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Tenant.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: user.id,
      balance: 2000,
      balanceCurrency: 'usd',
    })

    const coupon = await Coupon.create({
      code: `TEAMREDEEM${id}`,
      creditAmount: 10000,
      currency: 'usd',
      isActive: true,
    })

    // Refresh to get accurate values from DB
    await coupon.refresh()
    const newBalance = await coupon.redeemForTenant(team.id, user.id)

    assert.equal(newBalance, 12000) // 2000 + 10000

    // Verify coupon state
    await coupon.refresh()
    assert.equal(coupon.redeemedByUserId, user.id)
    assert.isNotNull(coupon.redeemedAt)
    assert.isFalse(coupon.isActive)

    // Verify team balance
    await team.refresh()
    assert.equal(team.balance, 12000)
  })

  test('redeemForTenant throws error for already redeemed coupon', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const tenant = await Tenant.create({
      name: 'Test Tenant',
      slug: `test-tenant-${id}`,
      type: 'personal',
      ownerId: user.id,
    })

    const otherUser = await User.create({
      email: `other-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const coupon = await Coupon.create({
      code: `ALREADYREDEEMED${id}`,
      creditAmount: 5000,
      currency: 'usd',
      isActive: false,
      redeemedByUserId: otherUser.id,
      redeemedAt: DateTime.now(),
    })

    try {
      await coupon.redeemForTenant(tenant.id, user.id)
      assert.fail('Expected error to be thrown')
    } catch (error) {
      assert.instanceOf(error, Error)
    }
  })
})

test.group('User Balance Methods', (group) => {
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

test.group('Team Balance Methods', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('addCredit increases team balance', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Tenant.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: user.id,
      balance: 2000,
      balanceCurrency: 'usd',
    })

    const newBalance = await team.addCredit(8000, 'usd')

    assert.equal(newBalance, 10000)
    await team.refresh()
    assert.equal(team.balance, 10000)
  })

  test('getBalance returns current balance and currency', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `owner-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const team = await Tenant.create({
      name: 'Test Team',
      slug: `test-team-${id}`,
      ownerId: user.id,
      balance: 15000,
      balanceCurrency: 'eur',
    })

    const balance = team.getBalance()

    assert.equal(balance.balance, 15000)
    assert.equal(balance.currency, 'eur')
  })
})

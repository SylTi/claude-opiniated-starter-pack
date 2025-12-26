import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import DiscountCode from '#models/discount_code'
import User from '#models/user'
import DiscountCodeUsage from '#models/discount_code_usage'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

test.group('DiscountCode Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('findByCode finds discount code case-insensitively', async ({ assert }) => {
    const id = uniqueId()
    await DiscountCode.create({
      code: `SUMMER${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
    })

    const found = await DiscountCode.findByCode(`summer${id}`)
    assert.isNotNull(found)
    assert.equal(found!.code, `SUMMER${id}`.toUpperCase())
  })

  test('findByCode returns null for non-existent code', async ({ assert }) => {
    const found = await DiscountCode.findByCode('NONEXISTENT')
    assert.isNull(found)
  })

  test('isExpired returns true for expired code', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `EXPIRED${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    assert.isTrue(code.isExpired())
  })

  test('isExpired returns false for non-expired code', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `VALID${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
      expiresAt: DateTime.now().plus({ days: 30 }),
    })

    assert.isFalse(code.isExpired())
  })

  test('isExpired returns false for code without expiration', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `NOEXPIRE${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
    })

    assert.isFalse(code.isExpired())
  })

  test('isUsable returns true for active non-expired code within limits', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `USABLE${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
      maxUses: 10,
      timesUsed: 5,
    })

    assert.isTrue(code.isUsable())
  })

  test('isUsable returns false for inactive code', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `INACTIVE${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: false,
    })

    assert.isFalse(code.isUsable())
  })

  test('isUsable returns false for expired code', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `EXPIRED${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    assert.isFalse(code.isUsable())
  })

  test('isUsable returns false when max uses reached', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `MAXED${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
      maxUses: 5,
      timesUsed: 5,
    })

    assert.isFalse(code.isUsable())
  })

  test('canBeUsedBy returns true for user within per-user limit', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const code = await DiscountCode.create({
      code: `PERUSER${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
      maxUsesPerUser: 2,
    })

    // Record one usage
    await DiscountCodeUsage.create({
      discountCodeId: code.id,
      userId: user.id,
      usedAt: DateTime.now(),
      checkoutSessionId: `session_${uniqueId()}`,
    })

    const canUse = await code.canBeUsedBy(user.id)
    assert.isTrue(canUse)
  })

  test('canBeUsedBy returns false for user at per-user limit', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const code = await DiscountCode.create({
      code: `PERUSER${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
      maxUsesPerUser: 1,
    })

    // Record one usage
    await DiscountCodeUsage.create({
      discountCodeId: code.id,
      userId: user.id,
      usedAt: DateTime.now(),
      checkoutSessionId: `session_${uniqueId()}`,
    })

    const canUse = await code.canBeUsedBy(user.id)
    assert.isFalse(canUse)
  })

  test('calculateDiscount returns correct amount for percent discount', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `PERCENT${id}`,
      discountType: 'percent',
      discountValue: 25,
      isActive: true,
    })

    const discount = code.calculateDiscount(10000)
    assert.equal(discount, 2500) // 25% of 10000
  })

  test('calculateDiscount returns correct amount for fixed discount', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `FIXED${id}`,
      discountType: 'fixed',
      discountValue: 500,
      currency: 'usd',
      isActive: true,
    })

    const discount = code.calculateDiscount(1000)
    assert.equal(discount, 500)
  })

  test('calculateDiscount does not exceed original amount', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `FIXED${id}`,
      discountType: 'fixed',
      discountValue: 5000,
      currency: 'usd',
      isActive: true,
    })

    const discount = code.calculateDiscount(1000)
    assert.equal(discount, 1000) // Can't discount more than the amount
  })

  test('calculateDiscount handles 100% percent discount', async ({ assert }) => {
    const id = uniqueId()
    const code = await DiscountCode.create({
      code: `FULL${id}`,
      discountType: 'percent',
      discountValue: 100,
      isActive: true,
    })

    const discount = code.calculateDiscount(5000)
    assert.equal(discount, 5000)
  })
})

test.group('DiscountCodeUsage Model', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('countByUserAndCode returns correct count', async ({ assert }) => {
    const id = uniqueId()
    const user = await User.create({
      email: `user-${id}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const code = await DiscountCode.create({
      code: `COUNT${id}`,
      discountType: 'percent',
      discountValue: 20,
      isActive: true,
    })

    // Create multiple usages
    await DiscountCodeUsage.create({
      discountCodeId: code.id,
      userId: user.id,
      usedAt: DateTime.now(),
      checkoutSessionId: `session1_${uniqueId()}`,
    })
    await DiscountCodeUsage.create({
      discountCodeId: code.id,
      userId: user.id,
      usedAt: DateTime.now(),
      checkoutSessionId: `session2_${uniqueId()}`,
    })

    const count = await DiscountCodeUsage.countByUserAndCode(user.id, code.id)
    assert.equal(count, 2)
  })

  test('countByUserAndCode returns zero for no usages', async ({ assert }) => {
    const count = await DiscountCodeUsage.countByUserAndCode(99999, 99999)
    assert.equal(count, 0)
  })
})

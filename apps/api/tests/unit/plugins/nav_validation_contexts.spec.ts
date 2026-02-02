import { test } from '@japa/runner'
import { buildNavValidationContexts } from '#services/plugins/nav_validation_contexts'

test.group('nav_validation_contexts', () => {
  test('builds matrix including guest and authenticated contexts', ({ assert }) => {
    const contexts = buildNavValidationContexts({
      tierLevels: [0, 1],
      entitlementSets: [new Set<string>(), new Set<string>(['admin'])],
    })

    const names = contexts.map((c) => c.name)
    assert.isTrue(names.some((n) => n.startsWith('guest-tier0-entitlements-')))
    assert.isTrue(names.some((n) => n.startsWith('admin-single-tenant-tier0-')))
    assert.isTrue(names.some((n) => n.startsWith('user-multi-tenant-tier1-')))
  })

  test('normalizes tier levels and deduplicates entitlement sets', ({ assert }) => {
    const contexts = buildNavValidationContexts({
      tierLevels: [-1, 0, 2, 2, Number.NaN, Number.POSITIVE_INFINITY],
      entitlementSets: [new Set<string>(), new Set<string>(['admin']), new Set<string>(['admin'])],
    })

    const names = contexts.map((c) => c.name)
    assert.isFalse(names.some((n) => n.includes('tier-1')))
    assert.isTrue(names.some((n) => n.includes('tier0')))
    assert.isTrue(names.some((n) => n.includes('tier2')))

    const guestContexts = names.filter((n) => n.startsWith('guest-tier0-entitlements-'))
    assert.equal(guestContexts.length, 2)
  })
})

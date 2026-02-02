import { test } from '@japa/runner'
import { buildValidationEntitlementSets } from '#services/plugins/nav_validation_entitlements'

function toKey(set: ReadonlySet<string>): string {
  return Array.from(set).sort().join('|')
}

test.group('nav_validation_entitlements', () => {
  test('always includes empty and admin baseline entitlement sets', ({ assert }) => {
    const result = buildValidationEntitlementSets({
      allGrantedCapabilities: new Set<string>(),
      grantedByPlugin: [],
    })

    const keys = new Set(result.map(toKey))
    assert.isTrue(keys.has(''))
    assert.isTrue(keys.has('admin'))
  })

  test('includes plugin bundles, singletons, pairs, and full set', ({ assert }) => {
    const allCaps = new Set(['cap.a', 'cap.b', 'cap.c'])
    const result = buildValidationEntitlementSets({
      allGrantedCapabilities: allCaps,
      grantedByPlugin: [new Set(['cap.a', 'cap.c'])],
    })
    const keys = new Set(result.map(toKey))

    assert.isTrue(keys.has('cap.a|cap.b|cap.c'))
    assert.isTrue(keys.has('cap.a'))
    assert.isTrue(keys.has('cap.b'))
    assert.isTrue(keys.has('cap.c'))
    assert.isTrue(keys.has('cap.a|cap.b'))
    assert.isTrue(keys.has('cap.a|cap.c'))
    assert.isTrue(keys.has('cap.b|cap.c'))
  })

  test('uses full power set when capability count is small', ({ assert }) => {
    const allCaps = new Set(['cap.a', 'cap.b', 'cap.c'])
    const result = buildValidationEntitlementSets({
      allGrantedCapabilities: allCaps,
      grantedByPlugin: [],
    })
    const keys = new Set(result.map(toKey))

    // 2^3 capability subsets + empty/admin baselines
    assert.isAtLeast(keys.size, 10)
    assert.isTrue(keys.has('cap.a|cap.b|cap.c'))
    assert.isTrue(keys.has('cap.a|cap.b'))
    assert.isTrue(keys.has('cap.a|cap.c'))
    assert.isTrue(keys.has('cap.b|cap.c'))
  })

  test('deduplicates repeated plugin capability bundles', ({ assert }) => {
    const result = buildValidationEntitlementSets({
      allGrantedCapabilities: new Set(['cap.a']),
      grantedByPlugin: [new Set(['cap.a']), new Set(['cap.a'])],
    })
    const keys = result.map(toKey)
    const unique = new Set(keys)
    assert.equal(keys.length, unique.size)
  })

  test('does not explode to full power set when capability count is large', ({ assert }) => {
    const manyCaps = new Set(Array.from({ length: 12 }, (_, index) => `cap.${index}`))
    const result = buildValidationEntitlementSets({
      allGrantedCapabilities: manyCaps,
      grantedByPlugin: [],
    })

    // Should stay far below 2^12 + baseline due adaptive caps.
    assert.isBelow(result.length, 1000)
  })
})

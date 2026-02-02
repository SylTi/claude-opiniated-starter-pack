/**
 * Build entitlement sets used by boot-time nav validation contexts.
 *
 * The generated set aims to catch collisions across:
 * - no capabilities
 * - admin baseline capability
 * - per-capability branches
 * - per-plugin capability bundles
 * - pairwise capability conjunction branches
 * - exhaustive subsets when capability count is small
 */

const MAX_POWERSET_CAPABILITIES = (() => {
  const parsed = Number.parseInt(process.env.PLUGIN_NAV_VALIDATION_POWERSET_MAX_CAPS ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8
})()

const MAX_PAIR_COMBINATIONS = (() => {
  const parsed = Number.parseInt(process.env.PLUGIN_NAV_VALIDATION_MAX_PAIR_COMBINATIONS ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 512
})()

export function buildValidationEntitlementSets(options: {
  allGrantedCapabilities: ReadonlySet<string>
  grantedByPlugin: readonly ReadonlySet<string>[]
}): ReadonlySet<string>[] {
  const { allGrantedCapabilities, grantedByPlugin } = options

  const candidateSets: Array<ReadonlySet<string>> = [new Set<string>(), new Set<string>(['admin'])]

  if (allGrantedCapabilities.size > 0) {
    candidateSets.push(new Set(allGrantedCapabilities))
    for (const capability of allGrantedCapabilities) {
      candidateSets.push(new Set([capability]))
    }
    candidateSets.push(...grantedByPlugin)

    const sortedCaps = Array.from(allGrantedCapabilities).sort()

    // Pair coverage catches common capA && capB hook branches.
    let pairCount = 0
    for (let i = 0; i < sortedCaps.length && pairCount < MAX_PAIR_COMBINATIONS; i++) {
      for (let j = i + 1; j < sortedCaps.length && pairCount < MAX_PAIR_COMBINATIONS; j++) {
        candidateSets.push(new Set([sortedCaps[i], sortedCaps[j]]))
        pairCount++
      }
    }

    // Exhaustive power set for small domains.
    if (sortedCaps.length <= MAX_POWERSET_CAPABILITIES) {
      const maxMask = 1 << sortedCaps.length
      for (let mask = 1; mask < maxMask; mask++) {
        const subset = new Set<string>()
        for (const [bit, capability] of sortedCaps.entries()) {
          if ((mask & (1 << bit)) !== 0) {
            subset.add(capability)
          }
        }
        candidateSets.push(subset)
      }
    }
  }

  const uniqueByKey = new Map<string, ReadonlySet<string>>()
  for (const set of candidateSets) {
    const key = Array.from(set).sort().join('|')
    if (!uniqueByKey.has(key)) {
      uniqueByKey.set(key, new Set(set))
    }
  }

  return Array.from(uniqueByKey.values())
}

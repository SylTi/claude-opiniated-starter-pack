import type { NavContext } from '@saas/plugins-core'

/**
 * Named navigation validation context.
 */
export interface NavValidationContextDescriptor {
  name: string
  context: NavContext
}

/**
 * Build a deterministic key for entitlement set deduplication.
 */
function entitlementKey(entitlements: ReadonlySet<string>): string {
  return Array.from(entitlements).sort().join('|')
}

/**
 * Normalize tier levels for validation.
 * Keeps finite, non-negative integers and always includes tier 0.
 */
function normalizeTierLevels(tierLevels: readonly number[]): number[] {
  const normalized = new Set<number>([0])

  for (const level of tierLevels) {
    if (!Number.isFinite(level)) continue
    const intLevel = Math.trunc(level)
    if (intLevel < 0) continue
    normalized.add(intLevel)
  }

  return Array.from(normalized).sort((a, b) => a - b)
}

/**
 * Deduplicate entitlement sets while preserving insertion order.
 */
function dedupeEntitlementSets(
  entitlementSets: readonly ReadonlySet<string>[]
): ReadonlySet<string>[] {
  const seen = new Set<string>()
  const result: ReadonlySet<string>[] = []

  for (const entitlements of entitlementSets) {
    const key = entitlementKey(entitlements)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(new Set(entitlements))
  }

  return result
}

/**
 * Build a broad context matrix for full nav-pipeline collision validation.
 *
 * This is intentionally data-driven so boot validation can cover:
 * - role-specific branches (guest/user/admin)
 * - tenant shape branches (single vs multi-tenant)
 * - tier-specific branches (all known tier levels)
 * - entitlement-gated branches (known entitlement sets)
 */
export function buildNavValidationContexts(options: {
  tierLevels: readonly number[]
  entitlementSets: readonly ReadonlySet<string>[]
}): NavValidationContextDescriptor[] {
  const tierLevels = normalizeTierLevels(options.tierLevels)
  const entitlementSets = dedupeEntitlementSets(options.entitlementSets)

  const contexts: NavValidationContextDescriptor[] = []
  const authenticatedRoles: Array<'admin' | 'user'> = ['admin', 'user']
  const tenantModes = [
    { hasMultipleTenants: false, suffix: 'single-tenant' },
    { hasMultipleTenants: true, suffix: 'multi-tenant' },
  ] as const

  for (const role of authenticatedRoles) {
    for (const tenantMode of tenantModes) {
      for (const tierLevel of tierLevels) {
        for (const entitlements of entitlementSets) {
          const entitlementSuffix =
            entitlementKey(entitlements).replace(/[^a-zA-Z0-9|_-]/g, '') || 'none'

          contexts.push({
            name: `${role}-${tenantMode.suffix}-tier${tierLevel}-entitlements-${entitlementSuffix}`,
            context: {
              userId: `validation-${role}`,
              userRole: role,
              entitlements: new Set(entitlements),
              tenantId: 'validation-tenant',
              tierLevel,
              hasMultipleTenants: tenantMode.hasMultipleTenants,
            },
          })
        }
      }
    }
  }

  // Guest contexts (no tenant, no user id). Keep tier at 0 as canonical guest shape.
  for (const entitlements of entitlementSets) {
    const entitlementSuffix = entitlementKey(entitlements).replace(/[^a-zA-Z0-9|_-]/g, '') || 'none'

    contexts.push({
      name: `guest-tier0-entitlements-${entitlementSuffix}`,
      context: {
        userRole: 'guest',
        entitlements: new Set(entitlements),
        tenantId: null,
        tierLevel: 0,
        hasMultipleTenants: false,
      },
    })
  }

  return contexts
}

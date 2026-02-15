import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AuthToken from '#models/auth_token'
import Tenant from '#models/tenant'
import TenantInvitation from '#models/tenant_invitation'
import TenantMembership from '#models/tenant_membership'
import type SubscriptionTier from '#models/subscription_tier'

export interface TenantQuotaLimits {
  members: number | null
  pendingInvitations: number | null
  authTokensPerTenant: number | null
  authTokensPerUser: number | null
}

export interface TenantQuotaUsage {
  members: number
  pendingInvitations: number
  authTokensPerTenant: number
  authTokensPerUser: number
}

export interface TenantQuotaMetric {
  limit: number | null
  used: number
  remaining: number | null
  exceeded: boolean
}

export interface TenantQuotaSnapshot {
  members: TenantQuotaMetric
  pendingInvitations: TenantQuotaMetric
  authTokensPerTenant: TenantQuotaMetric
  authTokensPerUser: TenantQuotaMetric
}

export interface UpdateTenantQuotaInput {
  maxMembers?: number | null
  maxPendingInvitations?: number | null
  maxAuthTokensPerTenant?: number | null
  maxAuthTokensPerUser?: number | null
}

interface NormalizedTenantQuotaOverrides {
  maxPendingInvitations?: number | null
  maxAuthTokensPerTenant?: number | null
  maxAuthTokensPerUser?: number | null
}

function toCount(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildQuotaMetric(limit: number | null, used: number): TenantQuotaMetric {
  if (limit === null) {
    return {
      limit,
      used,
      remaining: null,
      exceeded: false,
    }
  }

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    exceeded: used > limit,
  }
}

function normalizeLimitValue(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined
  if (value < 1) return undefined
  return value
}

function normalizeOverrides(raw: unknown): NormalizedTenantQuotaOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const source = raw as Record<string, unknown>
  const maxPendingInvitations = normalizeLimitValue(source.maxPendingInvitations)
  const maxAuthTokensPerTenant = normalizeLimitValue(source.maxAuthTokensPerTenant)
  const maxAuthTokensPerUser = normalizeLimitValue(source.maxAuthTokensPerUser)

  const normalized: NormalizedTenantQuotaOverrides = {}

  if (maxPendingInvitations !== undefined) {
    normalized.maxPendingInvitations = maxPendingInvitations
  }
  if (maxAuthTokensPerTenant !== undefined) {
    normalized.maxAuthTokensPerTenant = maxAuthTokensPerTenant
  }
  if (maxAuthTokensPerUser !== undefined) {
    normalized.maxAuthTokensPerUser = maxAuthTokensPerUser
  }

  return normalized
}

interface TierQuotaDefaults {
  maxPendingInvitations?: number | null
  maxAuthTokensPerTenant?: number | null
  maxAuthTokensPerUser?: number | null
}

function extractTierQuotaDefaults(features: unknown): TierQuotaDefaults {
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return {}
  }

  const featureMap = features as Record<string, unknown>
  const quotaSource = featureMap.quotas
  if (!quotaSource || typeof quotaSource !== 'object' || Array.isArray(quotaSource)) {
    return {}
  }

  const quotas = quotaSource as Record<string, unknown>
  const getValue = (camelKey: string, snakeKey: string): unknown =>
    quotas[camelKey] ?? quotas[snakeKey]

  return {
    maxPendingInvitations: normalizeLimitValue(
      getValue('maxPendingInvitations', 'max_pending_invitations')
    ),
    maxAuthTokensPerTenant: normalizeLimitValue(
      getValue('maxAuthTokensPerTenant', 'max_auth_tokens_per_tenant')
    ),
    maxAuthTokensPerUser: normalizeLimitValue(
      getValue('maxAuthTokensPerUser', 'max_auth_tokens_per_user')
    ),
  }
}

export class TenantQuotaService {
  private getDefaultTokenLimitsByTierLevel(level: number): {
    perTenant: number | null
    perUser: number | null
  } {
    if (level >= 2) {
      return { perTenant: 5000, perUser: 500 }
    }
    if (level >= 1) {
      return { perTenant: 500, perUser: 100 }
    }
    return { perTenant: 50, perUser: 20 }
  }

  async getEffectiveLimits(
    tenant: Tenant,
    trx?: TransactionClientContract
  ): Promise<TenantQuotaLimits> {
    let memberLimit: number | null = tenant.maxMembers
    let subscriptionLevel = 0
    let tierDefaults: TierQuotaDefaults = {}

    try {
      memberLimit = await tenant.getEffectiveMaxMembers(trx)
    } catch {
      // Keep fallback from tenant.maxMembers
    }

    try {
      const subscriptionTier: SubscriptionTier = await tenant.getSubscriptionTier(trx)
      subscriptionLevel = subscriptionTier.level
      tierDefaults = extractTierQuotaDefaults(subscriptionTier.features)
    } catch {
      // Keep free-tier fallback level
    }

    const defaults = this.getDefaultTokenLimitsByTierLevel(subscriptionLevel)
    const overrides = normalizeOverrides(tenant.quotaOverrides)

    return {
      members: memberLimit,
      pendingInvitations:
        overrides.maxPendingInvitations ?? tierDefaults.maxPendingInvitations ?? memberLimit,
      authTokensPerTenant:
        overrides.maxAuthTokensPerTenant ??
        tierDefaults.maxAuthTokensPerTenant ??
        defaults.perTenant,
      authTokensPerUser:
        overrides.maxAuthTokensPerUser ?? tierDefaults.maxAuthTokensPerUser ?? defaults.perUser,
    }
  }

  async getUsage(
    tenantId: number,
    userId: number,
    trx?: TransactionClientContract
  ): Promise<TenantQuotaUsage> {
    const queryOptions = trx ? { client: trx } : {}

    const [membersCount, pendingInvitationsCount, authTokensTenantCount, authTokensUserCount] =
      await Promise.all([
        TenantMembership.query(queryOptions)
          .where('tenantId', tenantId)
          .count('* as total')
          .first(),
        TenantInvitation.query(queryOptions)
          .where('tenantId', tenantId)
          .where('status', 'pending')
          .count('* as total')
          .first(),
        AuthToken.query(queryOptions).where('tenantId', tenantId).count('* as total').first(),
        AuthToken.query(queryOptions)
          .where('tenantId', tenantId)
          .where('userId', userId)
          .count('* as total')
          .first(),
      ])

    return {
      members: toCount(membersCount?.$extras.total),
      pendingInvitations: toCount(pendingInvitationsCount?.$extras.total),
      authTokensPerTenant: toCount(authTokensTenantCount?.$extras.total),
      authTokensPerUser: toCount(authTokensUserCount?.$extras.total),
    }
  }

  async getSnapshot(
    tenant: Tenant,
    userId: number,
    trx?: TransactionClientContract
  ): Promise<TenantQuotaSnapshot> {
    const [limits, usage] = await Promise.all([
      this.getEffectiveLimits(tenant, trx),
      this.getUsage(tenant.id, userId, trx),
    ])

    return {
      members: buildQuotaMetric(limits.members, usage.members),
      pendingInvitations: buildQuotaMetric(limits.pendingInvitations, usage.pendingInvitations),
      authTokensPerTenant: buildQuotaMetric(limits.authTokensPerTenant, usage.authTokensPerTenant),
      authTokensPerUser: buildQuotaMetric(limits.authTokensPerUser, usage.authTokensPerUser),
    }
  }

  willExceed(limit: number | null, used: number, increment: number = 1): boolean {
    if (limit === null) {
      return false
    }
    return used + increment > limit
  }

  applyQuotaUpdates(tenant: Tenant, input: UpdateTenantQuotaInput): void {
    if (input.maxMembers !== undefined) {
      tenant.maxMembers = input.maxMembers
    }

    const currentOverrides = normalizeOverrides(tenant.quotaOverrides)
    const nextOverrides: NormalizedTenantQuotaOverrides = { ...currentOverrides }

    if (input.maxPendingInvitations !== undefined) {
      nextOverrides.maxPendingInvitations = input.maxPendingInvitations
    }
    if (input.maxAuthTokensPerTenant !== undefined) {
      nextOverrides.maxAuthTokensPerTenant = input.maxAuthTokensPerTenant
    }
    if (input.maxAuthTokensPerUser !== undefined) {
      nextOverrides.maxAuthTokensPerUser = input.maxAuthTokensPerUser
    }

    tenant.quotaOverrides = nextOverrides
  }
}

export const tenantQuotaService = new TenantQuotaService()

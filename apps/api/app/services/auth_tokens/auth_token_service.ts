import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AuthToken from '#models/auth_token'
import TenantMembership from '#models/tenant_membership'
import Tenant from '#models/tenant'
import { systemOps } from '#services/system_operation_service'
import { auditEventEmitter } from '#services/audit_event_emitter'
import { TENANT_ROLES } from '#constants/roles'
import { AUDIT_EVENT_TYPES } from '@saas/shared'
import { tenantQuotaService } from '#services/tenant_quota_service'

export interface AuthTokenRecordDTO {
  id: string
  kind: string
  name: string
  scopes: string[]
  metadata: Record<string, unknown> | null
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface CreateAuthTokenInput {
  tenantId: number
  userId: number
  actorUserId: number
  pluginId: string
  kind: string
  name: string
  scopes: string[]
  expiresAt?: string | null
  metadata?: Record<string, unknown> | null
  requestIp?: string | null
  requestUserAgent?: string | null
}

export interface CreateAuthTokenResult {
  token: AuthTokenRecordDTO
  tokenValue: string
}

export interface ListAuthTokensInput {
  tenantId: number
  pluginId: string
  kind?: string
  userId?: number
  actorUserId: number
}

export interface RevokeAuthTokenInput {
  tenantId: number
  pluginId: string
  tokenId: string
  kind?: string
  userId?: number
  actorUserId: number
}

export interface ValidateAuthTokenInput {
  pluginId: string
  kind?: string
  tokenValue: string
  expectedTenantId?: number
  requiredScopes?: string[]
  requestIp?: string | null
  requestUserAgent?: string | null
}

export type ValidateAuthTokenResult =
  | {
      valid: true
      token: AuthTokenRecordDTO
      tenantId: number
      userId: number
    }
  | {
      valid: false
      error: string
    }

export class AuthTokenPolicyViolationError extends Error {
  readonly code = 'AUTH_TOKEN_POLICY_VIOLATION' as const
  readonly rule: string

  constructor(rule: string, message: string) {
    super(message)
    this.name = 'AuthTokenPolicyViolationError'
    this.rule = rule
  }
}

export type PolicyViolation = {
  rule: string
  message: string
  meta?: Record<string, unknown>
}

export interface IssuancePolicyInput {
  tenantId: number
  userId: number
  actorRole: string
  pluginId: string
  kind: string
  scopes: string[]
  expiresAt: DateTime | null
  trx: TransactionClientContract
}

interface EnterpriseHooks {
  checkIssuancePolicy(input: IssuancePolicyInput): Promise<PolicyViolation | null>
  checkUsagePolicy(
    tenantId: number,
    requestIp: string | null,
    trx: TransactionClientContract
  ): Promise<PolicyViolation | null>
}

let cachedEnterpriseHooks: EnterpriseHooks | null | undefined

async function getEnterpriseHooks(): Promise<EnterpriseHooks | null> {
  if (cachedEnterpriseHooks !== undefined) return cachedEnterpriseHooks
  try {
    // @ts-ignore - Enterprise feature: module may not exist on public repo
    const mod = await import('./auth_token_service_enterprise.js')
    cachedEnterpriseHooks = mod.authTokenEnterpriseHooks
  } catch {
    cachedEnterpriseHooks = null
  }
  return cachedEnterpriseHooks as EnterpriseHooks | null
}

function isPrivilegedIssuerRole(role?: string): boolean {
  return role === TENANT_ROLES.OWNER || role === TENANT_ROLES.ADMIN
}

/**
 * Core auth token primitives (OSS).
 * Plugins consume this via adapters exposed at registration time.
 */
export default class AuthTokenService {
  async listTokens(input: ListAuthTokensInput): Promise<AuthTokenRecordDTO[]> {
    return systemOps.withTenantContext(
      input.tenantId,
      async (trx) => {
        await this.assertActorCanManageTokenScope({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          targetUserId: input.userId,
          trx,
        })

        const query = AuthToken.query({ client: trx })
          .where('tenant_id', input.tenantId)
          .andWhere('plugin_id', input.pluginId)
          .orderBy('created_at', 'desc')

        if (input.kind) {
          query.andWhere('kind', input.kind)
        }

        if (input.userId !== undefined) {
          query.andWhere('user_id', input.userId)
        }

        const rows = await query
        return rows.map((row) => this.toDTO(row))
      },
      input.actorUserId
    )
  }

  async createToken(input: CreateAuthTokenInput): Promise<CreateAuthTokenResult> {
    const name = input.name.trim()
    if (!name) {
      throw new Error('Token name is required')
    }

    const scopes = this.normalizeScopes(input.scopes)
    if (scopes.length === 0) {
      throw new Error('At least one scope is required')
    }

    let expiresAt: DateTime | null = null
    if (input.expiresAt) {
      expiresAt = DateTime.fromISO(input.expiresAt)
      if (!expiresAt.isValid) {
        throw new Error('Invalid expiration date format. Use ISO 8601 format.')
      }
    }

    const token = await systemOps.withTenantContext(
      input.tenantId,
      async (trx) => {
        await this.acquireIssuanceLock(input.tenantId, input.userId, trx)

        const actorRole = await this.resolveMemberRole(input.tenantId, input.actorUserId, trx)
        if (!actorRole) {
          throw new Error('Token issuer must be an active tenant member')
        }

        const tokenOwnerRole = await this.resolveMemberRole(input.tenantId, input.userId, trx)
        if (!tokenOwnerRole) {
          throw new Error('Token owner must be an active tenant member')
        }

        const policyViolation = await this.getIssuancePolicyViolation({
          ...input,
          actorRole,
          scopes,
          expiresAt,
          trx,
        })

        if (policyViolation) {
          this.emitPolicyDeniedIssuanceAudit(input, input.actorUserId, policyViolation)
          throw new AuthTokenPolicyViolationError(policyViolation.rule, policyViolation.message)
        }

        const tokenValue = this.generateToken()
        const tokenHash = this.hashToken(tokenValue)

        const createdToken = await AuthToken.create(
          {
            tenantId: input.tenantId,
            userId: input.userId,
            pluginId: input.pluginId,
            kind: input.kind,
            name,
            tokenHash,
            scopes,
            metadata: input.metadata ?? null,
            expiresAt,
          },
          { client: trx }
        )

        return {
          token: createdToken,
          tokenValue,
        }
      },
      input.actorUserId
    )

    return {
      token: this.toDTO(token.token),
      tokenValue: token.tokenValue,
    }
  }

  async revokeToken(input: RevokeAuthTokenInput): Promise<boolean> {
    return systemOps.withTenantContext(
      input.tenantId,
      async (trx) => {
        await this.assertActorCanManageTokenScope({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          targetUserId: input.userId,
          trx,
        })

        const query = AuthToken.query({ client: trx })
          .where('id', input.tokenId)
          .andWhere('tenant_id', input.tenantId)
          .andWhere('plugin_id', input.pluginId)

        if (input.kind) {
          query.andWhere('kind', input.kind)
        }

        if (input.userId !== undefined) {
          query.andWhere('user_id', input.userId)
        }

        const token = await query.first()
        if (!token) {
          return false
        }

        await token.delete()
        return true
      },
      input.actorUserId
    )
  }

  async validateToken(input: ValidateAuthTokenInput): Promise<ValidateAuthTokenResult> {
    if (!input.tokenValue || input.tokenValue.length < 32) {
      return { valid: false, error: 'Invalid token format' }
    }

    return systemOps.withSystemContext(async (trx) => {
      const query = AuthToken.query({ client: trx })
        .where('plugin_id', input.pluginId)
        .andWhere('token_hash', this.hashToken(input.tokenValue))

      if (input.kind) {
        query.andWhere('kind', input.kind)
      }

      const token = await query.first()
      if (!token) {
        return { valid: false, error: 'Token not found' }
      }

      if (
        input.expectedTenantId !== undefined &&
        Number.isInteger(input.expectedTenantId) &&
        token.tenantId !== input.expectedTenantId
      ) {
        return { valid: false, error: 'Token not found' }
      }

      if (token.isExpired) {
        return { valid: false, error: 'Token has expired' }
      }

      const usagePolicyViolation = await this.getUsagePolicyViolation(
        token.tenantId,
        input.requestIp ?? null,
        trx
      )
      if (usagePolicyViolation) {
        this.emitPolicyDeniedUsageAudit(token, input, usagePolicyViolation)
        return { valid: false, error: usagePolicyViolation.message }
      }

      if (input.requiredScopes && input.requiredScopes.length > 0) {
        const missingScope = input.requiredScopes.find((scope) => !token.hasScope(scope))
        if (missingScope) {
          return { valid: false, error: `Token missing required scope: ${missingScope}` }
        }
      }

      // Non-critical telemetry; don't fail token validation if this write fails.
      const now = new Date().toISOString()
      trx
        .from(AuthToken.table)
        .where('id', token.id)
        .update({
          last_used_at: now,
          updated_at: now,
        })
        .catch((error) => {
          logger.warn({ err: error, tokenId: token.id }, 'Failed to update auth token last_used_at')
        })

      return {
        valid: true,
        token: this.toDTO(token),
        tenantId: token.tenantId,
        userId: token.userId,
      }
    })
  }

  private async getIssuancePolicyViolation(
    input: IssuancePolicyInput
  ): Promise<PolicyViolation | null> {
    const quotaViolation = await this.getTenantQuotaViolation(input)
    if (quotaViolation) {
      return quotaViolation
    }

    const hooks = await getEnterpriseHooks()
    if (!hooks) {
      return null
    }

    return hooks.checkIssuancePolicy(input)
  }

  private async getTenantQuotaViolation(input: {
    tenantId: number
    userId: number
    trx: TransactionClientContract
  }): Promise<PolicyViolation | null> {
    const tenant = await Tenant.find(input.tenantId, { client: input.trx })
    if (!tenant) {
      return null
    }

    const limits = await tenantQuotaService.getEffectiveLimits(tenant, input.trx)
    const [tenantTokenCountResult, userTokenCountResult] = await Promise.all([
      input.trx.from(AuthToken.table).where('tenant_id', input.tenantId).count('* as total'),
      input.trx
        .from(AuthToken.table)
        .where('tenant_id', input.tenantId)
        .where('user_id', input.userId)
        .count('* as total'),
    ])

    const tenantTokenCount = Number(tenantTokenCountResult[0]?.total ?? 0)
    if (tenantQuotaService.willExceed(limits.authTokensPerTenant, tenantTokenCount, 1)) {
      return {
        rule: 'tenant_auth_token_quota',
        message: `Tenant auth token quota reached (${limits.authTokensPerTenant})`,
        meta: {
          limit: limits.authTokensPerTenant,
          current: tenantTokenCount,
        },
      }
    }

    const userTokenCount = Number(userTokenCountResult[0]?.total ?? 0)
    if (tenantQuotaService.willExceed(limits.authTokensPerUser, userTokenCount, 1)) {
      return {
        rule: 'user_auth_token_quota',
        message: `User auth token quota reached (${limits.authTokensPerUser})`,
        meta: {
          limit: limits.authTokensPerUser,
          current: userTokenCount,
        },
      }
    }

    return null
  }

  private async getUsagePolicyViolation(
    tenantId: number,
    requestIp: string | null,
    trx: TransactionClientContract
  ): Promise<PolicyViolation | null> {
    const hooks = await getEnterpriseHooks()
    if (!hooks) {
      return null
    }

    return hooks.checkUsagePolicy(tenantId, requestIp, trx)
  }

  private emitPolicyDeniedIssuanceAudit(
    input: CreateAuthTokenInput,
    actorUserId: number,
    violation: PolicyViolation
  ): void {
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.AUTH_TOKEN_ISSUANCE_DENIED_POLICY,
      tenantId: input.tenantId,
      actor: auditEventEmitter.createUserActor(actorUserId, {
        ip: input.requestIp ?? null,
        userAgent: input.requestUserAgent ?? null,
      }),
      resource: {
        type: 'auth_token',
        id: `${input.pluginId}:${input.kind}`,
      },
      meta: {
        pluginId: input.pluginId,
        kind: input.kind,
        rule: violation.rule,
        tokenOwnerUserId: input.userId,
        scopes: input.scopes,
        ...(violation.meta ?? {}),
      },
    })
  }

  private async acquireIssuanceLock(
    tenantId: number,
    userId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    await trx.rawQuery('SELECT pg_advisory_xact_lock(?, ?)', [tenantId, userId])
  }

  private async resolveMemberRole(
    tenantId: number,
    userId: number,
    trx: TransactionClientContract
  ): Promise<string | null> {
    const membership = await TenantMembership.query({ client: trx })
      .where('tenant_id', tenantId)
      .andWhere('user_id', userId)
      .first()

    return membership?.role ?? null
  }

  private async assertActorCanManageTokenScope(input: {
    tenantId: number
    actorUserId: number
    targetUserId?: number
    trx: TransactionClientContract
  }): Promise<void> {
    const actorRole = await this.resolveMemberRole(input.tenantId, input.actorUserId, input.trx)
    if (!actorRole) {
      throw new Error('Token issuer must be an active tenant member')
    }

    if (input.targetUserId === undefined) {
      if (!isPrivilegedIssuerRole(actorRole)) {
        throw new Error('Forbidden: cannot manage auth tokens for another user')
      }
      return
    }

    if (input.targetUserId !== input.actorUserId && !isPrivilegedIssuerRole(actorRole)) {
      throw new Error('Forbidden: cannot manage auth tokens for another user')
    }
  }

  private emitPolicyDeniedUsageAudit(
    token: AuthToken,
    input: ValidateAuthTokenInput,
    violation: PolicyViolation
  ): void {
    auditEventEmitter.emit({
      type: AUDIT_EVENT_TYPES.AUTH_TOKEN_USAGE_DENIED_POLICY,
      tenantId: token.tenantId,
      actor: auditEventEmitter.createUserActor(token.userId, {
        ip: input.requestIp ?? null,
        userAgent: input.requestUserAgent ?? null,
      }),
      resource: {
        type: 'auth_token',
        id: token.id,
      },
      meta: {
        pluginId: token.pluginId,
        kind: token.kind,
        rule: violation.rule,
        ...(violation.meta ?? {}),
      },
    })
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  generateToken(): string {
    return randomBytes(32).toString('hex')
  }

  private normalizeScopes(scopes: string[]): string[] {
    const set = new Set(scopes.map((scope) => scope.trim()).filter((scope) => scope.length > 0))
    return Array.from(set)
  }

  private toDTO(token: AuthToken): AuthTokenRecordDTO {
    return {
      id: token.id,
      kind: token.kind,
      name: token.name,
      scopes: token.scopes,
      metadata: token.metadata,
      lastUsedAt: token.lastUsedAt?.toISO() ?? null,
      expiresAt: token.expiresAt?.toISO() ?? null,
      createdAt: token.createdAt.toISO() ?? '',
    }
  }
}

export const authTokenService = new AuthTokenService()

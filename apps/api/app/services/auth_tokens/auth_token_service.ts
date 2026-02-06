import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import AuthToken from '#models/auth_token'
import { systemOps } from '#services/system_operation_service'

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
  pluginId: string
  kind: string
  name: string
  scopes: string[]
  expiresAt?: string | null
  metadata?: Record<string, unknown> | null
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
}

export interface RevokeAuthTokenInput {
  tenantId: number
  pluginId: string
  tokenId: string
  kind?: string
  userId?: number
}

export interface ValidateAuthTokenInput {
  pluginId: string
  kind?: string
  tokenValue: string
  requiredScopes?: string[]
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

/**
 * Core auth token primitives (OSS).
 * Plugins consume this via adapters exposed at registration time.
 */
export default class AuthTokenService {
  async listTokens(input: ListAuthTokensInput): Promise<AuthTokenRecordDTO[]> {
    return systemOps.withTenantContext(input.tenantId, async (trx) => {
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
    })
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

    const tokenValue = this.generateToken()
    const tokenHash = this.hashToken(tokenValue)

    const token = await systemOps.withTenantContext(input.tenantId, async (trx) => {
      return AuthToken.create(
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
    })

    return {
      token: this.toDTO(token),
      tokenValue,
    }
  }

  async revokeToken(input: RevokeAuthTokenInput): Promise<boolean> {
    return systemOps.withTenantContext(input.tenantId, async (trx) => {
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
    })
  }

  async validateToken(input: ValidateAuthTokenInput): Promise<ValidateAuthTokenResult> {
    if (!input.tokenValue || input.tokenValue.length < 32) {
      return { valid: false, error: 'Invalid token format' }
    }

    const adminDb = db.connection('postgres')
    const query = AuthToken.query({ client: adminDb })
      .where('plugin_id', input.pluginId)
      .andWhere('token_hash', this.hashToken(input.tokenValue))

    if (input.kind) {
      query.andWhere('kind', input.kind)
    }

    const token = await query.first()
    if (!token) {
      return { valid: false, error: 'Token not found' }
    }

    if (token.isExpired) {
      return { valid: false, error: 'Token has expired' }
    }

    if (input.requiredScopes && input.requiredScopes.length > 0) {
      const missingScope = input.requiredScopes.find((scope) => !token.hasScope(scope))
      if (missingScope) {
        return { valid: false, error: `Token missing required scope: ${missingScope}` }
      }
    }

    // Non-critical telemetry; don't fail token validation if this write fails.
    const now = new Date().toISOString()
    adminDb
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

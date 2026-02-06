import type { HttpContext } from '@adonisjs/core/http'
import { authTokenService } from '#services/auth_tokens/auth_token_service'
import { createAuthTokenValidator } from '#validators/auth_tokens'
import { loadPluginManifest } from '@saas/config/plugins/server'
import type { PluginAuthTokenKind } from '@saas/plugins-core'
import { TENANT_ROLES } from '#constants/roles'

function isPrivilegedTenantRole(role?: string): boolean {
  return role === TENANT_ROLES.OWNER || role === TENANT_ROLES.ADMIN
}

function normalizeKindParam(kind: unknown): string | undefined {
  if (kind === undefined || kind === null) {
    return undefined
  }
  if (typeof kind !== 'string') {
    return undefined
  }
  const trimmed = kind.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

async function resolveAuthTokenConfig(
  pluginId: string,
  kind: string | undefined,
  response: HttpContext['response']
): Promise<{ kinds: PluginAuthTokenKind[]; kindConfig?: PluginAuthTokenKind } | null> {
  const manifest = await loadPluginManifest(pluginId)
  if (!manifest) {
    response.notFound({
      error: 'NotFound',
      message: `Plugin "${pluginId}" is not registered`,
    })
    return null
  }

  const kinds = manifest.authTokens?.kinds ?? []
  if (kinds.length === 0) {
    response.badRequest({
      error: 'ValidationError',
      message: `Plugin "${pluginId}" does not support auth tokens`,
    })
    return null
  }

  if (!kind) {
    return { kinds }
  }

  const kindConfig = kinds.find((entry) => entry.id === kind)
  if (!kindConfig) {
    response.badRequest({
      error: 'ValidationError',
      message: `Unknown token kind "${kind}"`,
    })
    return null
  }

  return { kinds, kindConfig }
}

function areScopesAllowed(scopes: string[], allowedScopes: Set<string>): boolean {
  return scopes.every((scope) => allowedScopes.has(scope))
}

/**
 * Core auth token management for user profile integrations.
 * Tenant-scoped via tenant middleware + RLS.
 */
export default class AuthTokensController {
  /**
   * GET /api/v1/auth-tokens?pluginId=notarium&kind=integration
   */
  async index({ request, response, tenant, auth }: HttpContext): Promise<void> {
    const pluginId = request.input('pluginId')
    const kindParam = request.input('kind')

    if (typeof pluginId !== 'string' || pluginId.trim().length === 0) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'pluginId query parameter is required',
      })
    }

    const kind = normalizeKindParam(kindParam)
    if (kindParam !== undefined && !kind) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'kind query parameter must be a non-empty string',
      })
    }

    const config = await resolveAuthTokenConfig(pluginId.trim(), kind, response)
    if (!config) {
      return
    }

    const tenantRole = tenant?.membership?.role
    if (!tenantRole) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Tenant membership required',
      })
    }

    if (!auth.user) {
      return response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    const userId = isPrivilegedTenantRole(tenantRole) ? undefined : auth.user.id

    const tokens = await authTokenService.listTokens({
      tenantId: tenant!.id,
      pluginId: pluginId.trim(),
      kind,
      userId,
    })

    response.json({ data: tokens })
  }

  /**
   * POST /api/v1/auth-tokens
   */
  async store({ request, response, auth, tenant }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(createAuthTokenValidator)

    if (!auth.user) {
      return response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    const tenantRole = tenant?.membership?.role
    if (!tenantRole) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Tenant membership required',
      })
    }

    const config = await resolveAuthTokenConfig(payload.pluginId, payload.kind, response)
    if (!config || !config.kindConfig) {
      return
    }

    const allowedScopes = new Set(config.kindConfig.scopes.map((scope) => scope.id))
    if (!areScopesAllowed(payload.scopes, allowedScopes)) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'One or more scopes are not allowed for this token kind',
      })
    }

    try {
      const created = await authTokenService.createToken({
        tenantId: tenant!.id,
        userId: auth.user.id,
        pluginId: payload.pluginId,
        kind: payload.kind,
        name: payload.name,
        scopes: payload.scopes,
        expiresAt: payload.expiresAt ?? null,
      })

      response.created({ data: created })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create token'
      if (message.toLowerCase().includes('expiration date')) {
        return response.badRequest({
          error: 'ValidationError',
          message,
        })
      }
      throw error
    }
  }

  /**
   * DELETE /api/v1/auth-tokens/:id?pluginId=notarium&kind=integration
   */
  async destroy({ request, params, response, tenant, auth }: HttpContext): Promise<void> {
    const pluginId = request.input('pluginId')
    const kindParam = request.input('kind')
    const tokenId = params.id

    if (typeof pluginId !== 'string' || pluginId.trim().length === 0) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'pluginId query parameter is required',
      })
    }

    if (typeof tokenId !== 'string' || tokenId.trim().length === 0) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Token id is required',
      })
    }

    const kind = normalizeKindParam(kindParam)
    if (kindParam !== undefined && !kind) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'kind query parameter must be a non-empty string',
      })
    }

    const config = await resolveAuthTokenConfig(pluginId.trim(), kind, response)
    if (!config) {
      return
    }

    const tenantRole = tenant?.membership?.role
    if (!tenantRole) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Tenant membership required',
      })
    }

    if (!auth.user) {
      return response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    const userId = isPrivilegedTenantRole(tenantRole) ? undefined : auth.user.id

    const deleted = await authTokenService.revokeToken({
      tenantId: tenant!.id,
      pluginId: pluginId.trim(),
      tokenId: tokenId.trim(),
      kind,
      userId,
    })

    if (!deleted) {
      return response.notFound({
        error: 'NotFound',
        message: 'Token not found',
      })
    }

    response.json({
      data: { id: tokenId.trim() },
      message: 'Token revoked',
    })
  }
}

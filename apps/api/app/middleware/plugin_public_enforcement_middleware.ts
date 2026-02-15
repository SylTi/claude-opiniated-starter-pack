import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'
import { pluginRegistry } from '@saas/plugins-core'
import PluginState from '#models/plugin_state'
import { createPluginFeaturePolicyService } from '#services/plugins/plugin_feature_policy_service'

function parsePositiveInteger(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function resolveTenantIdHint(ctx: HttpContext): number | null {
  const routeParam = parsePositiveInteger(ctx.request.param('tenantId'))
  if (routeParam) {
    return routeParam
  }

  const headerValue = parsePositiveInteger(ctx.request.header('X-Tenant-ID'))
  if (headerValue) {
    return headerValue
  }

  return parsePositiveInteger(ctx.request.cookie('tenant_id'))
}

export default class PluginPublicEnforcementMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { guards?: string[]; requiredFeatures?: string[] } = {}
  ): Promise<void> {
    const pluginId = options.guards?.[0]
    if (!pluginId) {
      return ctx.response.internalServerError({
        error: 'PluginEnforcementError',
        message: 'Plugin ID not specified in middleware options',
      })
    }

    const plugin = pluginRegistry.get(pluginId)
    if (!plugin) {
      return ctx.response.notFound({
        error: 'PluginNotFound',
        message: `Plugin "${pluginId}" is not registered`,
      })
    }

    if (plugin.status === 'quarantined') {
      return ctx.response.serviceUnavailable({
        error: 'PluginQuarantined',
        message: `Plugin "${pluginId}" is currently unavailable`,
      })
    }

    if (plugin.status !== 'active') {
      return ctx.response.serviceUnavailable({
        error: 'PluginNotActive',
        message: `Plugin "${pluginId}" is not active (status: ${plugin.status})`,
      })
    }

    const requiredFeatures = options.requiredFeatures ?? []
    const tenantId = resolveTenantIdHint(ctx)

    if (requiredFeatures.length > 0 && !tenantId) {
      return ctx.response.badRequest({
        error: 'TenantRequired',
        message: 'tenantId route parameter is required for public plugin feature checks',
      })
    }

    let pluginState: PluginState | null = null
    if (tenantId) {
      try {
        pluginState = await db.transaction(async (trx) => {
          await trx.rawQuery("SELECT set_config('app.user_id', '0', true)")
          await trx.rawQuery("SELECT set_config('app.tenant_id', ?, true)", [String(tenantId)])

          return PluginState.query({ client: trx })
            .where('tenant_id', tenantId)
            .where('plugin_id', pluginId)
            .first()
        })
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('relation "plugin_states" does not exist')
        ) {
          return ctx.response.forbidden({
            error: 'PluginDisabled',
            message: `Plugin "${pluginId}" is not enabled for this tenant`,
          })
        }
        throw error
      }

      if (!pluginState || !pluginState.enabled) {
        return ctx.response.forbidden({
          error: 'PluginDisabled',
          message: `Plugin "${pluginId}" is not enabled for this tenant`,
        })
      }

      ctx.plugin = {
        id: pluginId,
        manifest: plugin.manifest,
        state: pluginState,
        grantedCapabilities: plugin.grantedCapabilities,
      }
    }

    if (requiredFeatures.length > 0) {
      const featurePolicy = createPluginFeaturePolicyService({
        pluginId,
        manifest: plugin.manifest,
      })

      for (const featureId of requiredFeatures) {
        const isEnabled = await featurePolicy.has(featureId, ctx)
        if (!isEnabled) {
          return ctx.response.forbidden({
            error: 'E_FEATURE_DISABLED',
            message: `Feature ${featureId} is disabled for this tenant`,
          })
        }
      }
    }

    await next()
  }
}

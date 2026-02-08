/**
 * Plugin Enforcement Middleware
 *
 * Enforces that:
 * 1. The plugin exists and is active (not quarantined)
 * 2. The plugin is enabled for the current tenant
 *
 * Note: Capability enforcement happens at boot time via CapabilityEnforcer.
 * This middleware only checks plugin status and tenant enablement at runtime.
 *
 * Must be used AFTER auth and tenant middleware.
 */

import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { pluginRegistry } from '@saas/plugins-core'
import PluginState from '#models/plugin_state'
import { createPluginFeaturePolicyService } from '#services/plugins/plugin_feature_policy_service'

/**
 * Plugin Enforcement Middleware.
 *
 * Usage in routes: pluginEnforcement:pluginId
 */
export default class PluginEnforcementMiddleware {
  /**
   * Handle the request.
   *
   * @param ctx - The HTTP context
   * @param next - Next middleware function
   * @param options - Middleware options (pluginId)
   */
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { guards?: string[]; requiredFeatures?: string[] } = {}
  ): Promise<void> {
    // Extract pluginId from options
    const pluginId = options.guards?.[0]

    if (!pluginId) {
      return ctx.response.internalServerError({
        error: 'PluginEnforcementError',
        message: 'Plugin ID not specified in middleware options',
      })
    }

    // 1. Check if plugin exists in registry
    const plugin = pluginRegistry.get(pluginId)
    if (!plugin) {
      return ctx.response.notFound({
        error: 'PluginNotFound',
        message: `Plugin "${pluginId}" is not registered`,
      })
    }

    // 2. Check if plugin is active (not quarantined)
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

    // 3. Check if plugin is enabled for tenant
    const tenantId = ctx.tenant?.id
    if (!tenantId) {
      return ctx.response.badRequest({
        error: 'TenantRequired',
        message: 'Tenant context is required for plugin routes',
      })
    }

    // Query plugin state for this tenant
    const tenantDb = ctx.tenantDb
    if (!tenantDb) {
      return ctx.response.internalServerError({
        error: 'DatabaseError',
        message: 'Tenant database context not available',
      })
    }

    try {
      const pluginState = await PluginState.query({ client: tenantDb })
        .where('tenant_id', tenantId)
        .where('plugin_id', pluginId)
        .first()

      if (!pluginState || !pluginState.enabled) {
        return ctx.response.forbidden({
          error: 'PluginDisabled',
          message: `Plugin "${pluginId}" is not enabled for this tenant`,
        })
      }

      // 4. Attach plugin context to request
      ctx.plugin = {
        id: pluginId,
        manifest: plugin.manifest,
        state: pluginState,
        grantedCapabilities: plugin.grantedCapabilities,
      }

      const requiredFeatures = options.requiredFeatures ?? []
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
    } catch (error) {
      // Handle case where plugin_states table doesn't exist yet
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
  }
}

/**
 * Type augmentation for HttpContext to include plugin information.
 */
declare module '@adonisjs/core/http' {
  interface HttpContext {
    plugin?: {
      id: string
      manifest: import('@saas/plugins-core').PluginManifest
      state: InstanceType<typeof PluginState>
      grantedCapabilities: string[]
    }
  }
}

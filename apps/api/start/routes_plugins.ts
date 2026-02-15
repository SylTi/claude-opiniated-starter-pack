/**
 * Plugin Routes
 *
 * This file initializes plugin routes at application startup.
 * It's imported by start/routes.ts with error handling.
 */

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { pluginRegistry, type PluginRuntimeState } from '@saas/plugins-core'
import PluginState from '#models/plugin_state'
import { updatePluginConfigValidator, validatePluginConfigSize } from '#validators/plugin'
import { apiThrottle } from '#start/limiter'
import { TENANT_ROLES } from '#constants/roles'
import { redactSensitiveConfig } from '#services/plugins/config_redaction'

/**
 * Check if user has plugin management permission.
 * Only owner and admin roles can manage plugins.
 */
function canManagePlugins(role: string): boolean {
  return role === TENANT_ROLES.OWNER || role === TENANT_ROLES.ADMIN
}

/**
 * Plugin management routes (for managing plugin enable/disable per tenant).
 * These routes are part of the core application, not plugin-specific.
 */
router
  .group(() => {
    // List available plugins
    router.get('/', async ({ response }) => {
      const plugins = pluginRegistry.getAll()
      const data = plugins.map((p: PluginRuntimeState) => ({
        pluginId: p.manifest.pluginId,
        displayName: p.manifest.displayName,
        description: p.manifest.description,
        version: p.manifest.version,
        tier: p.manifest.tier,
        status: p.status,
      }))
      return response.json({ data })
    })

    // Get plugin status for current tenant
    router.get('/:pluginId/status', async ({ params, tenant, tenantDb, response }) => {
      const pluginId = params.pluginId

      // Check if plugin exists
      const plugin = pluginRegistry.get(pluginId)
      if (!plugin) {
        return response.notFound({
          error: 'PluginNotFound',
          message: `Plugin "${pluginId}" is not registered`,
        })
      }

      // Get tenant-specific state
      const state = await PluginState.query({ client: tenantDb })
        .where('tenant_id', tenant!.id)
        .where('plugin_id', pluginId)
        .first()

      const canViewConfig = canManagePlugins(tenant!.membership.role)
      return response.json({
        data: {
          pluginId,
          enabled: state?.enabled ?? false,
          version: plugin.manifest.version,
          installedAt: state?.installedAt,
          config: canViewConfig ? redactSensitiveConfig(state?.config) : undefined,
        },
      })
    })

    // Enable plugin for tenant (requires owner/admin role)
    router.post('/:pluginId/enable', async ({ params, tenant, tenantDb, response }) => {
      // Authorization: Only owner/admin can enable plugins
      if (!canManagePlugins(tenant!.membership.role)) {
        return response.forbidden({
          error: 'Forbidden',
          message: 'Only tenant owners and admins can manage plugins',
        })
      }

      const pluginId = params.pluginId

      // Check if plugin exists
      const plugin = pluginRegistry.get(pluginId)
      if (!plugin) {
        return response.notFound({
          error: 'PluginNotFound',
          message: `Plugin "${pluginId}" is not registered`,
        })
      }

      // Check if plugin is active
      if (plugin.status !== 'active') {
        return response.badRequest({
          error: 'PluginNotActive',
          message: `Plugin "${pluginId}" is not active (status: ${plugin.status})`,
        })
      }

      // Upsert plugin state
      const now = new Date()
      await tenantDb!.rawQuery(
        `
        INSERT INTO plugin_states (tenant_id, plugin_id, version, enabled, installed_at, updated_at)
        VALUES (?, ?, ?, true, ?, ?)
        ON CONFLICT (tenant_id, plugin_id) DO UPDATE SET
          enabled = true,
          version = EXCLUDED.version,
          updated_at = EXCLUDED.updated_at
        `,
        [tenant!.id, pluginId, plugin.manifest.version, now, now]
      )

      return response.json({
        data: {
          pluginId,
          enabled: true,
          message: `Plugin "${pluginId}" enabled successfully`,
        },
      })
    })

    // Disable plugin for tenant (requires owner/admin role)
    router.post('/:pluginId/disable', async ({ params, tenant, tenantDb, response }) => {
      // Authorization: Only owner/admin can disable plugins
      if (!canManagePlugins(tenant!.membership.role)) {
        return response.forbidden({
          error: 'Forbidden',
          message: 'Only tenant owners and admins can manage plugins',
        })
      }

      const pluginId = params.pluginId

      // Check if plugin exists
      const plugin = pluginRegistry.get(pluginId)
      if (!plugin) {
        return response.notFound({
          error: 'PluginNotFound',
          message: `Plugin "${pluginId}" is not registered`,
        })
      }

      // Update plugin state
      await PluginState.query({ client: tenantDb })
        .where('tenant_id', tenant!.id)
        .where('plugin_id', pluginId)
        .update({ enabled: false, updatedAt: new Date() })

      return response.json({
        data: {
          pluginId,
          enabled: false,
          message: `Plugin "${pluginId}" disabled successfully`,
        },
      })
    })

    // Update plugin config (requires owner/admin role)
    router.put('/:pluginId/config', async ({ params, request, tenant, tenantDb, response }) => {
      // Authorization: Only owner/admin can update plugin config
      if (!canManagePlugins(tenant!.membership.role)) {
        return response.forbidden({
          error: 'Forbidden',
          message: 'Only tenant owners and admins can manage plugins',
        })
      }

      const pluginId = params.pluginId

      // Validate config is a valid object
      const config = await request.validateUsing(updatePluginConfigValidator)

      // Enforce size limits to prevent abuse
      try {
        validatePluginConfigSize(config)
      } catch (error) {
        return response.unprocessableEntity({
          error: 'ValidationError',
          message: error instanceof Error ? error.message : 'Config size exceeds limit',
        })
      }

      // Check if plugin exists and is enabled
      const state = await PluginState.query({ client: tenantDb })
        .where('tenant_id', tenant!.id)
        .where('plugin_id', pluginId)
        .first()

      if (!state) {
        return response.notFound({
          error: 'PluginNotInstalled',
          message: `Plugin "${pluginId}" is not installed for this tenant`,
        })
      }

      // Update config
      state.config = config
      state.updatedAt = new Date() as unknown as import('luxon').DateTime
      await state.useTransaction(tenantDb!).save()

      return response.json({
        data: {
          pluginId,
          config: redactSensitiveConfig(state.config),
          message: 'Plugin config updated successfully',
        },
      })
    })
  })
  .prefix('/api/v1/plugins')
  .use([middleware.auth(), middleware.tenant(), apiThrottle])

/**
 * Mount plugin routes.
 * This is called after all plugins have been registered.
 * Note: The actual mounting happens in plugin_boot_service.
 */
export async function mountPluginRoutes(): Promise<void> {
  console.log('[routes_plugins] Plugin routes initialized')
  // Routes are mounted by plugin_boot_service via pluginRouteMounter
}

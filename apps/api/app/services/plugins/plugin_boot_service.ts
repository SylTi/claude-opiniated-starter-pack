/**
 * Plugin Boot Service
 *
 * Boot-time reconciliation of plugins.
 * Handles plugin discovery, validation, capability granting, and quarantine.
 *
 * CRITICAL: Plugin failures are isolated - one plugin failing does not crash the app.
 */

import type { PluginManifest } from '@saas/plugins-core'
import { pluginRegistry, capabilityEnforcer, hookRegistry } from '@saas/plugins-core'
import { serverPluginLoaders, loadAllPluginManifests } from '@saas/config/plugins/server'
import { pluginSchemaChecker } from './plugin_schema_checker.js'
import { pluginRouteMounter } from './plugin_route_mounter.js'
import { namespaceRegistry } from '#services/authz/namespace_registry'
import { auditEventEmitter } from '#services/audit_event_emitter'
import { AUDIT_EVENT_TYPES } from '@saas/shared'
import type { AuthzResolver } from '@saas/shared'

/**
 * Plugin boot result.
 */
export interface PluginBootResult {
  success: boolean
  total: number
  active: string[]
  quarantined: Array<{ pluginId: string; error: string }>
  disabled: string[]
  warnings: string[]
}

/**
 * Plugin Boot Service.
 */
export default class PluginBootService {
  /**
   * Boot all registered plugins.
   * This is called during application startup.
   *
   * @throws {PluginSchemaMismatchError} If any plugin schema is behind (FATAL)
   */
  async boot(): Promise<PluginBootResult> {
    const result: PluginBootResult = {
      success: true,
      total: 0,
      active: [],
      quarantined: [],
      disabled: [],
      warnings: [],
    }

    // 1. Load all manifests
    console.log('[PluginBootService] Loading plugin manifests...')
    const manifests = await loadAllPluginManifests()
    result.total = manifests.size

    if (manifests.size === 0) {
      console.log('[PluginBootService] No plugins found')
      return result
    }

    // 2. Register all plugins
    console.log('[PluginBootService] Registering plugins...')
    const registeredManifests: PluginManifest[] = []

    for (const [pluginId, manifest] of manifests) {
      try {
        const regResult = pluginRegistry.register(manifest)
        if (!regResult.success) {
          result.quarantined.push({
            pluginId,
            error: regResult.errors.join('; '),
          })
          continue
        }
        registeredManifests.push(manifest)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.quarantined.push({ pluginId, error: errorMessage })
      }
    }

    // 3. Check schema compatibility (FATAL on mismatch)
    console.log('[PluginBootService] Checking schema compatibility...')
    const tierBPlugins = registeredManifests.filter((m) => m.tier === 'B' && m.migrations)
    await pluginSchemaChecker.checkCompatibility(tierBPlugins)

    // 4. Grant capabilities
    console.log('[PluginBootService] Granting capabilities...')
    for (const manifest of registeredManifests) {
      try {
        await this.grantCapabilities(manifest)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        pluginRegistry.quarantine(manifest.pluginId, errorMessage)
        result.quarantined.push({
          pluginId: manifest.pluginId,
          error: errorMessage,
        })
      }
    }

    // 5. Register hooks
    console.log('[PluginBootService] Registering hooks...')
    for (const manifest of registeredManifests) {
      const plugin = pluginRegistry.get(manifest.pluginId)
      if (plugin?.status !== 'quarantined') {
        try {
          await this.registerHooks(manifest)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          pluginRegistry.quarantine(manifest.pluginId, errorMessage)
          result.quarantined.push({
            pluginId: manifest.pluginId,
            error: errorMessage,
          })
        }
      }
    }

    // 6. Register authz resolvers (Tier B only)
    console.log('[PluginBootService] Registering authz resolvers...')
    for (const manifest of registeredManifests) {
      const plugin = pluginRegistry.get(manifest.pluginId)
      if (plugin?.status !== 'quarantined' && manifest.tier === 'B' && manifest.authzNamespace) {
        try {
          await this.registerAuthzResolver(manifest)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          pluginRegistry.quarantine(manifest.pluginId, errorMessage)
          result.quarantined.push({
            pluginId: manifest.pluginId,
            error: errorMessage,
          })
        }
      }
    }

    // 7. Mark plugins as active (route mounting happens in preload phase)
    // Note: Route mounting is deferred to start/plugin_routes_mount.ts preload
    // because it requires named middleware from kernel.ts which isn't loaded yet during boot
    console.log(
      '[PluginBootService] Marking plugins as active (routes will be mounted in preload)...'
    )

    // 8. Mark remaining plugins as active
    for (const manifest of registeredManifests) {
      const plugin = pluginRegistry.get(manifest.pluginId)
      if (plugin?.status !== 'quarantined') {
        pluginRegistry.setStatus(manifest.pluginId, 'active')
        result.active.push(manifest.pluginId)
      }
    }

    // 9. Emit boot events
    await this.emitBootEvents(result)

    console.log(
      `[PluginBootService] Boot complete: ${result.active.length} active, ${result.quarantined.length} quarantined`
    )

    return result
  }

  /**
   * Grant capabilities to a plugin.
   */
  private async grantCapabilities(manifest: PluginManifest): Promise<void> {
    const decision = capabilityEnforcer.decideGrants(manifest)

    if (decision.denied.length > 0) {
      console.warn(
        `[PluginBootService] Denied capabilities for ${manifest.pluginId}:`,
        decision.denied
      )
    }

    pluginRegistry.grantCapabilities(manifest.pluginId, decision.granted)
  }

  /**
   * Register hooks declared in manifest.
   */
  private async registerHooks(manifest: PluginManifest): Promise<void> {
    if (!manifest.hooks || manifest.hooks.length === 0) {
      return
    }

    // Load plugin module to get hook handlers
    const loader = serverPluginLoaders[manifest.pluginId]
    if (!loader) {
      return
    }

    const pluginModule = await loader()

    for (const hookReg of manifest.hooks) {
      // Get handler function from plugin module
      const handler = (pluginModule as Record<string, unknown>)[hookReg.handler]
      if (typeof handler !== 'function') {
        console.warn(
          `[PluginBootService] Hook handler "${hookReg.handler}" not found in plugin "${manifest.pluginId}"`
        )
        continue
      }

      // Determine if it's a filter or action based on hook name
      const isFilter =
        hookReg.hook.includes(':') ||
        hookReg.hook.startsWith('nav:') ||
        hookReg.hook.startsWith('dashboard:')

      if (isFilter) {
        hookRegistry.addFilter(
          hookReg.hook,
          manifest.pluginId,
          handler as (data: unknown) => unknown,
          {
            priority: hookReg.priority,
          }
        )
      } else {
        hookRegistry.addAction(
          hookReg.hook,
          manifest.pluginId,
          handler as (data: unknown) => void,
          {
            priority: hookReg.priority,
          }
        )
      }
    }
  }

  /**
   * Register authz resolver for a plugin namespace.
   */
  private async registerAuthzResolver(manifest: PluginManifest): Promise<void> {
    if (!manifest.authzNamespace) {
      return
    }

    // Security: Plugin MUST have app:authz capability to register an authz resolver
    const plugin = pluginRegistry.get(manifest.pluginId)
    if (!plugin || !plugin.grantedCapabilities.includes('app:authz')) {
      console.warn(
        `[PluginBootService] Plugin "${manifest.pluginId}" declares authzNamespace but lacks app:authz capability. Skipping authz resolver registration.`
      )
      return
    }

    // Load plugin module to get resolver
    const loader = serverPluginLoaders[manifest.pluginId]
    if (!loader) {
      return
    }

    const pluginModule = await loader()

    // Look for authzResolver export
    const resolver = (pluginModule as Record<string, unknown>).authzResolver as
      | AuthzResolver
      | undefined
    if (!resolver || typeof resolver !== 'function') {
      console.warn(
        `[PluginBootService] No authzResolver export found in plugin "${manifest.pluginId}"`
      )
      return
    }

    // Register the namespace
    namespaceRegistry.register(manifest.pluginId, manifest.authzNamespace, resolver)
    console.log(
      `[PluginBootService] Registered authz namespace "${manifest.authzNamespace}" for plugin "${manifest.pluginId}"`
    )
  }

  /**
   * Emit audit events for boot results.
   */
  private async emitBootEvents(result: PluginBootResult): Promise<void> {
    // Emit boot event for active plugins
    for (const pluginId of result.active) {
      try {
        await auditEventEmitter.emit({
          tenantId: null, // System event
          type: AUDIT_EVENT_TYPES.PLUGIN_BOOT,
          actor: { type: 'system', id: null },
          resource: { type: 'plugin', id: pluginId },
          meta: { status: 'active' },
        })
      } catch {
        // Ignore audit failures during boot
      }
    }

    // Emit quarantine events
    for (const { pluginId, error } of result.quarantined) {
      try {
        await auditEventEmitter.emit({
          tenantId: null, // System event
          type: AUDIT_EVENT_TYPES.PLUGIN_QUARANTINE,
          actor: { type: 'system', id: null },
          resource: { type: 'plugin', id: pluginId },
          meta: { reason: error },
        })
      } catch {
        // Ignore audit failures during boot
      }
    }
  }

  /**
   * Get boot status summary.
   */
  getStatus(): {
    booted: boolean
    stats: ReturnType<typeof pluginRegistry.getStats>
  } {
    return {
      booted: pluginRegistry.getActive().length > 0 || pluginRegistry.getQuarantined().length > 0,
      stats: pluginRegistry.getStats(),
    }
  }

  /**
   * Mount routes for all active Tier B plugins.
   * This is called from a preload file AFTER kernel.ts is loaded,
   * so that named middleware like 'pluginEnforcement' are available.
   */
  async mountRoutes(): Promise<{ mounted: number; warnings: string[] }> {
    const warnings: string[] = []
    let mounted = 0

    console.log('[PluginBootService] Mounting plugin routes...')

    const activePlugins = pluginRegistry.getActive()
    const tierBPlugins = activePlugins.filter((p) => p.manifest.tier === 'B')

    for (const plugin of tierBPlugins) {
      try {
        const mountResult = await pluginRouteMounter.mountPlugin(plugin.manifest)
        if (mountResult.success) {
          mounted++
        } else if (mountResult.error) {
          warnings.push(`Route mount warning for ${plugin.manifest.pluginId}: ${mountResult.error}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        warnings.push(`Route mount error for ${plugin.manifest.pluginId}: ${errorMessage}`)
      }
    }

    console.log(`[PluginBootService] Mounted routes for ${mounted} plugins`)

    return { mounted, warnings }
  }
}

/**
 * Global boot service instance.
 */
export const pluginBootService = new PluginBootService()

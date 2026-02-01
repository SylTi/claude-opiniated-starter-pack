/**
 * Plugin Route Mounter
 *
 * Dynamically mounts plugin routes using the routes registrar facade.
 * Handles route loading and error isolation.
 */

import type { PluginManifest } from '@saas/plugins-core'
import { pluginRegistry } from '@saas/plugins-core'
import app from '@adonisjs/core/services/app'
import { serverPluginLoaders } from '@saas/config/plugins/server'
import { RoutesRegistrar, createRoutesRegistrar } from './routes_registrar.js'
import { pluginCapabilityService } from './plugin_capability_service.js'

/**
 * Get the router instance from the app container.
 * This ensures we get the router after it's properly initialized.
 */
async function getRouter() {
  return app.container.make('router')
}

/**
 * Route mount result.
 */
export interface RouteMountResult {
  pluginId: string
  success: boolean
  routeCount: number
  error?: string
}

/**
 * Plugin Route Mounter Service.
 */
export default class PluginRouteMounter {
  private mountedPlugins: Set<string> = new Set()
  private registrars: Map<string, RoutesRegistrar> = new Map()

  /**
   * Mount routes for a single plugin.
   */
  async mountPlugin(manifest: PluginManifest): Promise<RouteMountResult> {
    const pluginId = manifest.pluginId

    // Skip if already mounted
    if (this.mountedPlugins.has(pluginId)) {
      return {
        pluginId,
        success: true,
        routeCount: 0,
        error: 'Already mounted',
      }
    }

    // Check if plugin can register routes
    if (!pluginCapabilityService.canRegisterRoutes(pluginId)) {
      return {
        pluginId,
        success: false,
        routeCount: 0,
        error: 'Plugin does not have app:routes capability',
      }
    }

    // Get plugin loader
    const loader = serverPluginLoaders[pluginId]
    if (!loader) {
      return {
        pluginId,
        success: false,
        routeCount: 0,
        error: `No server loader found for plugin "${pluginId}"`,
      }
    }

    try {
      // Load plugin module
      const pluginModule = await loader()

      // Validate and enforce route prefix
      // Security: Plugins MUST use /api/v1/apps/{pluginId} or /api/v1/apps/{pluginId}/* pattern
      const basePrefix = `/api/v1/apps/${pluginId}`
      const declaredPrefix = manifest.routePrefix

      // Determine the prefix to use:
      // 1. If no declared prefix → use base prefix
      // 2. If declared prefix is exact match → use it
      // 3. If declared prefix is valid subpath → use it
      // 4. If declared prefix is invalid → warn and use base prefix
      let prefix: string
      if (!declaredPrefix) {
        prefix = basePrefix
      } else if (declaredPrefix === basePrefix) {
        prefix = declaredPrefix
      } else if (declaredPrefix.startsWith(basePrefix + '/')) {
        // Valid subpath (e.g., /api/v1/apps/notes/v2)
        prefix = declaredPrefix
      } else {
        // Invalid prefix - doesn't start with the required base
        console.warn(
          `[PluginRouteMounter] Plugin "${pluginId}" declared invalid routePrefix "${declaredPrefix}". ` +
            `Must be "${basePrefix}" or start with "${basePrefix}/". Using default.`
        )
        prefix = basePrefix
      }
      const routerInstance = await getRouter()
      const registrar = createRoutesRegistrar(pluginId, routerInstance, prefix)
      this.registrars.set(pluginId, registrar)

      // Call plugin's register function if it exists
      if (typeof pluginModule.register === 'function') {
        await pluginModule.register({
          routes: registrar,
          pluginId,
          manifest,
        })
      }

      // Mark as mounted
      this.mountedPlugins.add(pluginId)

      const routeCount = registrar.getRegisteredRoutes().length
      console.log(`[PluginRouteMounter] Mounted ${routeCount} routes for plugin "${pluginId}"`)

      return {
        pluginId,
        success: true,
        routeCount,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[PluginRouteMounter] Failed to mount routes for "${pluginId}":`, error)

      return {
        pluginId,
        success: false,
        routeCount: 0,
        error: errorMessage,
      }
    }
  }

  /**
   * Mount routes for all active Tier B plugins.
   */
  async mountPluginRoutes(): Promise<RouteMountResult[]> {
    const results: RouteMountResult[] = []

    // Get all active Tier B plugins
    const activePlugins = pluginRegistry.getActive().filter((p) => p.manifest.tier === 'B')

    for (const plugin of activePlugins) {
      const result = await this.mountPlugin(plugin.manifest)
      results.push(result)
    }

    return results
  }

  /**
   * Get the registrar for a plugin.
   */
  getRegistrar(pluginId: string): RoutesRegistrar | undefined {
    return this.registrars.get(pluginId)
  }

  /**
   * Check if a plugin's routes are mounted.
   */
  isMounted(pluginId: string): boolean {
    return this.mountedPlugins.has(pluginId)
  }

  /**
   * Get all mounted plugin IDs.
   */
  getMountedPlugins(): string[] {
    return Array.from(this.mountedPlugins)
  }

  /**
   * Get all registered routes across all plugins.
   */
  getAllRoutes(): Array<{ pluginId: string; method: string; path: string }> {
    const routes: Array<{ pluginId: string; method: string; path: string }> = []

    for (const [pluginId, registrar] of this.registrars) {
      for (const route of registrar.getRegisteredRoutes()) {
        routes.push({
          pluginId,
          method: route.method,
          path: route.fullPath,
        })
      }
    }

    return routes
  }

  /**
   * Clear all mounted routes. Used for testing.
   */
  clear(): void {
    this.mountedPlugins.clear()
    this.registrars.clear()
  }
}

/**
 * Global route mounter instance.
 */
export const pluginRouteMounter = new PluginRouteMounter()

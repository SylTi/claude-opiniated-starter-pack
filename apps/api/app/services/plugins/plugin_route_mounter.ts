/**
 * Plugin Route Mounter
 *
 * Dynamically mounts plugin routes using the routes registrar facade.
 * Handles route loading and error isolation.
 */

import type { PluginManifest } from '@saas/plugins-core'
import { pluginRegistry, hookRegistry } from '@saas/plugins-core'
import app from '@adonisjs/core/services/app'
import { serverPluginLoaders } from '@saas/config/plugins/server'
import { RoutesRegistrar, createRoutesRegistrar } from './routes_registrar.js'
import { pluginCapabilityService } from './plugin_capability_service.js'
import { createCoreFacadeFactory } from './core_facade_factory.js'
import { createPluginFeaturePolicyService } from './plugin_feature_policy_service.js'
import { authzService } from '#services/authz/authz_service'
import { auditEventEmitter } from '#services/audit_event_emitter'
import {
  authTokenService,
  type AuthTokenRecordDTO,
  type ValidateAuthTokenResult,
} from '#services/auth_tokens/auth_token_service'
import { AUDIT_EVENT_TYPES } from '@saas/shared'

/**
 * Create hooks registry adapter for plugin registration.
 * Wraps the global hookRegistry for the specific plugin.
 */
function createHooksAdapter(pluginId: string) {
  return {
    registerAction: (
      hook: string,
      handler: (...args: unknown[]) => void | Promise<void>,
      priority?: number
    ) => {
      return hookRegistry.addAction(
        hook,
        pluginId,
        handler,
        priority !== undefined ? { priority } : undefined
      )
    },
    registerFilter: (
      hook: string,
      handler: (value: unknown, ...args: unknown[]) => unknown | Promise<unknown>,
      priority?: number
    ) => {
      return hookRegistry.addFilter(
        hook,
        pluginId,
        handler as (data: unknown) => unknown,
        priority !== undefined ? { priority } : undefined
      )
    },
  }
}

/**
 * Create entitlements service adapter for plugin registration.
 * Checks plugin capabilities at runtime.
 */
function createEntitlementsAdapter(pluginId: string) {
  return {
    has: (capability: string, ctx: { plugin?: { grantedCapabilities?: string[] } }): boolean => {
      // Check if capability is in the granted list
      const granted = ctx.plugin?.grantedCapabilities ?? []
      return granted.includes(capability)
    },
    require: (capability: string, ctx: { plugin?: { grantedCapabilities?: string[] } }): void => {
      const granted = ctx.plugin?.grantedCapabilities ?? []
      if (!granted.includes(capability)) {
        throw new Error(
          `Plugin "${pluginId}" requires capability "${capability}" but it was not granted`
        )
      }
    },
  }
}

/**
 * Create audit service adapter for plugin registration.
 * Wraps the global audit event emitter.
 */
function createAuditAdapter(pluginId: string) {
  return {
    record: async (event: {
      action: string
      resourceType: string
      resourceId?: string | number
      metadata?: Record<string, unknown>
    }): Promise<void> => {
      await auditEventEmitter.emit({
        tenantId: null, // Will be filled from context in actual handlers
        type: AUDIT_EVENT_TYPES.PLUGIN_CUSTOM,
        actor: { type: 'plugin', id: pluginId },
        resource: {
          type: event.resourceType,
          id: event.resourceId?.toString() ?? '',
        },
        meta: {
          action: event.action,
          ...(event.metadata ?? {}),
        },
      })
    },
  }
}

/**
 * Create auth-token adapter for a plugin.
 * Plugins receive a plugin-scoped contract, never direct DB access to token internals.
 */
function createAuthTokensAdapter(pluginId: string) {
  return {
    listTokens: (input: {
      tenantId: number
      kind?: string
      userId?: number
    }): Promise<AuthTokenRecordDTO[]> => {
      return authTokenService.listTokens({
        tenantId: input.tenantId,
        pluginId,
        kind: input.kind,
        userId: input.userId,
      })
    },
    createToken: (input: {
      tenantId: number
      userId: number
      kind: string
      name: string
      scopes: string[]
      expiresAt?: string | null
      metadata?: Record<string, unknown> | null
    }) => {
      return authTokenService.createToken({
        tenantId: input.tenantId,
        userId: input.userId,
        pluginId,
        kind: input.kind,
        name: input.name,
        scopes: input.scopes,
        expiresAt: input.expiresAt,
        metadata: input.metadata,
      })
    },
    revokeToken: (input: { tenantId: number; tokenId: string; kind?: string; userId?: number }) => {
      return authTokenService.revokeToken({
        tenantId: input.tenantId,
        pluginId,
        tokenId: input.tokenId,
        kind: input.kind,
        userId: input.userId,
      })
    },
    validateToken: (input: {
      tokenValue: string
      kind?: string
      requiredScopes?: string[]
    }): Promise<ValidateAuthTokenResult> => {
      return authTokenService.validateToken({
        pluginId,
        tokenValue: input.tokenValue,
        kind: input.kind,
        requiredScopes: input.requiredScopes,
      })
    },
  }
}

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

      // Per spec §5.2: ALL plugins (including main-app) register routes under /api/v1/apps/{pluginId}
      // Main-app's server module is Tier B and MUST follow all Tier B rules (spec §1.3)
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
      const registrar = createRoutesRegistrar(pluginId, routerInstance, prefix, manifest)
      this.registrars.set(pluginId, registrar)

      // Call plugin's register function if it exists
      if (typeof pluginModule.register === 'function') {
        // Create adapters for the full plugin context
        const hooks = createHooksAdapter(pluginId)
        const entitlements = createEntitlementsAdapter(pluginId)
        const audit = createAuditAdapter(pluginId)
        const authTokens = createAuthTokensAdapter(pluginId)
        const pluginState = pluginRegistry.get(pluginId)
        const deploymentGrantedCoreCapabilities = new Set(
          pluginState?.deploymentGrantedCoreCapabilities ?? []
        )
        const core =
          manifest.tier === 'C' && deploymentGrantedCoreCapabilities.size > 0
            ? createCoreFacadeFactory({
                pluginId,
                manifest,
                deploymentGrantedCapabilities: deploymentGrantedCoreCapabilities,
              })
            : null
        const featurePolicy = createPluginFeaturePolicyService({
          pluginId,
          manifest,
        })

        await pluginModule.register({
          routes: registrar,
          hooks,
          entitlements,
          audit,
          authTokens,
          authz: authzService,
          db: null,
          jobs: {
            register: (_name: string, _handler: (payload: unknown) => Promise<void> | void) => {
              console.warn(
                `[PluginRouteMounter] Plugin "${pluginId}" attempted to register a background job, but jobs runtime is not wired yet.`
              )
            },
          },
          featurePolicy,
          core,
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
   * Mount routes for all active plugins that can register routes.
   * Per spec §1.3: Tier B, Tier C, and main-app plugins can have routes.
   */
  async mountPluginRoutes(): Promise<RouteMountResult[]> {
    const results: RouteMountResult[] = []

    // Get all active plugins that can have routes (Tier B, Tier C, and main-app)
    // Per spec §1.3: Main App may contain design module + optional Tier B server module
    const activePlugins = pluginRegistry
      .getActive()
      .filter(
        (p) => p.manifest.tier === 'B' || p.manifest.tier === 'C' || p.manifest.tier === 'main-app'
      )

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

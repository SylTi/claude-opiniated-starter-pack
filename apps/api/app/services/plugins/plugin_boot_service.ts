/**
 * Plugin Boot Service
 *
 * Boot-time reconciliation of plugins.
 * Handles plugin discovery, validation, capability granting, and quarantine.
 *
 * CRITICAL: Plugin failures are isolated - one plugin failing does not crash the app.
 */

import type { PluginManifest, AppDesign, NavContext } from '@saas/plugins-core'
import {
  pluginRegistry,
  capabilityEnforcer,
  hookRegistry,
  designRegistry,
  isAppDesign,
  validateThemeTokens,
  assertNoIdCollisions,
  buildNavModel,
  FILTER_HOOKS,
  ACTION_HOOKS,
} from '@saas/plugins-core'
import { serverPluginLoaders, loadAllPluginManifests } from '@saas/config/plugins/server'
import { pluginSchemaChecker } from './plugin_schema_checker.js'
import { pluginRouteMounter } from './plugin_route_mounter.js'
import { namespaceRegistry } from '#services/authz/namespace_registry'
import { auditEventEmitter } from '#services/audit_event_emitter'
import { AUDIT_EVENT_TYPES } from '@saas/shared'
import type { AuthzResolver } from '@saas/shared'

/**
 * Check if running in safe mode.
 * Safe mode disables all UI overrides (admin/auth) and all non-core plugins.
 * Per spec section 7.1: keeps auth and admin reachable.
 */
function isSafeMode(): boolean {
  return process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true'
}

/**
 * Check if running in production mode.
 * In production, spec requirements are strictly enforced.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

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

    // Check safe mode
    if (isSafeMode()) {
      console.log('[PluginBootService] SAFE MODE: Skipping main-app design registration')
      result.warnings.push('Running in safe mode - default design will be used')
    }

    // 1. Load all manifests
    console.log('[PluginBootService] Loading plugin manifests...')
    const manifests = await loadAllPluginManifests()
    result.total = manifests.size

    if (manifests.size === 0) {
      console.log('[PluginBootService] No plugins found')
      return result
    }

    // 1.5. Separate main-app plugins from others
    const mainAppManifests: PluginManifest[] = []
    const otherManifests: PluginManifest[] = []

    for (const [, manifest] of manifests) {
      if (manifest.tier === 'main-app') {
        mainAppManifests.push(manifest)
      } else {
        otherManifests.push(manifest)
      }
    }

    // Validate exactly one main-app exists (unless in safe mode)
    if (!isSafeMode()) {
      if (mainAppManifests.length === 0) {
        const message = 'No main-app plugin found. Application will use default design.'
        if (isProduction()) {
          // In production, main-app is required per spec section 1.2
          console.error(`[PluginBootService] FATAL: ${message}`)
          throw new Error(message)
        } else {
          // In development/test, allow fallback with warning
          console.warn(`[PluginBootService] ${message}`)
          result.warnings.push(message)
        }
      } else if (mainAppManifests.length > 1) {
        const error = `Multiple main-app plugins found: ${mainAppManifests.map((m) => m.pluginId).join(', ')}. Only one is allowed.`
        console.error(`[PluginBootService] FATAL: ${error}`)
        throw new Error(error)
      }
    }

    // 2. Register all plugins (main-app FIRST to ensure design is available)
    console.log('[PluginBootService] Registering plugins...')
    const registeredManifests: PluginManifest[] = []

    // Register main-app first
    for (const manifest of mainAppManifests) {
      if (isSafeMode()) {
        result.disabled.push(manifest.pluginId)
        continue
      }

      try {
        const regResult = pluginRegistry.register(manifest)
        if (!regResult.success) {
          const errorMsg = regResult.errors.join('; ')

          // In production, main-app registration failure is boot-fatal per spec §1.2
          if (isProduction()) {
            console.error(`[PluginBootService] FATAL: main-app registration failed: ${errorMsg}`)
            throw new Error(`main-app registration failed: ${errorMsg}`)
          }

          // Non-production: quarantine and continue
          result.quarantined.push({
            pluginId: manifest.pluginId,
            error: errorMsg,
          })
          continue
        }

        // Register design immediately after successful registration
        // This MUST succeed before adding to registeredManifests
        await this.registerMainAppDesign(manifest)

        // Only add to registered list AFTER design registration succeeds
        registeredManifests.push(manifest)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Quarantine in registry so it won't be activated in step 8
        pluginRegistry.quarantine(manifest.pluginId, errorMessage)
        result.quarantined.push({ pluginId: manifest.pluginId, error: errorMessage })

        // In production, main-app boot failure is boot-fatal per spec §1.2
        if (isProduction()) {
          console.error(`[PluginBootService] FATAL: main-app boot failed: ${errorMessage}`)
          throw new Error(`main-app boot failed: ${errorMessage}`)
        }
      }
    }

    // Then register other plugins (unless in safe mode)
    for (const manifest of otherManifests) {
      // Safe mode: disable ALL non-core plugins per spec section 7.1
      if (isSafeMode()) {
        console.log(`[PluginBootService] SAFE MODE: Skipping plugin "${manifest.pluginId}"`)
        result.disabled.push(manifest.pluginId)
        continue
      }

      try {
        const regResult = pluginRegistry.register(manifest)
        if (!regResult.success) {
          result.quarantined.push({
            pluginId: manifest.pluginId,
            error: regResult.errors.join('; '),
          })
          continue
        }
        registeredManifests.push(manifest)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.quarantined.push({ pluginId: manifest.pluginId, error: errorMessage })
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

    // 6.5 Validate full navigation pipeline with hooks (boot-fatal per spec §5.3)
    // This catches collisions that only appear after hooks are applied
    // Per spec: collision detection is ALWAYS boot-fatal, regardless of environment
    if (!isSafeMode() && designRegistry.has()) {
      console.log('[PluginBootService] Validating full navigation pipeline with hooks...')
      try {
        await this.validateFullNavPipeline()
        console.log('[PluginBootService] Full navigation pipeline validation passed')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[PluginBootService] FATAL: Full nav pipeline collision: ${errorMessage}`)
        // Boot-fatal in ALL environments per spec §5.3
        throw new Error(`Navigation collision detected (boot-fatal): ${errorMessage}`)
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
   * Register main-app design.
   * Called immediately after main-app plugin registration.
   *
   * Validates per spec:
   * - §2.1: AppShell is required
   * - §2.1: cssVars is required in appTokens()
   * - §5.3: Collision detection on baseline nav
   */
  private async registerMainAppDesign(manifest: PluginManifest): Promise<void> {
    if (manifest.tier !== 'main-app') {
      return
    }

    console.log(`[PluginBootService] Loading design from main-app plugin "${manifest.pluginId}"...`)

    const loader = serverPluginLoaders[manifest.pluginId]
    if (!loader) {
      throw new Error(`No loader found for main-app plugin "${manifest.pluginId}"`)
    }

    const pluginModule = await loader()

    // Look for design export
    const design = (pluginModule as Record<string, unknown>).design as AppDesign | undefined
    if (!design) {
      throw new Error(
        `Main-app plugin "${manifest.pluginId}" must export a "design" object implementing AppDesign interface`
      )
    }

    // Validate design contract (spec §2.1)
    if (!isAppDesign(design)) {
      throw new Error(
        `Main-app plugin "${manifest.pluginId}" design is invalid. ` +
          `Required: designId, displayName, appTokens(), navBaseline(), AppShell`
      )
    }

    // Validate cssVars in appTokens (spec §2.1)
    const tokens = design.appTokens()
    const tokenValidation = validateThemeTokens(tokens)
    if (!tokenValidation.valid) {
      throw new Error(
        `Main-app plugin "${manifest.pluginId}" appTokens() invalid: ${tokenValidation.errors.join('; ')}`
      )
    }

    // Validate baseline nav for collisions (spec §5.3 - boot-fatal)
    // Check multiple contexts to catch role-specific collisions
    const validationContexts = [
      {
        name: 'admin',
        context: {
          userRole: 'admin' as const,
          entitlements: new Set<string>(['admin']),
          tenantId: 'validation',
          tierLevel: 99,
          hasMultipleTenants: true,
        },
      },
      {
        name: 'user',
        context: {
          userRole: 'user' as const,
          entitlements: new Set<string>(),
          tenantId: 'validation',
          tierLevel: 1,
          hasMultipleTenants: false,
        },
      },
      {
        name: 'guest',
        context: {
          userRole: 'guest' as const,
          entitlements: new Set<string>(),
          tenantId: null,
          tierLevel: 0,
          hasMultipleTenants: false,
        },
      },
    ]

    for (const { name, context } of validationContexts) {
      try {
        const baselineNav = design.navBaseline(context)
        assertNoIdCollisions(baselineNav)
      } catch (collisionError) {
        throw new Error(
          `Main-app plugin "${manifest.pluginId}" baseline nav has ID collisions for ${name} context: ` +
            (collisionError instanceof Error ? collisionError.message : String(collisionError))
        )
      }
    }
    console.log('[PluginBootService] Baseline nav collision check passed for all contexts')

    // Register the design
    designRegistry.register(design)
    console.log(`[PluginBootService] Registered design "${design.designId}" from main-app plugin`)
  }

  /**
   * Validate full navigation pipeline with hooks.
   *
   * Per spec §5.3: Collision detection must be boot-fatal.
   * This runs buildNavModel with skipHooks: false to catch collisions
   * that only appear after hooks modify the navigation.
   *
   * Validates against a context matrix:
   * - admin + multi-tenant
   * - admin + single-tenant
   * - user + multi-tenant
   * - user + single-tenant
   * - guest
   *
   * @throws Error if any collision is detected
   */
  private async validateFullNavPipeline(): Promise<void> {
    const design = designRegistry.get()

    // Context matrix for validation
    const validationContexts: Array<{ name: string; context: NavContext }> = [
      {
        name: 'admin-multi-tenant',
        context: {
          userId: 'validation',
          userRole: 'admin',
          entitlements: new Set(['admin']),
          tenantId: 'validation-tenant',
          tierLevel: 99,
          hasMultipleTenants: true,
        },
      },
      {
        name: 'admin-single-tenant',
        context: {
          userId: 'validation',
          userRole: 'admin',
          entitlements: new Set(['admin']),
          tenantId: 'validation-tenant',
          tierLevel: 99,
          hasMultipleTenants: false,
        },
      },
      {
        name: 'user-multi-tenant',
        context: {
          userId: 'validation',
          userRole: 'user',
          entitlements: new Set(),
          tenantId: 'validation-tenant',
          tierLevel: 1,
          hasMultipleTenants: true,
        },
      },
      {
        name: 'user-single-tenant',
        context: {
          userId: 'validation',
          userRole: 'user',
          entitlements: new Set(),
          tenantId: 'validation-tenant',
          tierLevel: 1,
          hasMultipleTenants: false,
        },
      },
      {
        name: 'guest',
        context: {
          userRole: 'guest',
          entitlements: new Set(),
          tenantId: null,
          tierLevel: 0,
          hasMultipleTenants: false,
        },
      },
    ]

    const collisionErrors: string[] = []

    for (const { name, context } of validationContexts) {
      try {
        // Build with full pipeline including hooks
        // skipPermissionFilter: true - we want to check ALL items for collisions
        await buildNavModel({
          design,
          context,
          skipHooks: false, // Run hooks - this is the key difference from baseline validation
          skipPermissionFilter: true, // Check all items, not just visible ones
          skipValidation: false, // Enable collision detection
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        collisionErrors.push(`[${name}] ${errorMessage}`)
      }
    }

    if (collisionErrors.length > 0) {
      throw new Error(
        `Full pipeline collision detected in ${collisionErrors.length} context(s):\n` +
          collisionErrors.join('\n')
      )
    }
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

    // Build sets of known hook names for O(1) lookup
    const knownFilterHooks = new Set<string>(Object.values(FILTER_HOOKS))
    const knownActionHooks = new Set<string>(Object.values(ACTION_HOOKS))

    for (const hookReg of manifest.hooks) {
      // Get handler function from plugin module
      const handler = (pluginModule as Record<string, unknown>)[hookReg.handler]
      if (typeof handler !== 'function') {
        console.warn(
          `[PluginBootService] Hook handler "${hookReg.handler}" not found in plugin "${manifest.pluginId}"`
        )
        continue
      }

      // Determine if it's a filter or action based on known hook constants
      // Priority: known filter > known action > fallback to filter for UI hooks
      const isKnownFilter = knownFilterHooks.has(hookReg.hook)
      const isKnownAction = knownActionHooks.has(hookReg.hook)

      // Warn if hook is unknown (not in either constant)
      if (!isKnownFilter && !isKnownAction) {
        console.warn(
          `[PluginBootService] Unknown hook "${hookReg.hook}" from plugin "${manifest.pluginId}". ` +
            'Consider adding it to FILTER_HOOKS or ACTION_HOOKS constants.'
        )
      }

      // Classify: known action → action, everything else → filter (safer default for UI hooks)
      const isAction = isKnownAction && !isKnownFilter

      if (isAction) {
        hookRegistry.addAction(
          hookReg.hook,
          manifest.pluginId,
          handler as (data: unknown) => void,
          {
            priority: hookReg.priority,
          }
        )
      } else {
        hookRegistry.addFilter(
          hookReg.hook,
          manifest.pluginId,
          handler as (data: unknown) => unknown,
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

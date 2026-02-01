/**
 * Plugin Routes Mount
 *
 * This preload file mounts plugin routes AFTER kernel.ts is loaded.
 * This is required because plugin routes use named middleware like 'pluginEnforcement'
 * which are registered in kernel.ts.
 *
 * The AdonisJS lifecycle is:
 * 1. Provider register
 * 2. Provider boot <- plugins are registered and capabilities granted here
 * 3. Preloads (kernel.ts, then this file) <- routes are mounted here
 * 4. Ready
 *
 * If we try to mount routes during boot, the named middleware don't exist yet.
 *
 * SECURITY: This file uses top-level await to ensure routes are FULLY mounted
 * before the server starts accepting requests. This prevents race conditions
 * where requests could arrive before middleware is applied.
 */

import { pluginBootService } from '#services/plugins/plugin_boot_service'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const bootInTests = process.env.PLUGINS_BOOT_IN_TESTS === 'true'

// Skip in test environment unless explicitly enabled
if (nodeEnv !== 'test' || bootInTests) {
  // SECURITY: Use top-level await to block server start until routes are mounted
  const { mounted, warnings } = await pluginBootService.mountRoutes()

  if (warnings.length > 0) {
    console.warn('[PluginRouteMount] Warnings:', warnings)
  }

  console.log(`[PluginRouteMount] Successfully mounted routes for ${mounted} plugins`)
}

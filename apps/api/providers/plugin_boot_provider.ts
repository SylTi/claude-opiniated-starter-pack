import type { ApplicationService, LoggerService } from '@adonisjs/core/types'

/**
 * Plugin Boot Provider
 *
 * This provider runs boot-time initialization of the plugin system.
 * It loads plugin manifests, validates capabilities, and mounts routes.
 *
 * CRITICAL: Plugin failures are isolated - one plugin failing does not crash the app.
 * However, schema mismatches are FATAL and will prevent the app from starting.
 *
 * Environment Variables:
 * - PLUGINS_BOOT_IN_TESTS: Set to 'true' to run plugin boot in test environment
 *   (By default, plugin boot is skipped in tests for speed)
 */
export default class PluginBootProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Boot lifecycle hook - runs after all providers are registered.
   *
   * This is where we perform plugin initialization because:
   * 1. The database connection is available
   * 2. All models and services are registered
   * 3. We can safely exit if schema mismatch (FATAL)
   */
  async boot(): Promise<void> {
    // Skip in test environment unless explicitly enabled
    const nodeEnv = process.env.NODE_ENV ?? 'development'
    const bootInTests = process.env.PLUGINS_BOOT_IN_TESTS === 'true'

    // Get logger from container
    let logger: LoggerService | null = null
    try {
      logger = await this.app.container.make('logger')
    } catch {
      // Logger not available
    }

    if (nodeEnv === 'test' && !bootInTests) {
      // Skip silently in test mode
      return
    }

    try {
      logger?.info('Starting plugin system boot...')

      // Dynamic import to avoid circular dependencies
      const { pluginBootService } = await import('#services/plugins/plugin_boot_service')

      // Boot plugins
      const result = await pluginBootService.boot()

      if (result.quarantined.length > 0) {
        for (const { pluginId, error } of result.quarantined) {
          logger?.warn({ pluginId, error }, 'Plugin quarantined during boot')
        }
      }

      logger?.info(
        {
          active: result.active.length,
          quarantined: result.quarantined.length,
          warnings: result.warnings,
        },
        'Plugin system boot completed'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // Check if this is a schema mismatch (FATAL)
      if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = (error as { code?: string }).code
        if (errorCode === 'PLUGIN_SCHEMA_MISMATCH') {
          logger?.error({ error: message }, 'Plugin schema mismatch. Server cannot start.')
          console.error('[PLUGIN SCHEMA MISMATCH]', message)

          // Give logs time to flush before exiting
          await new Promise((resolve) => setTimeout(resolve, 100))

          // Exit with error code
          process.exit(1)
        }
      }

      // Other errors are logged but don't prevent startup
      logger?.error({ error: message }, 'Plugin system boot error (non-fatal)')
      console.error('[PLUGIN BOOT ERROR]', message)
    }
  }

  /**
   * Ready lifecycle hook - called when the application is ready to accept requests.
   */
  async ready(): Promise<void> {
    // Nothing to do here
  }

  /**
   * Shutdown lifecycle hook - called when the application is shutting down.
   */
  async shutdown(): Promise<void> {
    // Cleanup could go here (e.g., unregistering hooks)
  }
}

/**
 * Plugin Schema Checker
 *
 * Boot-time schema compatibility check.
 * FATAL if enabled plugin schema is behind expected version.
 */

import type { PluginManifest } from '@saas/plugins-core'
import { PluginSchemaMismatchError } from '#exceptions/plugin_errors'
import { getPluginSchemaVersion } from './schema_version_helper.js'

/**
 * Schema check result for a single plugin.
 */
export interface SchemaCheckResult {
  pluginId: string
  valid: boolean
  expectedVersion: number
  actualVersion: number
  error?: PluginSchemaMismatchError
}

/**
 * Plugin Schema Checker Service.
 */
export default class PluginSchemaChecker {
  /**
   * Check schema compatibility for a single plugin.
   * Returns a result object (does not throw).
   */
  async checkPlugin(manifest: PluginManifest): Promise<SchemaCheckResult> {
    const pluginId = manifest.pluginId

    // Skip plugins without migrations
    if (!manifest.migrations?.schemaVersion) {
      return {
        pluginId,
        valid: true,
        expectedVersion: 0,
        actualVersion: 0,
      }
    }

    const expectedVersion = manifest.migrations.schemaVersion
    const actualVersion = await getPluginSchemaVersion(pluginId)

    if (actualVersion < expectedVersion) {
      const error = new PluginSchemaMismatchError({
        pluginId,
        expectedVersion,
        actualVersion,
        remediation: 'Run: node ace migration:run',
      })

      return {
        pluginId,
        valid: false,
        expectedVersion,
        actualVersion,
        error,
      }
    }

    return {
      pluginId,
      valid: true,
      expectedVersion,
      actualVersion,
    }
  }

  /**
   * Check schema compatibility for all enabled plugins.
   * @throws {PluginSchemaMismatchError} If any plugin schema is behind expected version
   */
  async checkCompatibility(enabledPlugins: PluginManifest[]): Promise<void> {
    const errors: PluginSchemaMismatchError[] = []

    for (const manifest of enabledPlugins) {
      const result = await this.checkPlugin(manifest)
      if (!result.valid && result.error) {
        errors.push(result.error)
      }
    }

    if (errors.length === 1) {
      throw errors[0]
    }

    if (errors.length > 1) {
      // Combine multiple errors into one
      const pluginIds = errors.map((e) => e.pluginId).join(', ')
      const details = errors
        .map((e) => `  - ${e.pluginId}: expected v${e.expectedVersion}, found v${e.actualVersion}`)
        .join('\n')

      throw new PluginSchemaMismatchError({
        pluginId: pluginIds,
        expectedVersion: -1, // Multiple
        actualVersion: -1, // Multiple
        remediation: `Multiple plugins have schema mismatches:\n${details}\n\nRun: node ace migration:run`,
      })
    }
  }

  /**
   * Check all plugins and return results without throwing.
   */
  async checkAll(plugins: PluginManifest[]): Promise<SchemaCheckResult[]> {
    const results: SchemaCheckResult[] = []

    for (const manifest of plugins) {
      const result = await this.checkPlugin(manifest)
      results.push(result)
    }

    return results
  }

  /**
   * Get plugins that have schema mismatches.
   */
  async getMismatchedPlugins(plugins: PluginManifest[]): Promise<SchemaCheckResult[]> {
    const results = await this.checkAll(plugins)
    return results.filter((r) => !r.valid)
  }
}

/**
 * Global schema checker instance.
 */
export const pluginSchemaChecker = new PluginSchemaChecker()

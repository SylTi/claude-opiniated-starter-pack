import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { loadAllPluginManifests } from '@saas/config/plugins/server'
import { validatePluginManifest, validateCapabilitiesForTier } from '@saas/plugins-core'
import type { PluginCapability } from '@saas/plugins-core'
import db from '@adonisjs/lucid/services/db'

/**
 * Plugins Verify Command
 *
 * Validates plugin.meta.json files, checks schema versions,
 * and validates RLS policies on plugin tables.
 *
 * Usage:
 *   node ace plugins:verify           # Verify all plugins
 *   node ace plugins:verify notes     # Verify specific plugin
 *   node ace plugins:verify --strict  # Fail on any warning
 */
export default class PluginsVerify extends BaseCommand {
  static commandName = 'plugins:verify'
  static description = 'Verify plugin manifests, schema versions, and RLS policies'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Optional plugin ID to verify', required: false })
  declare pluginId?: string

  @flags.boolean({ description: 'Fail on any warning', alias: 's' })
  declare strict: boolean

  private errors: string[] = []
  private warnings: string[] = []

  async run(): Promise<void> {
    this.logger.info('Starting plugin verification...')

    // Load all manifests
    const manifests = await loadAllPluginManifests()

    if (manifests.size === 0) {
      this.logger.info('No plugins found')
      return
    }

    // Filter to specific plugin if requested
    const pluginsToVerify = this.pluginId
      ? manifests.has(this.pluginId)
        ? new Map([[this.pluginId, manifests.get(this.pluginId)!]])
        : new Map()
      : manifests

    if (this.pluginId && pluginsToVerify.size === 0) {
      this.logger.error(`Plugin "${this.pluginId}" not found`)
      this.exitCode = 1
      return
    }

    // Verify each plugin
    for (const [pluginId, manifest] of pluginsToVerify) {
      this.logger.info(`Verifying plugin: ${pluginId}`)

      // 1. Validate manifest structure
      const manifestResult = validatePluginManifest(manifest)
      if (!manifestResult.valid) {
        for (const error of manifestResult.errors) {
          this.errors.push(`[${pluginId}] Manifest: ${error}`)
        }
      }

      // 2. Validate capabilities for tier (pass pluginId for plugin-specific capabilities)
      const capabilities = manifest.requestedCapabilities.map(
        (c: { capability: string; reason: string }) => c.capability
      ) as PluginCapability[]
      const capResult = validateCapabilitiesForTier(manifest.tier, capabilities, pluginId)
      if (!capResult.valid) {
        this.errors.push(
          `[${pluginId}] Invalid capabilities for Tier ${manifest.tier}: ${capResult.invalidCapabilities.join(', ')}`
        )
      }

      // 3. Check schema version (for Tier B or main-app with migrations)
      if ((manifest.tier === 'B' || manifest.tier === 'main-app') && manifest.migrations) {
        await this.verifySchemaVersion(pluginId, manifest.migrations.schemaVersion)
      }

      // 4. Verify RLS on plugin tables (for Tier B or main-app with tables)
      if ((manifest.tier === 'B' || manifest.tier === 'main-app') && manifest.tables) {
        for (const table of manifest.tables) {
          await this.verifyTableRls(pluginId, table.name)
        }
      }
    }

    // Report results
    this.logger.info('')
    this.logger.info('=== Verification Results ===')
    this.logger.info(`Plugins verified: ${pluginsToVerify.size}`)
    this.logger.info(`Errors: ${this.errors.length}`)
    this.logger.info(`Warnings: ${this.warnings.length}`)

    if (this.errors.length > 0) {
      this.logger.info('')
      this.logger.error('Errors:')
      for (const error of this.errors) {
        this.logger.error(`  - ${error}`)
      }
    }

    if (this.warnings.length > 0) {
      this.logger.info('')
      this.logger.warning('Warnings:')
      for (const warning of this.warnings) {
        this.logger.warning(`  - ${warning}`)
      }
    }

    // Set exit code
    if (this.errors.length > 0) {
      this.exitCode = 1
    } else if (this.strict && this.warnings.length > 0) {
      this.exitCode = 1
    } else {
      this.logger.success('All plugins verified successfully')
    }
  }

  /**
   * Verify schema version matches database.
   */
  private async verifySchemaVersion(pluginId: string, expectedVersion: number): Promise<void> {
    try {
      const result = await db.rawQuery<{ rows: Array<{ schema_version: number }> }>(
        'SELECT schema_version FROM plugin_db_state WHERE plugin_id = ?',
        [pluginId]
      )

      if (result.rows.length === 0) {
        this.warnings.push(
          `[${pluginId}] No schema version recorded. Expected: ${expectedVersion}. Run migrations.`
        )
        return
      }

      const actualVersion = result.rows[0].schema_version
      if (actualVersion < expectedVersion) {
        this.errors.push(
          `[${pluginId}] Schema mismatch: expected v${expectedVersion}, found v${actualVersion}. Run migrations.`
        )
      } else if (actualVersion > expectedVersion) {
        this.warnings.push(
          `[${pluginId}] Schema version in DB (${actualVersion}) is ahead of manifest (${expectedVersion})`
        )
      }
    } catch (error) {
      // Table might not exist yet
      if (
        error instanceof Error &&
        error.message.includes('relation "plugin_db_state" does not exist')
      ) {
        this.warnings.push(`[${pluginId}] plugin_db_state table does not exist. Run migrations.`)
      } else {
        this.errors.push(`[${pluginId}] Failed to check schema version: ${error}`)
      }
    }
  }

  /**
   * Verify RLS is enabled on a plugin table.
   */
  private async verifyTableRls(pluginId: string, tableName: string): Promise<void> {
    try {
      // Check if table exists
      const tableExists = await db.rawQuery<{ rows: Array<{ exists: boolean }> }>(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = ?)`,
        [tableName]
      )

      if (!tableExists.rows[0]?.exists) {
        this.warnings.push(`[${pluginId}] Table "${tableName}" does not exist yet`)
        return
      }

      // Check RLS enabled and forced
      const rlsResult = await db.rawQuery<{
        rows: Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
      }>(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ?`, [tableName])

      if (rlsResult.rows.length === 0) {
        this.errors.push(`[${pluginId}] Could not find table "${tableName}" in pg_class`)
        return
      }

      const { relrowsecurity, relforcerowsecurity } = rlsResult.rows[0]

      if (!relrowsecurity) {
        this.errors.push(`[${pluginId}] Table "${tableName}" does not have RLS enabled`)
      }

      if (!relforcerowsecurity) {
        this.errors.push(`[${pluginId}] Table "${tableName}" does not have RLS forced`)
      }

      // Check for RLS policies
      const policyResult = await db.rawQuery<{ rows: Array<{ count: string }> }>(
        `SELECT COUNT(*) as count FROM pg_policies WHERE tablename = ?`,
        [tableName]
      )

      const policyCount = Number.parseInt(policyResult.rows[0]?.count ?? '0', 10)
      if (policyCount === 0) {
        this.errors.push(`[${pluginId}] Table "${tableName}" has no RLS policies`)
      }

      // Check for tenant_id column
      const tenantIdResult = await db.rawQuery<{ rows: Array<{ exists: boolean }> }>(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = ? AND column_name = 'tenant_id'
        )`,
        [tableName]
      )

      if (!tenantIdResult.rows[0]?.exists) {
        this.errors.push(`[${pluginId}] Table "${tableName}" is missing tenant_id column`)
      }
    } catch (error) {
      this.errors.push(`[${pluginId}] Failed to verify RLS for "${tableName}": ${error}`)
    }
  }
}

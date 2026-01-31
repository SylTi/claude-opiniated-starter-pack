import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import { BaseModel as LucidBaseModel } from '@adonisjs/lucid/orm'

/**
 * Plugin DB State Model
 *
 * Tracks schema versions for plugins.
 * This is a GLOBAL table (NOT tenant-scoped, no RLS).
 * Used by the CLI migration system, not by tenant requests.
 *
 * Note: Extends LucidBaseModel directly (not our BaseModel)
 * because this table has no RLS and no tenant context.
 */
export default class PluginDbState extends LucidBaseModel {
  static table = 'plugin_db_state'

  /**
   * The primary key is the plugin_id, not an auto-incrementing id.
   */
  @column({ isPrimary: true })
  declare pluginId: string

  @column()
  declare schemaVersion: number

  @column()
  declare installedPluginVersion: string | null

  @column()
  declare lastMigrationName: string | null

  @column.dateTime()
  declare lastMigratedAt: DateTime | null

  @column.dateTime({ autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * Get schema version for a plugin.
   * Returns 0 if plugin has no recorded version.
   */
  static async getSchemaVersion(pluginId: string): Promise<number> {
    const state = await this.find(pluginId)
    return state?.schemaVersion ?? 0
  }

  /**
   * Set schema version for a plugin.
   * Creates or updates the record.
   */
  static async setSchemaVersion(pluginId: string, version: number): Promise<PluginDbState> {
    const existing = await this.find(pluginId)

    if (existing) {
      existing.schemaVersion = version
      await existing.save()
      return existing
    }

    return this.create({
      pluginId,
      schemaVersion: version,
    })
  }

  /**
   * Update migration info after running migrations.
   */
  static async updateMigrationInfo(
    pluginId: string,
    schemaVersion: number,
    pluginVersion: string,
    migrationName: string
  ): Promise<PluginDbState> {
    const existing = await this.find(pluginId)

    if (existing) {
      existing.schemaVersion = schemaVersion
      existing.installedPluginVersion = pluginVersion
      existing.lastMigrationName = migrationName
      existing.lastMigratedAt = DateTime.now()
      await existing.save()
      return existing
    }

    return this.create({
      pluginId,
      schemaVersion,
      installedPluginVersion: pluginVersion,
      lastMigrationName: migrationName,
      lastMigratedAt: DateTime.now(),
    })
  }

  /**
   * Get all plugin schema states.
   */
  static async getAllStates(): Promise<PluginDbState[]> {
    return this.all()
  }

  /**
   * Get schema versions for multiple plugins.
   */
  static async getSchemaVersions(pluginIds: string[]): Promise<Map<string, number>> {
    const states = await this.query().whereIn('plugin_id', pluginIds)
    const versions = new Map<string, number>()

    for (const state of states) {
      versions.set(state.pluginId, state.schemaVersion)
    }

    // Fill in 0 for plugins without records
    for (const id of pluginIds) {
      if (!versions.has(id)) {
        versions.set(id, 0)
      }
    }

    return versions
  }
}

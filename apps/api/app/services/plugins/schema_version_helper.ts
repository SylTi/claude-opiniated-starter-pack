/**
 * Schema Version Helper
 *
 * Helper function for plugins to update their schema version in migrations.
 * Called in the final migration of each release.
 */

import db from '@adonisjs/lucid/services/db'
import type { Database } from '@adonisjs/lucid/database'

/**
 * Set the schema version for a plugin.
 * Called at the end of plugin migrations to record the current schema version.
 *
 * @param pluginId - The plugin identifier (e.g., 'notes')
 * @param schemaVersion - The new schema version (monotonic increasing integer)
 * @param database - Optional database client (for use in transactions)
 *
 * @example
 * // In a plugin migration:
 * async up() {
 *   // ... migration logic ...
 *   await setPluginSchemaVersion('notes', 1, this.db)
 * }
 */
export async function setPluginSchemaVersion(
  pluginId: string,
  schemaVersion: number,
  database?: Database
): Promise<void> {
  const dbClient = database || db

  await dbClient.rawQuery(
    `
    INSERT INTO plugin_db_state (plugin_id, schema_version, updated_at)
    VALUES (?, ?, NOW())
    ON CONFLICT (plugin_id) DO UPDATE SET
      schema_version = EXCLUDED.schema_version,
      updated_at = NOW()
    `,
    [pluginId, schemaVersion]
  )
}

/**
 * Get the current schema version for a plugin.
 * Returns 0 if the plugin has no recorded schema version.
 *
 * @param pluginId - The plugin identifier
 * @param database - Optional database client
 */
export async function getPluginSchemaVersion(
  pluginId: string,
  database?: typeof db
): Promise<number> {
  const dbClient = database || db

  const result = await dbClient.rawQuery<{ rows: Array<{ schema_version: number }> }>(
    `SELECT schema_version FROM plugin_db_state WHERE plugin_id = ?`,
    [pluginId]
  )

  if (result.rows.length === 0) {
    return 0
  }

  return result.rows[0].schema_version
}

/**
 * Get all plugin schema versions.
 */
export async function getAllPluginSchemaVersions(
  database?: typeof db
): Promise<Map<string, number>> {
  const dbClient = database || db

  const result = await dbClient.rawQuery<{
    rows: Array<{ plugin_id: string; schema_version: number }>
  }>(`SELECT plugin_id, schema_version FROM plugin_db_state`)

  const versions = new Map<string, number>()
  for (const row of result.rows) {
    versions.set(row.plugin_id, row.schema_version)
  }

  return versions
}

/**
 * Update plugin version info after migration.
 *
 * @param pluginId - The plugin identifier
 * @param version - The plugin package version (semver)
 * @param migrationName - Name of the last migration run
 * @param database - Optional database client
 */
export async function updatePluginMigrationInfo(
  pluginId: string,
  version: string,
  migrationName: string,
  database?: typeof db
): Promise<void> {
  const dbClient = database || db

  await dbClient.rawQuery(
    `
    UPDATE plugin_db_state
    SET
      installed_plugin_version = ?,
      last_migration_name = ?,
      last_migrated_at = NOW(),
      updated_at = NOW()
    WHERE plugin_id = ?
    `,
    [version, migrationName, pluginId]
  )
}

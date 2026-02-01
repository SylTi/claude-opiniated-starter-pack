/**
 * Schema Version Helper
 *
 * Re-exports from @saas/plugins-core for backward compatibility.
 * New code should import directly from @saas/plugins-core/migrations.
 *
 * Also provides additional helpers that use the default db connection.
 */

import app from '@adonisjs/core/services/app'
import type { Database } from '@adonisjs/lucid/database'
import {
  setPluginSchemaVersion as coreSetPluginSchemaVersion,
  getPluginSchemaVersion as coreGetPluginSchemaVersion,
  type DatabaseClient,
} from '@saas/plugins-core/migrations'

// Re-export type
export type { DatabaseClient }

/**
 * Get the database instance from the app container.
 * This ensures we get the db after it's properly initialized.
 */
async function getDb(): Promise<Database> {
  return app.container.make('lucid.db')
}

/**
 * Set the schema version for a plugin.
 * Uses the default db connection if none provided.
 */
export async function setPluginSchemaVersion(
  pluginId: string,
  schemaVersion: number,
  database?: DatabaseClient
): Promise<void> {
  const dbClient = database || (await getDb())
  return coreSetPluginSchemaVersion(pluginId, schemaVersion, dbClient)
}

/**
 * Get the current schema version for a plugin.
 * Uses the default db connection if none provided.
 */
export async function getPluginSchemaVersion(
  pluginId: string,
  database?: DatabaseClient
): Promise<number> {
  const dbClient = database || (await getDb())
  return coreGetPluginSchemaVersion(pluginId, dbClient)
}

/**
 * Get all plugin schema versions.
 * Uses the default db connection.
 */
export async function getAllPluginSchemaVersions(
  database?: Database
): Promise<Map<string, number>> {
  const dbClient = database || (await getDb())

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
  database?: Database
): Promise<void> {
  const dbClient = database || (await getDb())

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

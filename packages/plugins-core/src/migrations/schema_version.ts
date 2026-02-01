/**
 * Schema Version Helper for Plugin Migrations
 *
 * Provides helpers for plugins to update their schema version in migrations.
 * Called in the final migration of each release.
 *
 * This lives in @saas/plugins-core so plugins can import it without
 * needing access to the API's internal aliases (#services/*, etc).
 */

/**
 * Database client interface that supports rawQuery.
 * Compatible with AdonisJS Database and BaseSchema's this.db
 */
export interface DatabaseClient {
  rawQuery<T = unknown>(sql: string, bindings?: unknown[]): Promise<T>
}

/**
 * Set the schema version for a plugin.
 * Called at the end of plugin migrations to record the current schema version.
 *
 * @param pluginId - The plugin identifier (e.g., 'notes')
 * @param schemaVersion - The new schema version (monotonic increasing integer)
 * @param db - Database client that supports rawQuery
 *
 * @example
 * // In a plugin migration:
 * import { setPluginSchemaVersion } from '@saas/plugins-core/migrations'
 *
 * async up() {
 *   // ... migration logic ...
 *   await setPluginSchemaVersion('notes', 1, this.db)
 * }
 */
export async function setPluginSchemaVersion(
  pluginId: string,
  schemaVersion: number,
  db: DatabaseClient
): Promise<void> {
  await db.rawQuery(
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
 * @param db - Database client that supports rawQuery
 */
export async function getPluginSchemaVersion(
  pluginId: string,
  db: DatabaseClient
): Promise<number> {
  const result = await db.rawQuery<{ rows: Array<{ schema_version: number }> }>(
    `SELECT schema_version FROM plugin_db_state WHERE plugin_id = ?`,
    [pluginId]
  )

  if (!result.rows || result.rows.length === 0) {
    return 0
  }

  return result.rows[0].schema_version
}

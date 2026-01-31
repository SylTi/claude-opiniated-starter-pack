import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Plugin DB State Migration
 *
 * Creates the plugin_db_state table for tracking applied schema versions per plugin.
 * This is a GLOBAL table (NOT tenant-scoped) used by the CLI migration system.
 *
 * Purpose:
 * - Track which schema version each plugin is at
 * - Boot-time compatibility check: if enabled plugin schema behind expected version, FATAL
 * - setPluginSchemaVersion() helper updates this table in migrations
 *
 * Note: This table has NO RLS because it's a global system table for migration tracking,
 * not tenant-specific data.
 */
export default class extends BaseSchema {
  protected tableName = 'plugin_db_state'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      // Primary key is the plugin ID (e.g., 'motion', 'notes')
      table.string('plugin_id', 100).primary()

      // Current schema version (monotonic increasing integer)
      table.integer('schema_version').notNullable().defaultTo(0)

      // Installed plugin package version (semver string)
      table.string('installed_plugin_version', 50).nullable()

      // Name of the last migration that was run
      table.string('last_migration_name', 255).nullable()

      // When the last migration was applied
      table.timestamp('last_migrated_at', { useTz: true }).nullable()

      // Timestamps
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    // Add comment explaining this is a global table
    // Use defer() to run after table creation
    this.defer(async (db) => {
      await db.rawQuery(`
        COMMENT ON TABLE ${this.tableName} IS
          'Global plugin schema tracking table. NOT tenant-scoped. Used by CLI migrations only.';
      `)
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

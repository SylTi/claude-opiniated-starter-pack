import { BaseSchema } from '@adonisjs/lucid/schema'
import { setPluginSchemaVersion } from '#services/plugins/schema_version_helper'

/**
 * Notes Plugin - Bump Schema Version
 *
 * Updates the schema version in plugin_db_state.
 * This should be the final migration of each release.
 *
 * SPEC COMPLIANCE:
 * - Uses setPluginSchemaVersion() helper (not raw SQL)
 * - Helper is imported from core services
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // Use the core helper to set schema version
    await setPluginSchemaVersion('notes', 1, this.db)
  }

  async down(): Promise<void> {
    // Reset schema version to 0
    await setPluginSchemaVersion('notes', 0, this.db)
  }
}

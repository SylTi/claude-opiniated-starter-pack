import { BaseSchema } from '@adonisjs/lucid/schema'
import { setPluginSchemaVersion } from '@saas/plugins-core/migrations'

/**
 * Notes Plugin - Bump Schema Version
 *
 * Updates the schema version in plugin_db_state.
 * This should be the final migration of each release.
 *
 * SPEC COMPLIANCE:
 * - Uses setPluginSchemaVersion() helper from @saas/plugins-core
 * - Helper is importable by all plugins (not tied to api's internal aliases)
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    await setPluginSchemaVersion('notes', 1, this.db)
  }

  async down(): Promise<void> {
    await setPluginSchemaVersion('notes', 0, this.db)
  }
}

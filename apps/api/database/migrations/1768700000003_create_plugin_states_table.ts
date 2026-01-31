import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Plugin States Migration
 *
 * Creates the plugin_states table for tracking which plugins are enabled per tenant.
 * This is a TENANT-SCOPED table with RLS enforced.
 *
 * Purpose:
 * - Track which plugins are enabled for each tenant
 * - Store plugin configuration per tenant
 * - Plugin version installed per tenant
 *
 * Uses the app.apply_tenant_rls() and app.assert_tenant_scoped_table() helper functions.
 */
export default class extends BaseSchema {
  protected tableName = 'plugin_states'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Tenant relationship (for RLS)
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      // Plugin identifier (e.g., 'motion', 'notes')
      table.string('plugin_id', 100).notNullable()

      // Plugin version currently installed (semver)
      table.string('version', 50).notNullable()

      // Whether the plugin is enabled for this tenant
      table.boolean('enabled').notNullable().defaultTo(false)

      // Plugin-specific configuration (JSON)
      table.jsonb('config').nullable()

      // Timestamps
      table.timestamp('installed_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      // Unique constraint: one plugin per tenant
      table.unique(['tenant_id', 'plugin_id'])
    })

    // Use defer() to run after table creation
    this.defer(async (db) => {
      // Create index starting with tenant_id for RLS efficiency
      await db.rawQuery(`
        CREATE INDEX idx_plugin_states_tenant_enabled
        ON ${this.tableName} (tenant_id, enabled);
      `)

      // Apply RLS using the helper function
      await db.rawQuery(`SELECT app.apply_tenant_rls('${this.tableName}'::regclass);`)

      // Assert tenant-scoped table invariants (hard fail if violated)
      await db.rawQuery(`SELECT app.assert_tenant_scoped_table('${this.tableName}'::regclass);`)

      // Add comment
      await db.rawQuery(`
        COMMENT ON TABLE ${this.tableName} IS
          'Tenant-scoped plugin enable/disable state. Uses RLS for tenant isolation.';
      `)
    })
  }

  async down(): Promise<void> {
    // Drop policies before dropping table
    await this.db.rawQuery(
      `DROP POLICY IF EXISTS ${this.tableName}_tenant_select ON ${this.tableName};`
    )
    await this.db.rawQuery(
      `DROP POLICY IF EXISTS ${this.tableName}_tenant_insert ON ${this.tableName};`
    )
    await this.db.rawQuery(
      `DROP POLICY IF EXISTS ${this.tableName}_tenant_update ON ${this.tableName};`
    )
    await this.db.rawQuery(
      `DROP POLICY IF EXISTS ${this.tableName}_tenant_delete ON ${this.tableName};`
    )

    this.schema.dropTable(this.tableName)
  }
}

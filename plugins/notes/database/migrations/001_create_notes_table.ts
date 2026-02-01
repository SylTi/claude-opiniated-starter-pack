import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Notes Plugin - Create Notes Table
 *
 * Creates the main notes table with tenant isolation.
 */
export default class extends BaseSchema {
  protected tableName = 'plugin_notes_notes'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Tenant isolation (required for RLS)
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      // User who created the note
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      // Note content
      table.string('title', 255).notNullable()
      table.text('content').nullable()

      // Timestamps
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })

    // Defer raw queries to run after schema.createTable completes
    this.defer(async (db) => {
      // Create index starting with tenant_id for RLS efficiency
      await db.rawQuery(`
        CREATE INDEX idx_plugin_notes_notes_tenant
        ON ${this.tableName} (tenant_id, created_at DESC);
      `)

      // Create index for user lookup
      await db.rawQuery(`
        CREATE INDEX idx_plugin_notes_notes_user
        ON ${this.tableName} (tenant_id, user_id);
      `)

      // Apply RLS using core helper function
      await db.rawQuery(`SELECT app.apply_tenant_rls('${this.tableName}'::regclass);`)

      // Assert tenant-scoped table invariants (hard fail if violated)
      await db.rawQuery(`SELECT app.assert_tenant_scoped_table('${this.tableName}'::regclass);`)
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

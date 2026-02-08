import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Notifications (core)
 *
 * Tenant-scoped in-app notifications used by core and Tier C plugins.
 */
export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      table
        .integer('recipient_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('plugin_id', 100).nullable()
      table.string('type', 200).notNullable()
      table.string('title', 200).notNullable()
      table.text('body').nullable()
      table.string('url', 1000).nullable()
      table.jsonb('meta').nullable()

      table.timestamp('read_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE INDEX idx_notifications_tenant_recipient_created
        ON ${this.tableName} (tenant_id, recipient_id, created_at DESC);
      `)
      await db.rawQuery(`
        CREATE INDEX idx_notifications_tenant_type_created
        ON ${this.tableName} (tenant_id, type, created_at DESC);
      `)

      await db.rawQuery(`SELECT app.apply_tenant_rls('${this.tableName}'::regclass);`)
      await db.rawQuery(`SELECT app.assert_tenant_scoped_table('${this.tableName}'::regclass);`)
    })
  }

  async down(): Promise<void> {
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

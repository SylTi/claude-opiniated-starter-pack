import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Plugin Permission Grants
 *
 * Stores tenant-scoped resource permission grants created by Tier C plugins via
 * PermissionsFacade.grant/revoke.
 */
export default class extends BaseSchema {
  protected tableName = 'plugin_permission_grants'

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

      table.string('plugin_id', 100).notNullable()

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('ability', 200).notNullable()
      table.string('resource_type', 100).notNullable()
      table.string('resource_id', 100).notNullable()

      table
        .integer('granted_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      table.unique(['tenant_id', 'plugin_id', 'user_id', 'ability', 'resource_type', 'resource_id'])
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE INDEX idx_plugin_permission_grants_tenant_plugin_user
        ON ${this.tableName} (tenant_id, plugin_id, user_id);
      `)

      await db.rawQuery(`
        CREATE INDEX idx_plugin_permission_grants_tenant_plugin_resource
        ON ${this.tableName} (tenant_id, plugin_id, resource_type, resource_id);
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

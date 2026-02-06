import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Auth Tokens (Core OSS)
 *
 * Generic token store for plugin-issued integration/auth tokens.
 * This keeps token primitives in skeleton core (mint/revoke/validate),
 * while plugins keep ownership of their route contracts and business use.
 */
export default class extends BaseSchema {
  protected tableName = 'auth_tokens'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('plugin_id', 100).notNullable()
      table.string('kind', 100).notNullable()
      table.string('name', 255).notNullable()
      table.string('token_hash', 255).notNullable().unique()
      table.specificType('scopes', 'text[]').notNullable()
      table.jsonb('metadata').nullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE INDEX idx_auth_tokens_tenant_plugin_kind
        ON ${this.tableName} (tenant_id, plugin_id, kind, created_at DESC);
      `)
      await db.rawQuery(
        `CREATE INDEX idx_auth_tokens_tenant_user ON ${this.tableName} (tenant_id, user_id);`
      )

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

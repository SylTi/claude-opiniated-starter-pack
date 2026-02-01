import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Notes Plugin - Create RBAC Tables
 *
 * Creates plugin-specific RBAC tables following Pattern A (4 tables).
 * All tables use tenant isolation with RLS.
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    const rolesTable = 'plugin_notes_roles'
    const membersTable = 'plugin_notes_role_members'
    const abilitiesTable = 'plugin_notes_role_abilities'
    const grantsTable = 'plugin_notes_role_resource_grants'

    // 1. Roles table
    this.schema.createTable(rolesTable, (table) => {
      table.increments('id').primary()
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table.string('name', 100).notNullable()
      table.string('description', 255).nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
      table.unique(['tenant_id', 'name'])
    })

    // 2. Role members table
    this.schema.createTable(membersTable, (table) => {
      table.increments('id').primary()
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable(rolesTable)
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.unique(['tenant_id', 'role_id', 'user_id'])
    })

    // 3. Role abilities table
    this.schema.createTable(abilitiesTable, (table) => {
      table.increments('id').primary()
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable(rolesTable)
        .onDelete('CASCADE')
      table.string('ability', 100).notNullable() // e.g., 'notes.note.write'
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.unique(['tenant_id', 'role_id', 'ability'])
    })

    // 4. Resource grants table (for resource-level permissions)
    this.schema.createTable(grantsTable, (table) => {
      table.increments('id').primary()
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable(rolesTable)
        .onDelete('CASCADE')
      table.string('resource_type', 50).notNullable() // e.g., 'note'
      table.integer('resource_id').unsigned().notNullable()
      table.string('ability', 100).notNullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.unique(['tenant_id', 'role_id', 'resource_type', 'resource_id', 'ability'])
    })

    // Defer raw queries to run after all schema.createTable calls complete
    this.defer(async (db) => {
      // Apply RLS to all tables
      await db.rawQuery(`SELECT app.apply_tenant_rls('${rolesTable}'::regclass);`)
      await db.rawQuery(`SELECT app.assert_tenant_scoped_table('${rolesTable}'::regclass);`)

      await db.rawQuery(`SELECT app.apply_tenant_rls('${membersTable}'::regclass);`)
      await db.rawQuery(`SELECT app.assert_tenant_scoped_table('${membersTable}'::regclass);`)

      await db.rawQuery(`SELECT app.apply_tenant_rls('${abilitiesTable}'::regclass);`)
      await db.rawQuery(`SELECT app.assert_tenant_scoped_table('${abilitiesTable}'::regclass);`)

      await db.rawQuery(`SELECT app.apply_tenant_rls('${grantsTable}'::regclass);`)
      await db.rawQuery(`SELECT app.assert_tenant_scoped_table('${grantsTable}'::regclass);`)
    })
  }

  async down(): Promise<void> {
    const tables = [
      'plugin_notes_role_resource_grants',
      'plugin_notes_role_abilities',
      'plugin_notes_role_members',
      'plugin_notes_roles',
    ]

    for (const table of tables) {
      // Drop policies
      await this.db.rawQuery(`DROP POLICY IF EXISTS ${table}_tenant_select ON ${table};`)
      await this.db.rawQuery(`DROP POLICY IF EXISTS ${table}_tenant_insert ON ${table};`)
      await this.db.rawQuery(`DROP POLICY IF EXISTS ${table}_tenant_update ON ${table};`)
      await this.db.rawQuery(`DROP POLICY IF EXISTS ${table}_tenant_delete ON ${table};`)

      this.schema.dropTable(table)
    }
  }
}

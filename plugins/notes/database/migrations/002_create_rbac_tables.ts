import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Notes Plugin - Create RBAC Tables
 *
 * Creates plugin-specific RBAC tables following Pattern A (4 tables).
 * All tables use tenant isolation with RLS.
 */
export default class extends BaseSchema {
  async up(): Promise<void> {
    // 1. Roles table
    const rolesTable = 'plugin_notes_roles'
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

    await this.db.rawQuery(`SELECT app.apply_tenant_rls('${rolesTable}'::regclass);`)
    await this.db.rawQuery(`SELECT app.assert_tenant_scoped_table('${rolesTable}'::regclass);`)

    // 2. Role members table
    const membersTable = 'plugin_notes_role_members'
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

    await this.db.rawQuery(`SELECT app.apply_tenant_rls('${membersTable}'::regclass);`)
    await this.db.rawQuery(`SELECT app.assert_tenant_scoped_table('${membersTable}'::regclass);`)

    // 3. Role abilities table
    const abilitiesTable = 'plugin_notes_role_abilities'
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

    await this.db.rawQuery(`SELECT app.apply_tenant_rls('${abilitiesTable}'::regclass);`)
    await this.db.rawQuery(`SELECT app.assert_tenant_scoped_table('${abilitiesTable}'::regclass);`)

    // 4. Resource grants table (for resource-level permissions)
    const grantsTable = 'plugin_notes_role_resource_grants'
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

    await this.db.rawQuery(`SELECT app.apply_tenant_rls('${grantsTable}'::regclass);`)
    await this.db.rawQuery(`SELECT app.assert_tenant_scoped_table('${grantsTable}'::regclass);`)
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

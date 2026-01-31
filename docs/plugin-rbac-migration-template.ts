/**
 * Plugin RBAC Migration Template
 *
 * This template shows how to create RBAC tables for a plugin.
 * Copy and modify for your plugin, replacing {pluginId} with your actual plugin ID.
 *
 * Pattern A: 4 tables per plugin
 * 1. plugin_{pluginId}_roles - Role definitions
 * 2. plugin_{pluginId}_role_members - User -> Role mappings
 * 3. plugin_{pluginId}_role_abilities - Role -> Ability mappings
 * 4. plugin_{pluginId}_role_resource_grants - Role -> Resource-specific grants
 */

import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Replace {PLUGIN_ID} with your plugin ID (e.g., 'notes', 'boards')
 */
const PLUGIN_ID = 'example'

export default class extends BaseSchema {
  private rolesTable = `plugin_${PLUGIN_ID}_roles`
  private membersTable = `plugin_${PLUGIN_ID}_role_members`
  private abilitiesTable = `plugin_${PLUGIN_ID}_role_abilities`
  private grantsTable = `plugin_${PLUGIN_ID}_role_resource_grants`

  async up(): Promise<void> {
    // 1. Create roles table
    this.schema.createTable(this.rolesTable, (table) => {
      table.increments('id').primary()

      // Tenant isolation (REQUIRED)
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      // Role data
      table.string('name', 100).notNullable()
      table.string('description', 255).nullable()

      // Timestamps
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      // Unique constraint: one role name per tenant
      table.unique(['tenant_id', 'name'])
    })

    // Apply RLS (REQUIRED)
    await this.db.rawQuery(`SELECT app.apply_tenant_rls('${this.rolesTable}'::regclass);`)
    await this.db.rawQuery(`SELECT app.assert_tenant_scoped_table('${this.rolesTable}'::regclass);`)

    // 2. Create role members table
    this.schema.createTable(this.membersTable, (table) => {
      table.increments('id').primary()

      // Tenant isolation (REQUIRED)
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      // Role membership
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable(this.rolesTable)
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      // Timestamps
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())

      // Unique constraint: user can only have one membership per role
      table.unique(['tenant_id', 'role_id', 'user_id'])
    })

    // Apply RLS (REQUIRED)
    await this.db.rawQuery(`SELECT app.apply_tenant_rls('${this.membersTable}'::regclass);`)
    await this.db.rawQuery(
      `SELECT app.assert_tenant_scoped_table('${this.membersTable}'::regclass);`
    )

    // 3. Create role abilities table
    this.schema.createTable(this.abilitiesTable, (table) => {
      table.increments('id').primary()

      // Tenant isolation (REQUIRED)
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      // Role -> Ability mapping
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable(this.rolesTable)
        .onDelete('CASCADE')

      // Ability string (e.g., 'example.item.read', 'example.item.write')
      table.string('ability', 100).notNullable()

      // Timestamps
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())

      // Unique constraint: one ability per role
      table.unique(['tenant_id', 'role_id', 'ability'])
    })

    // Apply RLS (REQUIRED)
    await this.db.rawQuery(`SELECT app.apply_tenant_rls('${this.abilitiesTable}'::regclass);`)
    await this.db.rawQuery(
      `SELECT app.assert_tenant_scoped_table('${this.abilitiesTable}'::regclass);`
    )

    // 4. Create resource grants table (for resource-level permissions)
    this.schema.createTable(this.grantsTable, (table) => {
      table.increments('id').primary()

      // Tenant isolation (REQUIRED)
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      // Role -> Resource grant
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable(this.rolesTable)
        .onDelete('CASCADE')

      // Resource identification
      table.string('resource_type', 50).notNullable() // e.g., 'item', 'folder'
      table.integer('resource_id').unsigned().notNullable()

      // Ability granted on this resource
      table.string('ability', 100).notNullable()

      // Timestamps
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())

      // Unique constraint
      table.unique(['tenant_id', 'role_id', 'resource_type', 'resource_id', 'ability'])
    })

    // Apply RLS (REQUIRED)
    await this.db.rawQuery(`SELECT app.apply_tenant_rls('${this.grantsTable}'::regclass);`)
    await this.db.rawQuery(`SELECT app.assert_tenant_scoped_table('${this.grantsTable}'::regclass);`)

    // Create indexes for efficient lookups
    await this.db.rawQuery(`
      CREATE INDEX idx_${this.membersTable}_lookup
      ON ${this.membersTable} (tenant_id, user_id);
    `)

    await this.db.rawQuery(`
      CREATE INDEX idx_${this.grantsTable}_resource
      ON ${this.grantsTable} (tenant_id, resource_type, resource_id);
    `)
  }

  async down(): Promise<void> {
    // Drop tables in reverse order (due to foreign keys)
    const tables = [this.grantsTable, this.abilitiesTable, this.membersTable, this.rolesTable]

    for (const table of tables) {
      // Drop policies first
      await this.db.rawQuery(`DROP POLICY IF EXISTS ${table}_tenant_select ON ${table};`)
      await this.db.rawQuery(`DROP POLICY IF EXISTS ${table}_tenant_insert ON ${table};`)
      await this.db.rawQuery(`DROP POLICY IF EXISTS ${table}_tenant_update ON ${table};`)
      await this.db.rawQuery(`DROP POLICY IF EXISTS ${table}_tenant_delete ON ${table};`)

      // Drop table
      this.schema.dropTable(table)
    }
  }
}

/**
 * Example usage in your authzResolver:
 *
 * export async function authzResolver(
 *   ctx: AuthzContext,
 *   check: AuthzCheck
 * ): Promise<AuthzDecision> {
 *   // 1. Get user's roles in this tenant
 *   const roles = await db.query()
 *     .from('plugin_example_role_members')
 *     .where('tenant_id', ctx.tenantId)
 *     .where('user_id', ctx.userId)
 *     .select('role_id')
 *
 *   // 2. Check if any role has the required ability
 *   const abilities = await db.query()
 *     .from('plugin_example_role_abilities')
 *     .where('tenant_id', ctx.tenantId)
 *     .whereIn('role_id', roles.map(r => r.role_id))
 *     .where('ability', check.ability)
 *     .first()
 *
 *   if (abilities) {
 *     return { allow: true }
 *   }
 *
 *   // 3. Check resource-specific grants if resource provided
 *   if (check.resource) {
 *     const grant = await db.query()
 *       .from('plugin_example_role_resource_grants')
 *       .where('tenant_id', ctx.tenantId)
 *       .whereIn('role_id', roles.map(r => r.role_id))
 *       .where('resource_type', check.resource.type)
 *       .where('resource_id', check.resource.id)
 *       .where('ability', check.ability)
 *       .first()
 *
 *     if (grant) {
 *       return { allow: true }
 *     }
 *   }
 *
 *   return {
 *     allow: false,
 *     reason: `No permission for ${check.ability}`,
 *   }
 * }
 */

import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration to fix the teams.owner_id foreign key constraint.
 *
 * Problem: The original constraint used ON DELETE SET NULL which
 * creates "zombie teams" - teams with no owner that crash billing.
 *
 * Solution: Change to ON DELETE RESTRICT to prevent user deletion
 * when they own teams (they must transfer ownership first).
 */
export default class extends BaseSchema {
  protected tableName = 'teams'

  async up(): Promise<void> {
    // PostgreSQL: Drop and recreate the foreign key with RESTRICT
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the existing foreign key constraint
      table.dropForeign(['owner_id'])
    })

    this.schema.alterTable(this.tableName, (table) => {
      // Recreate with RESTRICT (prevents deletion of users who own teams)
      table
        .integer('owner_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
        .alter()
    })
  }

  async down(): Promise<void> {
    // Revert to SET NULL (original behavior)
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['owner_id'])
    })

    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('owner_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .alter()
    })
  }
}

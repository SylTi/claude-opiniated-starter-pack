import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('current_team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('SET NULL')
        .nullable()
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('current_team_id')
    })
  }
}

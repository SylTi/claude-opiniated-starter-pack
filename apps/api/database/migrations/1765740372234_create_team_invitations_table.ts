import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'team_invitations'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('team_id').unsigned().references('id').inTable('teams').onDelete('CASCADE')
      table
        .integer('invited_by_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('email').notNullable()
      table.string('token').notNullable().unique()
      table
        .enum('status', ['pending', 'accepted', 'declined', 'expired'])
        .notNullable()
        .defaultTo('pending')
      table.enum('role', ['admin', 'member']).notNullable().defaultTo('member')
      table.timestamp('expires_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['email', 'team_id'])
      table.index(['token'])
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

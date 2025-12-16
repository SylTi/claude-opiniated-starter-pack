import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'password_reset_tokens'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('token', 64).notNullable().unique()
      table.timestamp('expires_at').notNullable()
      table.timestamp('created_at').notNullable()

      table.index(['token'])
      table.index(['user_id'])
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

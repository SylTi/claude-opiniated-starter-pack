import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'discount_code_usages'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('discount_code_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('discount_codes')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.timestamp('used_at').notNullable()
      table.string('checkout_session_id').nullable()

      table.index(['discount_code_id', 'user_id'])
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'coupons'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('code', 50).notNullable().unique()
      table.text('description').nullable()
      table.decimal('credit_amount', 12, 2).notNullable()
      table.string('currency', 3).notNullable().defaultTo('usd')
      table.timestamp('expires_at').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table
        .integer('redeemed_by_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('redeemed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

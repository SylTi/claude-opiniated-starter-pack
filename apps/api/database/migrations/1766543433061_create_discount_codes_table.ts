import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'discount_codes'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('code', 50).notNullable().unique()
      table.text('description').nullable()
      table.enum('discount_type', ['percent', 'fixed']).notNullable()
      table.decimal('discount_value', 12, 2).notNullable()
      table.string('currency', 3).nullable()
      table.decimal('min_amount', 12, 2).nullable()
      table.integer('max_uses').nullable()
      table.integer('max_uses_per_user').nullable()
      table.integer('times_used').notNullable().defaultTo(0)
      table.timestamp('expires_at').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

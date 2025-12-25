import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prices'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('product_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('products')
        .onDelete('CASCADE')
      table.string('provider', 20).notNullable()
      table.string('provider_price_id', 255).notNullable().unique()
      table.enum('interval', ['month', 'year']).notNullable()
      table.string('currency', 3).notNullable().defaultTo('usd')
      table.integer('unit_amount').notNullable()
      table.enum('tax_behavior', ['inclusive', 'exclusive']).notNullable().defaultTo('exclusive')
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Index for looking up active prices
      table.index(['product_id', 'is_active'], 'idx_product_active')
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

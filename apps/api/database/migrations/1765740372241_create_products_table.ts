import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('tier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('subscription_tiers')
        .onDelete('RESTRICT')
      table.string('provider', 20).notNullable()
      table.string('provider_product_id', 255).notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Unique constraint: one product per tier per provider
      table.unique(['tier_id', 'provider'], 'idx_unique_tier_provider')
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

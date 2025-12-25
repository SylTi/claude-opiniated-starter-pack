import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payment_customers'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('subscriber_type', 20).notNullable()
      table.integer('subscriber_id').unsigned().notNullable()
      table.string('provider', 20).notNullable()
      table.string('provider_customer_id', 255).notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Unique constraint: one payment customer per subscriber per provider
      table.unique(
        ['subscriber_type', 'subscriber_id', 'provider'],
        'idx_unique_subscriber_provider'
      )
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'processed_webhook_events'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('event_id', 255).notNullable()
      table.string('provider', 20).notNullable()
      table.string('event_type', 100).nullable()
      table.timestamp('processed_at').notNullable()
      table.timestamp('created_at').notNullable()

      // Unique constraint: one event per provider
      table.unique(['event_id', 'provider'], 'idx_unique_event_provider')
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

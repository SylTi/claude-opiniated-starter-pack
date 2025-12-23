import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('subscriber_type', 20).notNullable()
      table.integer('subscriber_id').unsigned().notNullable()
      table
        .integer('tier_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('subscription_tiers')
        .onDelete('RESTRICT')
      table.enum('status', ['active', 'expired', 'cancelled']).notNullable().defaultTo('active')
      table.timestamp('starts_at').notNullable()
      table.timestamp('expires_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Indexes
      table.index(['subscriber_type', 'subscriber_id'], 'idx_subscriber')
      table.index(['status'], 'idx_status')
      table.index(['expires_at'], 'idx_expires_at')
      table.index(['tier_id'], 'idx_tier_id')
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

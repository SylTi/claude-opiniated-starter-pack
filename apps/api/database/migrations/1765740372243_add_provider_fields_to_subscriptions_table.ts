import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('provider_name', 20).nullable()
      table.string('provider_subscription_id', 255).nullable().unique()

      // Index for looking up by provider subscription ID
      table.index(['provider_subscription_id'], 'idx_provider_subscription_id')
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['provider_subscription_id'], 'idx_provider_subscription_id')
      table.dropColumn('provider_subscription_id')
      table.dropColumn('provider_name')
    })
  }
}

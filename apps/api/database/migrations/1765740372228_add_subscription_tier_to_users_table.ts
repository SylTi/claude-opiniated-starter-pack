import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('subscription_tier', ['free', 'tier1', 'tier2']).notNullable().defaultTo('free')
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('subscription_tier')
    })
  }
}

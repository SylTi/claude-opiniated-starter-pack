import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('subscription_expires_at').nullable()
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('subscription_expires_at')
    })
  }
}

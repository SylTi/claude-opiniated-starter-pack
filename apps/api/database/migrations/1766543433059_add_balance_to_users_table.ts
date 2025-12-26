import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('balance', 12, 2).notNullable().defaultTo(0)
      table.string('balance_currency', 3).notNullable().defaultTo('usd')
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('balance')
      table.dropColumn('balance_currency')
    })
  }
}

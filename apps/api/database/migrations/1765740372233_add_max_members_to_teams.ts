import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'teams'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      // Default limits: free=5, tier1=20, tier2=unlimited (null)
      table.integer('max_members').unsigned().nullable().defaultTo(5)
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('max_members')
    })
  }
}

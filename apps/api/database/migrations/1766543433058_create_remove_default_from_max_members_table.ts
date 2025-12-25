import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'teams'

  async up(): Promise<void> {
    // Remove the default value from max_members column
    // null means "use subscription tier default", a value means "custom override"
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('max_members').unsigned().nullable().alter()
    })

    // Update existing rows that have the old default (5) to null
    // This assumes teams with max_members=5 were using the default, not a custom value
    this.defer(async (db) => {
      await db.from(this.tableName).where('max_members', 5).update({ max_members: null })
    })
  }

  async down(): Promise<void> {
    // Restore the default value
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('max_members').unsigned().nullable().defaultTo(5).alter()
    })
  }
}

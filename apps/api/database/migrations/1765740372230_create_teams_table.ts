import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'teams'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('slug').notNullable().unique()
      table.enum('subscription_tier', ['free', 'tier1', 'tier2']).notNullable().defaultTo('free')
      table.timestamp('subscription_expires_at').nullable()
      table.integer('owner_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

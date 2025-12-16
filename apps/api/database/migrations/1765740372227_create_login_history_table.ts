import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'login_history'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('ip_address', 45).nullable() // IPv6 can be up to 45 chars
      table.string('user_agent').nullable()
      table.string('login_method', 50).notNullable() // password, google, github, mfa
      table.boolean('success').notNullable().defaultTo(true)
      table.string('failure_reason').nullable()
      table.timestamp('created_at').notNullable()

      table.index(['user_id'])
      table.index(['created_at'])
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

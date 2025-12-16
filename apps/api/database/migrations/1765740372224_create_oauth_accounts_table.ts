import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'oauth_accounts'

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
      table.string('provider', 50).notNullable() // google, github, microsoft
      table.string('provider_user_id').notNullable()
      table.string('email').nullable()
      table.string('name').nullable()
      table.string('avatar_url').nullable()
      table.text('access_token').nullable()
      table.text('refresh_token').nullable()
      table.timestamp('token_expires_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Unique constraint: one account per provider per user
      table.unique(['user_id', 'provider'])
      // Unique constraint: one provider account can only be linked to one user
      table.unique(['provider', 'provider_user_id'])
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}

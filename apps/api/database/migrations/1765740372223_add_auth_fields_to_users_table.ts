import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      // Role field (RBAC)
      table.string('role', 50).notNullable().defaultTo('user')

      // Email verification
      table.boolean('email_verified').notNullable().defaultTo(false)
      table.timestamp('email_verified_at').nullable()

      // MFA fields
      table.boolean('mfa_enabled').notNullable().defaultTo(false)
      table.string('mfa_secret').nullable()
      table.text('mfa_backup_codes').nullable() // JSON array of backup codes

      // Profile
      table.string('avatar_url').nullable()

      // Password can be null for OAuth-only users
      table.string('password').nullable().alter()
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('role')
      table.dropColumn('email_verified')
      table.dropColumn('email_verified_at')
      table.dropColumn('mfa_enabled')
      table.dropColumn('mfa_secret')
      table.dropColumn('mfa_backup_codes')
      table.dropColumn('avatar_url')
    })
  }
}

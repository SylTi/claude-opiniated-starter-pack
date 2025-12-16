import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import OAuthAccount from '#models/oauth_account'
import LoginHistory from '#models/login_history'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export type UserRole = 'admin' | 'user' | 'guest'

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string | null

  @column()
  declare role: UserRole

  @column()
  declare emailVerified: boolean

  @column.dateTime()
  declare emailVerifiedAt: DateTime | null

  @column()
  declare mfaEnabled: boolean

  @column({ serializeAs: null })
  declare mfaSecret: string | null

  @column({ serializeAs: null })
  declare mfaBackupCodes: string | null

  @column()
  declare avatarUrl: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => OAuthAccount)
  declare oauthAccounts: HasMany<typeof OAuthAccount>

  @hasMany(() => LoginHistory)
  declare loginHistory: HasMany<typeof LoginHistory>

  /**
   * Check if user has a specific role
   */
  hasRole(role: UserRole): boolean {
    return this.role === role
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.role === 'admin'
  }

  /**
   * Get parsed MFA backup codes
   */
  getMfaBackupCodes(): string[] {
    if (!this.mfaBackupCodes) return []
    try {
      return JSON.parse(this.mfaBackupCodes)
    } catch {
      return []
    }
  }

  /**
   * Set MFA backup codes
   */
  setMfaBackupCodes(codes: string[]): void {
    this.mfaBackupCodes = JSON.stringify(codes)
  }
}

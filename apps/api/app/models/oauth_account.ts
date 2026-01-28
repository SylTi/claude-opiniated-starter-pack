import { DateTime } from 'luxon'
import { column, belongsTo, beforeSave, afterFind, afterFetch } from '@adonisjs/lucid/orm'
import BaseModel from '#models/base_model'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import { encryptionService } from '#services/encryption_service'

export type OAuthProvider = 'google' | 'github' | 'microsoft'

export default class OAuthAccount extends BaseModel {
  static table = 'oauth_accounts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare provider: OAuthProvider

  @column()
  declare providerUserId: string

  @column()
  declare email: string | null

  @column()
  declare name: string | null

  @column()
  declare avatarUrl: string | null

  @column({ serializeAs: null })
  declare accessToken: string | null

  @column({ serializeAs: null })
  declare refreshToken: string | null

  @column.dateTime()
  declare tokenExpiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /**
   * Encrypt sensitive tokens before saving
   */
  @beforeSave()
  static async encryptTokens(account: OAuthAccount): Promise<void> {
    if (account.$dirty.accessToken && account.accessToken) {
      if (!encryptionService.isEncrypted(account.accessToken)) {
        account.accessToken = encryptionService.encrypt(account.accessToken)
      }
    }
    if (account.$dirty.refreshToken && account.refreshToken) {
      if (!encryptionService.isEncrypted(account.refreshToken)) {
        account.refreshToken = encryptionService.encrypt(account.refreshToken)
      }
    }
  }

  /**
   * Decrypt sensitive tokens after fetching from DB
   */
  @afterFind()
  static decryptTokensAfterFind(account: OAuthAccount): void {
    OAuthAccount.decryptTokens(account)
  }

  @afterFetch()
  static decryptTokensAfterFetch(accounts: OAuthAccount[]): void {
    for (const account of accounts) {
      OAuthAccount.decryptTokens(account)
    }
  }

  private static decryptTokens(account: OAuthAccount): void {
    if (account.accessToken) {
      account.accessToken = encryptionService.decrypt(account.accessToken)
    }
    if (account.refreshToken) {
      account.refreshToken = encryptionService.decrypt(account.refreshToken)
    }
  }
}

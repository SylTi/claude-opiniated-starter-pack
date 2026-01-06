import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

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
}

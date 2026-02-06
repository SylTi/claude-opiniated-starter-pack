import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import BaseModel from '#models/base_model'

/**
 * Generic auth/integration token record.
 * Token plaintext is never stored, only SHA-256 token_hash.
 */
export default class AuthToken extends BaseModel {
  static table = 'auth_tokens'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tenantId: number

  @column()
  declare userId: number

  @column()
  declare pluginId: string

  @column()
  declare kind: string

  @column()
  declare name: string

  @column()
  declare tokenHash: string

  @column()
  declare scopes: string[]

  @column()
  declare metadata: Record<string, unknown> | null

  @column.dateTime()
  declare lastUsedAt: DateTime | null

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  get isExpired(): boolean {
    return this.expiresAt !== null && this.expiresAt < DateTime.now()
  }

  hasScope(scope: string): boolean {
    return this.scopes.includes(scope)
  }
}

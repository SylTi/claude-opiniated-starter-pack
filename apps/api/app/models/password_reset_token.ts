import { DateTime } from 'luxon'
import { createHash, randomBytes } from 'node:crypto'
import { column, belongsTo } from '@adonisjs/lucid/orm'
import BaseModel from '#models/base_model'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class PasswordResetToken extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  /**
   * Stores the SHA-256 hash of the token, not the plaintext.
   * The plaintext token is sent to the user via email.
   */
  @column()
  declare token: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /**
   * Check if token is expired
   */
  isExpired(): boolean {
    return this.expiresAt < DateTime.now()
  }

  /**
   * Hash a token using SHA-256
   */
  static hashToken(plainToken: string): string {
    return createHash('sha256').update(plainToken).digest('hex')
  }

  /**
   * Generate a random token and return both plaintext and hash
   */
  static generateToken(): { plainToken: string; hashedToken: string } {
    const plainToken = randomBytes(32).toString('hex')
    const hashedToken = PasswordResetToken.hashToken(plainToken)
    return { plainToken, hashedToken }
  }

  /**
   * Find a token by its plaintext value (hashes and looks up)
   */
  static async findByPlainToken(plainToken: string): Promise<PasswordResetToken | null> {
    const hashedToken = PasswordResetToken.hashToken(plainToken)
    return PasswordResetToken.query().where('token', hashedToken).preload('user').first()
  }

  /**
   * Delete a token by its plaintext value
   */
  static async deleteByPlainToken(plainToken: string): Promise<void> {
    const hashedToken = PasswordResetToken.hashToken(plainToken)
    await PasswordResetToken.query().where('token', hashedToken).delete()
  }
}

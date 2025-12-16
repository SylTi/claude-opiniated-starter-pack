import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type LoginMethod = 'password' | 'google' | 'github' | 'microsoft' | 'mfa'

export default class LoginHistory extends BaseModel {
  static table = 'login_history'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare ipAddress: string | null

  @column()
  declare userAgent: string | null

  @column()
  declare loginMethod: LoginMethod

  @column()
  declare success: boolean

  @column()
  declare failureReason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}

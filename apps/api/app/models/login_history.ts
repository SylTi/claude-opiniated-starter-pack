import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type LoginMethod = 'password' | 'google' | 'github' | 'microsoft' | 'mfa'

export default class LoginHistory extends BaseModel {
  static table = 'login_history'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_id' })
  declare userId: number

  @column({ columnName: 'ip_address' })
  declare ipAddress: string | null

  @column({ columnName: 'user_agent' })
  declare userAgent: string | null

  @column({ columnName: 'login_method' })
  declare loginMethod: LoginMethod

  @column()
  declare success: boolean

  @column({ columnName: 'failure_reason' })
  declare failureReason: string | null

  @column.dateTime({ columnName: 'created_at', autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>
}

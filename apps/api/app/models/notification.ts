import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import BaseModel from '#models/base_model'

export default class Notification extends BaseModel {
  static table = 'notifications'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare recipientId: number

  @column()
  declare pluginId: string | null

  @column()
  declare type: string

  @column()
  declare title: string

  @column()
  declare body: string | null

  @column()
  declare url: string | null

  @column()
  declare meta: Record<string, unknown> | null

  @column.dateTime()
  declare readAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}

import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import BaseModel from '#models/base_model'

/**
 * Tenant-scoped explicit permission grants for plugin-managed abilities.
 */
export default class PluginPermissionGrant extends BaseModel {
  static table = 'plugin_permission_grants'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare pluginId: string

  @column()
  declare userId: number

  @column()
  declare ability: string

  @column()
  declare resourceType: string

  @column()
  declare resourceId: string

  @column()
  declare grantedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}

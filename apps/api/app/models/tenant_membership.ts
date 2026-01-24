import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Tenant from '#models/tenant'

export type TenantRole = 'owner' | 'admin' | 'member'

export default class TenantMembership extends BaseModel {
  static table = 'tenant_memberships'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare tenantId: number

  @column()
  declare role: TenantRole

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  /**
   * Check if member has admin privileges (owner or admin)
   */
  isAdmin(): boolean {
    return this.role === 'owner' || this.role === 'admin'
  }

  /**
   * Check if member is owner
   */
  isOwner(): boolean {
    return this.role === 'owner'
  }
}

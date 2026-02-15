import { DateTime } from 'luxon'
import { column, belongsTo } from '@adonisjs/lucid/orm'
import BaseModel from '#models/base_model'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Tenant from '#models/tenant'
import User from '#models/user'
import { randomBytes } from 'node:crypto'

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'
export type InvitationRole = 'admin' | 'member' | 'viewer'

export default class TenantInvitation extends BaseModel {
  static table = 'tenant_invitations'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare invitedById: number

  @column()
  declare email: string

  @column()
  declare token: string

  @column()
  declare status: InvitationStatus

  @column()
  declare role: InvitationRole

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User, { foreignKey: 'invitedById' })
  declare invitedBy: BelongsTo<typeof User>

  /**
   * Generate a unique invitation token
   */
  static generateToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Check if invitation has expired
   */
  isExpired(): boolean {
    return DateTime.now() > this.expiresAt
  }

  /**
   * Check if invitation is still valid (pending and not expired)
   */
  isValid(): boolean {
    return this.status === 'pending' && !this.isExpired()
  }
}

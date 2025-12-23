import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Team from '#models/team'

export type TeamRole = 'owner' | 'admin' | 'member'

export default class TeamMember extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare teamId: number

  @column()
  declare role: TeamRole

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Team)
  declare team: BelongsTo<typeof Team>

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

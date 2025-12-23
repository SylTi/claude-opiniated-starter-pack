import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Subscription from '#models/subscription'

export default class SubscriptionTier extends BaseModel {
  static table = 'subscription_tiers'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column()
  declare name: string

  @column()
  declare level: number

  @column()
  declare maxTeamMembers: number | null

  @column()
  declare priceMonthly: number | null

  @column()
  declare yearlyDiscountPercent: number | null

  @column()
  declare features: Record<string, unknown> | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Subscription, { foreignKey: 'tierId' })
  declare subscriptions: HasMany<typeof Subscription>

  /**
   * Find tier by slug
   */
  static async findBySlug(slug: string): Promise<SubscriptionTier | null> {
    return this.query().where('slug', slug).first()
  }

  /**
   * Find tier by slug or fail
   */
  static async findBySlugOrFail(slug: string): Promise<SubscriptionTier> {
    return this.query().where('slug', slug).firstOrFail()
  }

  /**
   * Get the free tier
   */
  static async getFreeTier(): Promise<SubscriptionTier> {
    return this.findBySlugOrFail('free')
  }

  /**
   * Get all active tiers ordered by level
   */
  static async getActiveTiers(): Promise<SubscriptionTier[]> {
    return this.query().where('isActive', true).orderBy('level', 'asc')
  }

  /**
   * Check if this tier has access to another tier
   * (i.e., this tier's level is >= the other tier's level)
   */
  hasAccessToTier(other: SubscriptionTier): boolean {
    return this.level >= other.level
  }

  /**
   * Check if this tier has access to a tier by level
   */
  hasAccessToLevel(level: number): boolean {
    return this.level >= level
  }
}

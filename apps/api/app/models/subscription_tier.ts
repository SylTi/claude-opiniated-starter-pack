import { DateTime } from 'luxon'
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import BaseModel from '#models/base_model'
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
   *
   * @param slug - The tier slug to find
   * @param trx - Optional transaction client with RLS context set
   */
  static async findBySlug(
    slug: string,
    trx?: TransactionClientContract
  ): Promise<SubscriptionTier | null> {
    const queryOptions = trx ? { client: trx } : {}
    return this.query(queryOptions).where('slug', slug).first()
  }

  /**
   * Find tier by slug or fail
   *
   * @param slug - The tier slug to find
   * @param trx - Optional transaction client with RLS context set
   */
  static async findBySlugOrFail(
    slug: string,
    trx?: TransactionClientContract
  ): Promise<SubscriptionTier> {
    const queryOptions = trx ? { client: trx } : {}
    return this.query(queryOptions).where('slug', slug).firstOrFail()
  }

  /**
   * Get the free tier
   *
   * @param trx - Optional transaction client with RLS context set
   */
  static async getFreeTier(trx?: TransactionClientContract): Promise<SubscriptionTier> {
    return this.findBySlugOrFail('free', trx)
  }

  /**
   * Get all active tiers ordered by level
   *
   * @param trx - Optional transaction client with RLS context set
   */
  static async getActiveTiers(trx?: TransactionClientContract): Promise<SubscriptionTier[]> {
    const queryOptions = trx ? { client: trx } : {}
    return this.query(queryOptions).where('isActive', true).orderBy('level', 'asc')
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

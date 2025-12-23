import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import SubscriptionTier from '#models/subscription_tier'

export type SubscriberType = 'user' | 'team'
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'

export default class Subscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare subscriberType: SubscriberType

  @column()
  declare subscriberId: number

  @column()
  declare tierId: number

  @column()
  declare status: SubscriptionStatus

  @column.dateTime()
  declare startsAt: DateTime

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => SubscriptionTier, { foreignKey: 'tierId' })
  declare tier: BelongsTo<typeof SubscriptionTier>

  /**
   * Scope: only active subscriptions
   */
  static active = scope((query) => {
    query.where('status', 'active')
  })

  /**
   * Scope: subscriptions for a specific user
   */
  static forUser = scope((query, userId: number) => {
    query.where('subscriberType', 'user').where('subscriberId', userId)
  })

  /**
   * Scope: subscriptions for a specific team
   */
  static forTeam = scope((query, teamId: number) => {
    query.where('subscriberType', 'team').where('subscriberId', teamId)
  })

  /**
   * Check if subscription is currently active
   */
  isActive(): boolean {
    return this.status === 'active'
  }

  /**
   * Check if subscription is expired based on expires_at date
   */
  isExpired(): boolean {
    if (!this.expiresAt) return false
    return DateTime.now() > this.expiresAt
  }

  /**
   * Check if subscription should be marked as expired
   */
  shouldExpire(): boolean {
    return this.status === 'active' && this.isExpired()
  }

  /**
   * Get active subscription for a user
   */
  static async getActiveForUser(userId: number): Promise<Subscription | null> {
    return this.query()
      .withScopes((scopes) => scopes.forUser(userId))
      .withScopes((scopes) => scopes.active())
      .preload('tier')
      .orderBy('createdAt', 'desc')
      .first()
  }

  /**
   * Get active subscription for a team
   */
  static async getActiveForTeam(teamId: number): Promise<Subscription | null> {
    return this.query()
      .withScopes((scopes) => scopes.forTeam(teamId))
      .withScopes((scopes) => scopes.active())
      .preload('tier')
      .orderBy('createdAt', 'desc')
      .first()
  }

  /**
   * Get all subscriptions for a user (including history)
   */
  static async getAllForUser(userId: number): Promise<Subscription[]> {
    return this.query()
      .withScopes((scopes) => scopes.forUser(userId))
      .preload('tier')
      .orderBy('createdAt', 'desc')
  }

  /**
   * Get all subscriptions for a team (including history)
   */
  static async getAllForTeam(teamId: number): Promise<Subscription[]> {
    return this.query()
      .withScopes((scopes) => scopes.forTeam(teamId))
      .preload('tier')
      .orderBy('createdAt', 'desc')
  }

  /**
   * Create a new subscription for a user
   */
  static async createForUser(
    userId: number,
    tierId: number,
    expiresAt: DateTime | null = null
  ): Promise<Subscription> {
    const subscription = await this.create({
      subscriberType: 'user',
      subscriberId: userId,
      tierId,
      status: 'active',
      startsAt: DateTime.now(),
      expiresAt,
    })
    await subscription.load('tier')
    return subscription
  }

  /**
   * Create a new subscription for a team
   */
  static async createForTeam(
    teamId: number,
    tierId: number,
    expiresAt: DateTime | null = null
  ): Promise<Subscription> {
    const subscription = await this.create({
      subscriberType: 'team',
      subscriberId: teamId,
      tierId,
      status: 'active',
      startsAt: DateTime.now(),
      expiresAt,
    })
    await subscription.load('tier')
    return subscription
  }

  /**
   * Cancel all active subscriptions for a user and create a new free one
   */
  static async downgradeUserToFree(userId: number): Promise<Subscription> {
    // Cancel active subscriptions
    await this.query()
      .withScopes((scopes) => scopes.forUser(userId))
      .withScopes((scopes) => scopes.active())
      .update({ status: 'cancelled' })

    // Get free tier
    const freeTier = await SubscriptionTier.getFreeTier()

    // Create new free subscription
    return this.createForUser(userId, freeTier.id)
  }

  /**
   * Cancel all active subscriptions for a team and create a new free one
   */
  static async downgradeTeamToFree(teamId: number): Promise<Subscription> {
    // Cancel active subscriptions
    await this.query()
      .withScopes((scopes) => scopes.forTeam(teamId))
      .withScopes((scopes) => scopes.active())
      .update({ status: 'cancelled' })

    // Get free tier
    const freeTier = await SubscriptionTier.getFreeTier()

    // Create new free subscription
    return this.createForTeam(teamId, freeTier.id)
  }
}

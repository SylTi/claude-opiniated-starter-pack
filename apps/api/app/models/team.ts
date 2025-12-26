import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import TeamMember from '#models/team_member'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'

export default class Team extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare ownerId: number | null

  @column()
  declare maxMembers: number | null

  @column()
  declare balance: number

  @column()
  declare balanceCurrency: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'ownerId' })
  declare owner: BelongsTo<typeof User>

  @hasMany(() => TeamMember)
  declare members: HasMany<typeof TeamMember>

  /**
   * Get active subscription for this team
   */
  async getActiveSubscription(): Promise<Subscription | null> {
    return Subscription.getActiveForTeam(this.id)
  }

  /**
   * Get all subscriptions for this team (including history)
   */
  async getSubscriptions(): Promise<Subscription[]> {
    return Subscription.getAllForTeam(this.id)
  }

  /**
   * Get the active subscription tier for this team
   */
  async getSubscriptionTier(): Promise<SubscriptionTier> {
    // Query directly to ensure tier is always loaded
    const subscription = await Subscription.query()
      .where('subscriberType', 'team')
      .where('subscriberId', this.id)
      .where('status', 'active')
      .preload('tier')
      .orderBy('createdAt', 'desc')
      .first()

    if (subscription && subscription.tier) {
      return subscription.tier
    }
    return SubscriptionTier.getFreeTier()
  }

  /**
   * Check if team's subscription is expired
   */
  async isSubscriptionExpired(): Promise<boolean> {
    const subscription = await this.getActiveSubscription()
    if (!subscription) return false
    return subscription.isExpired()
  }

  /**
   * Check if team has access to a specific tier
   */
  async hasAccessToTier(tier: SubscriptionTier): Promise<boolean> {
    const currentTier = await this.getSubscriptionTier()
    if (await this.isSubscriptionExpired()) {
      const freeTier = await SubscriptionTier.getFreeTier()
      return freeTier.hasAccessToTier(tier)
    }
    return currentTier.hasAccessToTier(tier)
  }

  /**
   * Check if team has access to a tier by slug
   */
  async hasAccessToTierBySlug(tierSlug: string): Promise<boolean> {
    const tier = await SubscriptionTier.findBySlugOrFail(tierSlug)
    return this.hasAccessToTier(tier)
  }

  /**
   * Get effective max members based on subscription tier
   */
  async getEffectiveMaxMembers(): Promise<number | null> {
    if (this.maxMembers !== null) return this.maxMembers
    const tier = await this.getSubscriptionTier()
    return tier.maxTeamMembers
  }

  /**
   * Check if team can add more members
   */
  async canAddMember(currentMemberCount: number): Promise<boolean> {
    const max = await this.getEffectiveMaxMembers()
    if (max === null) return true // unlimited
    return currentMemberCount < max
  }

  /**
   * Add credit to team's balance
   */
  async addCredit(amount: number, currency?: string): Promise<number> {
    // Only check for currency mismatch if team already has a currency set
    if (this.balanceCurrency && currency && currency !== this.balanceCurrency) {
      throw new Error(`Currency mismatch: expected ${this.balanceCurrency}, got ${currency}`)
    }
    // Ensure both balance and amount are numbers (they might come as strings from DB)
    const currentBalance = Number(this.balance) || 0
    const creditAmount = Number(amount) || 0
    this.balance = currentBalance + creditAmount
    if (!this.balanceCurrency) {
      this.balanceCurrency = currency || 'usd'
    }
    await this.save()
    return this.balance
  }

  /**
   * Get team's balance
   */
  getBalance(): { balance: number; currency: string } {
    return {
      balance: this.balance || 0,
      currency: this.balanceCurrency || 'usd',
    }
  }
}

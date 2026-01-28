import { DateTime } from 'luxon'
import { column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import BaseModel from '#models/base_model'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import TenantMembership from '#models/tenant_membership'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'
import { CurrencyMismatchError } from '#exceptions/billing_errors'

export default class Tenant extends BaseModel {
  static table = 'tenants'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare type: 'personal' | 'team'

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

  @hasMany(() => TenantMembership)
  declare memberships: HasMany<typeof TenantMembership>

  /**
   * Get active subscription for this tenant
   *
   * @param trx - Optional transaction client with RLS context set
   */
  async getActiveSubscription(trx?: TransactionClientContract): Promise<Subscription | null> {
    return Subscription.getActiveForTenant(this.id, trx)
  }

  /**
   * Get all subscriptions for this tenant (including history)
   *
   * @param trx - Optional transaction client with RLS context set
   */
  async getSubscriptions(trx?: TransactionClientContract): Promise<Subscription[]> {
    return Subscription.getAllForTenant(this.id, trx)
  }

  /**
   * Get the active subscription tier for this tenant
   *
   * @param trx - Optional transaction client with RLS context set
   */
  async getSubscriptionTier(trx?: TransactionClientContract): Promise<SubscriptionTier> {
    const queryOptions = trx ? { client: trx } : {}
    const subscription = await Subscription.query(queryOptions)
      .where('tenantId', this.id)
      .where('status', 'active')
      .preload('tier')
      .orderBy('createdAt', 'desc')
      .first()

    if (subscription && subscription.tier) {
      return subscription.tier
    }
    return SubscriptionTier.getFreeTier(trx)
  }

  /**
   * Check if tenant's subscription is expired
   *
   * @param trx - Optional transaction client with RLS context set
   */
  async isSubscriptionExpired(trx?: TransactionClientContract): Promise<boolean> {
    const subscription = await this.getActiveSubscription(trx)
    if (!subscription) return false
    return subscription.isExpired()
  }

  /**
   * Check if tenant has access to a specific tier
   *
   * @param tier - The tier to check access for
   * @param trx - Optional transaction client with RLS context set
   */
  async hasAccessToTier(tier: SubscriptionTier, trx?: TransactionClientContract): Promise<boolean> {
    const currentTier = await this.getSubscriptionTier(trx)
    if (await this.isSubscriptionExpired(trx)) {
      const freeTier = await SubscriptionTier.getFreeTier(trx)
      return freeTier.hasAccessToTier(tier)
    }
    return currentTier.hasAccessToTier(tier)
  }

  /**
   * Check if tenant has access to a tier by slug
   *
   * @param tierSlug - The tier slug to check access for
   * @param trx - Optional transaction client with RLS context set
   */
  async hasAccessToTierBySlug(tierSlug: string, trx?: TransactionClientContract): Promise<boolean> {
    const tier = await SubscriptionTier.findBySlugOrFail(tierSlug, trx)
    return this.hasAccessToTier(tier, trx)
  }

  /**
   * Get effective max members based on subscription tier
   *
   * @param trx - Optional transaction client with RLS context set
   */
  async getEffectiveMaxMembers(trx?: TransactionClientContract): Promise<number | null> {
    if (this.maxMembers !== null) return this.maxMembers
    const tier = await this.getSubscriptionTier(trx)
    return tier.maxTeamMembers
  }

  /**
   * Check if tenant can add more members
   *
   * @param currentMemberCount - Current number of members
   * @param trx - Optional transaction client with RLS context set
   */
  async canAddMember(
    currentMemberCount: number,
    trx?: TransactionClientContract
  ): Promise<boolean> {
    const max = await this.getEffectiveMaxMembers(trx)
    if (max === null) return true // unlimited
    return currentMemberCount < max
  }

  /**
   * Add credit to tenant's balance
   */
  async addCredit(amount: number, currency?: string): Promise<number> {
    if (this.balanceCurrency && currency && currency !== this.balanceCurrency) {
      throw new CurrencyMismatchError(this.balanceCurrency, currency)
    }
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
   * Get tenant's balance
   */
  getBalance(): { balance: number; currency: string } {
    return {
      balance: this.balance || 0,
      currency: this.balanceCurrency || 'usd',
    }
  }

  /**
   * Check if this is a personal tenant
   */
  isPersonal(): boolean {
    return this.type === 'personal'
  }

  /**
   * Check if this is a team tenant
   */
  isTeam(): boolean {
    return this.type === 'team'
  }
}

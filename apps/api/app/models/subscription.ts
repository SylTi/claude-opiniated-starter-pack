import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import SubscriptionTier from '#models/subscription_tier'
import Tenant from '#models/tenant'

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'

export default class Subscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenantId: number

  @column()
  declare tierId: number

  @column()
  declare status: SubscriptionStatus

  @column.dateTime()
  declare startsAt: DateTime

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column()
  declare providerName: string | null

  @column()
  declare providerSubscriptionId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => SubscriptionTier, { foreignKey: 'tierId' })
  declare tier: BelongsTo<typeof SubscriptionTier>

  @belongsTo(() => Tenant, { foreignKey: 'tenantId' })
  declare tenant: BelongsTo<typeof Tenant>

  /**
   * Scope: only active subscriptions
   */
  static active = scope((query) => {
    query.where('status', 'active')
  })

  /**
   * Scope: subscriptions for a specific tenant
   */
  static forTenant = scope((query, tenantId: number) => {
    query.where('tenantId', tenantId)
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
   * Get active subscription for a tenant
   */
  static async getActiveForTenant(tenantId: number): Promise<Subscription | null> {
    return this.query()
      .withScopes((scopes) => scopes.forTenant(tenantId))
      .withScopes((scopes) => scopes.active())
      .preload('tier')
      .orderBy('createdAt', 'desc')
      .first()
  }

  /**
   * Get all subscriptions for a tenant (including history)
   */
  static async getAllForTenant(tenantId: number): Promise<Subscription[]> {
    return this.query()
      .withScopes((scopes) => scopes.forTenant(tenantId))
      .preload('tier')
      .orderBy('createdAt', 'desc')
  }

  /**
   * Create a new subscription for a tenant
   */
  static async createForTenant(
    tenantId: number,
    tierId: number,
    expiresAt: DateTime | null = null
  ): Promise<Subscription> {
    const subscription = await this.create({
      tenantId,
      tierId,
      status: 'active',
      startsAt: DateTime.now(),
      expiresAt,
    })
    await subscription.load('tier')
    return subscription
  }

  /**
   * Cancel all active subscriptions for a tenant and create a new free one
   */
  static async downgradeTenantToFree(tenantId: number): Promise<Subscription> {
    // Cancel active subscriptions
    await this.query()
      .withScopes((scopes) => scopes.forTenant(tenantId))
      .withScopes((scopes) => scopes.active())
      .update({ status: 'cancelled' })

    // Get free tier
    const freeTier = await SubscriptionTier.getFreeTier()

    // Create new free subscription
    return this.createForTenant(tenantId, freeTier.id)
  }

  /**
   * Find subscription by provider subscription ID
   */
  static async findByProviderSubscriptionId(
    providerName: string,
    providerSubscriptionId: string
  ): Promise<Subscription | null> {
    return this.query()
      .where('providerName', providerName)
      .where('providerSubscriptionId', providerSubscriptionId)
      .preload('tier')
      .first()
  }

  /**
   * Create subscription with provider info
   */
  static async createWithProvider(
    tenantId: number,
    tierId: number,
    providerName: string,
    providerSubscriptionId: string,
    expiresAt: DateTime | null = null
  ): Promise<Subscription> {
    const subscription = await this.create({
      tenantId,
      tierId,
      status: 'active',
      startsAt: DateTime.now(),
      expiresAt,
      providerName,
      providerSubscriptionId,
    })
    await subscription.load('tier')
    return subscription
  }
}

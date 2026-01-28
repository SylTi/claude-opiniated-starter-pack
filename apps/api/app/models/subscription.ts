import { DateTime } from 'luxon'
import { column, belongsTo, scope } from '@adonisjs/lucid/orm'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import BaseModel from '#models/base_model'
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
   *
   * @param tenantId - The tenant to get subscription for
   * @param trx - Optional transaction client with RLS context set
   */
  static async getActiveForTenant(
    tenantId: number,
    trx?: TransactionClientContract
  ): Promise<Subscription | null> {
    const queryOptions = trx ? { client: trx } : {}
    return this.query(queryOptions)
      .withScopes((scopes) => scopes.forTenant(tenantId))
      .withScopes((scopes) => scopes.active())
      .preload('tier')
      .orderBy('createdAt', 'desc')
      .first()
  }

  /**
   * Get all subscriptions for a tenant (including history)
   *
   * @param tenantId - The tenant to get subscriptions for
   * @param trx - Optional transaction client with RLS context set
   */
  static async getAllForTenant(
    tenantId: number,
    trx?: TransactionClientContract
  ): Promise<Subscription[]> {
    const queryOptions = trx ? { client: trx } : {}
    return this.query(queryOptions)
      .withScopes((scopes) => scopes.forTenant(tenantId))
      .preload('tier')
      .orderBy('createdAt', 'desc')
  }

  /**
   * Create a new subscription for a tenant
   *
   * @param tenantId - The tenant ID
   * @param tierId - The subscription tier ID
   * @param expiresAt - Optional expiration date
   * @param trx - Optional transaction client with RLS context set
   */
  static async createForTenant(
    tenantId: number,
    tierId: number,
    expiresAt: DateTime | null = null,
    trx?: TransactionClientContract
  ): Promise<Subscription> {
    const createOptions = trx ? { client: trx } : {}
    const subscription = await this.create(
      {
        tenantId,
        tierId,
        status: 'active',
        startsAt: DateTime.now(),
        expiresAt,
      },
      createOptions
    )
    if (trx) {
      subscription.useTransaction(trx)
    }
    await subscription.load('tier')
    return subscription
  }

  /**
   * Cancel all active subscriptions for a tenant and create a new free one
   *
   * @param tenantId - The tenant to downgrade
   * @param trx - Optional transaction client with RLS context already set
   *
   * When called from webhook handlers, pass the transaction that already has
   * RLS context set via setRlsContext(). This ensures all operations use the
   * same RLS context and transaction.
   */
  static async downgradeTenantToFree(
    tenantId: number,
    trx?: TransactionClientContract
  ): Promise<Subscription> {
    // Find and cancel active subscriptions
    const queryOptions = trx ? { client: trx } : {}
    const activeSubscriptions = await this.query(queryOptions)
      .withScopes((scopes) => scopes.forTenant(tenantId))
      .withScopes((scopes) => scopes.active())

    for (const sub of activeSubscriptions) {
      sub.status = 'cancelled'
      if (trx) sub.useTransaction(trx)
      await sub.save()
    }

    // Get free tier
    const freeTier = await SubscriptionTier.getFreeTier(trx)

    // Create new free subscription
    const subscription = new Subscription()
    subscription.tenantId = tenantId
    subscription.tierId = freeTier.id
    subscription.status = 'active'
    subscription.startsAt = DateTime.now()
    if (trx) subscription.useTransaction(trx)
    await subscription.save()
    await subscription.load('tier')
    return subscription
  }

  /**
   * Find subscription by provider subscription ID
   *
   * @param providerName - The payment provider name
   * @param providerSubscriptionId - The provider's subscription ID
   * @param trx - Optional transaction client with RLS context set
   */
  static async findByProviderSubscriptionId(
    providerName: string,
    providerSubscriptionId: string,
    trx?: TransactionClientContract
  ): Promise<Subscription | null> {
    const queryOptions = trx ? { client: trx } : {}
    return this.query(queryOptions)
      .where('providerName', providerName)
      .where('providerSubscriptionId', providerSubscriptionId)
      .preload('tier')
      .first()
  }

  /**
   * Create subscription with provider info
   *
   * @param tenantId - The tenant ID
   * @param tierId - The subscription tier ID
   * @param providerName - The payment provider name
   * @param providerSubscriptionId - The provider's subscription ID
   * @param expiresAt - Optional expiration date
   * @param trx - Optional transaction client with RLS context set
   */
  static async createWithProvider(
    tenantId: number,
    tierId: number,
    providerName: string,
    providerSubscriptionId: string,
    expiresAt: DateTime | null = null,
    trx?: TransactionClientContract
  ): Promise<Subscription> {
    const createOptions = trx ? { client: trx } : {}
    const subscription = await this.create(
      {
        tenantId,
        tierId,
        status: 'active',
        startsAt: DateTime.now(),
        expiresAt,
        providerName,
        providerSubscriptionId,
      },
      createOptions
    )
    if (trx) {
      subscription.useTransaction(trx)
    }
    await subscription.load('tier')
    return subscription
  }
}

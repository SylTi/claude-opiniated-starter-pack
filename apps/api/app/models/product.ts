import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import SubscriptionTier from '#models/subscription_tier'
import Price from '#models/price'

export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tierId: number

  @column()
  declare provider: string

  @column()
  declare providerProductId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => SubscriptionTier, { foreignKey: 'tierId' })
  declare tier: BelongsTo<typeof SubscriptionTier>

  @hasMany(() => Price, { foreignKey: 'productId' })
  declare prices: HasMany<typeof Price>

  /**
   * Find product by tier and provider
   */
  static async findByTierAndProvider(tierId: number, provider: string): Promise<Product | null> {
    return this.query().where('tierId', tierId).where('provider', provider).first()
  }

  /**
   * Find product by provider product ID
   */
  static async findByProviderProductId(
    provider: string,
    providerProductId: string
  ): Promise<Product | null> {
    return this.query()
      .where('provider', provider)
      .where('providerProductId', providerProductId)
      .first()
  }

  /**
   * Get all products for a provider with their tiers and prices
   */
  static async getProductsWithPrices(provider: string): Promise<Product[]> {
    return this.query()
      .where('provider', provider)
      .preload('tier')
      .preload('prices', (query) => {
        query.where('isActive', true).orderBy('interval', 'asc')
      })
      .orderBy('tierId', 'asc')
  }
}

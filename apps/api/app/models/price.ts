import { DateTime } from 'luxon'
import { column, belongsTo } from '@adonisjs/lucid/orm'
import BaseModel from '#models/base_model'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Product from '#models/product'

export type PriceInterval = 'month' | 'year'
export type TaxBehavior = 'inclusive' | 'exclusive'

export default class Price extends BaseModel {
  static table = 'prices'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare productId: number

  @column()
  declare provider: string

  @column()
  declare providerPriceId: string

  @column()
  declare interval: PriceInterval

  @column()
  declare currency: string

  @column()
  declare unitAmount: number

  @column()
  declare taxBehavior: TaxBehavior

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Product, { foreignKey: 'productId' })
  declare product: BelongsTo<typeof Product>

  /**
   * Find price by provider price ID
   */
  static async findByProviderPriceId(
    provider: string,
    providerPriceId: string
  ): Promise<Price | null> {
    return this.query()
      .where('provider', provider)
      .where('providerPriceId', providerPriceId)
      .preload('product', (query) => {
        query.preload('tier')
      })
      .first()
  }

  /**
   * Get active prices for a product
   */
  static async getActiveForProduct(productId: number): Promise<Price[]> {
    return this.query()
      .where('productId', productId)
      .where('isActive', true)
      .orderBy('interval', 'asc')
  }

  /**
   * Get all active prices for a provider
   */
  static async getActiveForProvider(provider: string): Promise<Price[]> {
    return this.query()
      .where('provider', provider)
      .where('isActive', true)
      .preload('product', (query) => {
        query.preload('tier')
      })
      .orderBy('productId', 'asc')
      .orderBy('interval', 'asc')
  }
}

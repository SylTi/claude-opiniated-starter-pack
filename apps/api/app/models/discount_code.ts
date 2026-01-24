import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, beforeSave } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import DiscountCodeUsage from '#models/discount_code_usage'

export type DiscountType = 'percent' | 'fixed'

export default class DiscountCode extends BaseModel {
  static table = 'discount_codes'

  @beforeSave()
  static async uppercaseCode(discountCode: DiscountCode): Promise<void> {
    if (discountCode.code) {
      discountCode.code = discountCode.code.toUpperCase()
    }
  }

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare description: string | null

  @column()
  declare discountType: DiscountType

  @column()
  declare discountValue: number

  @column()
  declare currency: string | null

  @column()
  declare minAmount: number | null

  @column()
  declare maxUses: number | null

  @column()
  declare maxUsesPerTenant: number | null

  @column()
  declare timesUsed: number

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => DiscountCodeUsage)
  declare usages: HasMany<typeof DiscountCodeUsage>

  isExpired(): boolean {
    if (!this.expiresAt) return false
    return DateTime.now() > this.expiresAt
  }

  isUsable(): boolean {
    if (!this.isActive) return false
    if (this.isExpired()) return false
    if (this.maxUses !== null && this.timesUsed >= this.maxUses) return false
    return true
  }

  /**
   * Check if discount code can be used by a tenant
   * @param tenantId - Tenant is the billing unit
   */
  async canBeUsedByTenant(tenantId: number): Promise<boolean> {
    if (!this.isUsable()) return false
    if (this.maxUsesPerTenant === null) return true

    const usageCount = await DiscountCodeUsage.query()
      .where('discountCodeId', this.id)
      .where('tenantId', tenantId)
      .count('* as total')

    const count = Number(usageCount[0].$extras.total)
    return count < this.maxUsesPerTenant
  }

  calculateDiscount(amount: number): number {
    if (this.discountType === 'percent') {
      return Math.round((amount * this.discountValue) / 100)
    }
    return Math.min(this.discountValue, amount)
  }

  static async findByCode(code: string): Promise<DiscountCode | null> {
    return this.query().where('code', code.toUpperCase()).first()
  }

  static async findByCodeOrFail(code: string): Promise<DiscountCode> {
    return this.query().where('code', code.toUpperCase()).firstOrFail()
  }
}

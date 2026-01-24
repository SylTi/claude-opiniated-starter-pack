import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeSave } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Tenant from '#models/tenant'

export default class Coupon extends BaseModel {
  static table = 'coupons'

  @beforeSave()
  static async uppercaseCode(coupon: Coupon): Promise<void> {
    if (coupon.code) {
      coupon.code = coupon.code.toUpperCase()
    }
  }

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare description: string | null

  @column()
  declare creditAmount: number

  @column()
  declare currency: string

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column()
  declare isActive: boolean

  // WHO redeemed the coupon (audit trail)
  @column()
  declare redeemedByUserId: number | null

  // Which tenant received the credit (billing context)
  @column()
  declare redeemedForTenantId: number | null

  @column.dateTime()
  declare redeemedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // WHO redeemed it (audit trail)
  @belongsTo(() => User, { foreignKey: 'redeemedByUserId' })
  declare redeemedByUser: BelongsTo<typeof User>

  // Which tenant got the credit (billing context)
  @belongsTo(() => Tenant, { foreignKey: 'redeemedForTenantId' })
  declare redeemedForTenant: BelongsTo<typeof Tenant>

  isExpired(): boolean {
    if (!this.expiresAt) return false
    return DateTime.now() > this.expiresAt
  }

  isRedeemed(): boolean {
    return this.redeemedForTenantId !== null
  }

  isRedeemable(): boolean {
    if (!this.isActive) return false
    if (this.isExpired()) return false
    if (this.isRedeemed()) return false
    return true
  }

  /**
   * Mark coupon as redeemed
   * @param tenantId - Which tenant received the credit (billing context)
   * @param userId - Who performed the redemption (audit trail)
   */
  async redeem(tenantId: number, userId: number): Promise<void> {
    this.redeemedForTenantId = tenantId
    this.redeemedByUserId = userId
    this.redeemedAt = DateTime.now()
    this.isActive = false
    await this.save()
  }

  /**
   * Redeem coupon for a tenant (tenant is the billing unit)
   * Uses transaction with row locking to prevent race conditions (double-spending)
   * @param tenantId - Which tenant receives the credit
   * @param userId - Who is performing the redemption (audit)
   * @returns New tenant balance
   */
  async redeemForTenant(tenantId: number, userId: number): Promise<number> {
    return await db.transaction(async (trx) => {
      // Re-fetch coupon with row lock to prevent race conditions
      const lockedCoupon = await Coupon.query({ client: trx })
        .where('id', this.id)
        .forUpdate()
        .firstOrFail()

      if (!lockedCoupon.isRedeemable()) {
        throw new Error('Coupon is not redeemable')
      }

      const tenant = await Tenant.query({ client: trx })
        .where('id', tenantId)
        .forUpdate()
        .firstOrFail()

      // Mark coupon as redeemed
      lockedCoupon.redeemedForTenantId = tenantId
      lockedCoupon.redeemedByUserId = userId
      lockedCoupon.redeemedAt = DateTime.now()
      lockedCoupon.isActive = false
      lockedCoupon.useTransaction(trx)
      await lockedCoupon.save()

      // Add credit to tenant
      const currentBalance = Number(tenant.balance) || 0
      const creditAmount = Number(lockedCoupon.creditAmount) || 0
      tenant.balance = currentBalance + creditAmount
      if (!tenant.balanceCurrency) {
        tenant.balanceCurrency = lockedCoupon.currency || 'usd'
      }
      tenant.useTransaction(trx)
      await tenant.save()

      return tenant.balance
    })
  }

  static async findByCode(code: string): Promise<Coupon | null> {
    return this.query().where('code', code.toUpperCase()).first()
  }

  static async findByCodeOrFail(code: string): Promise<Coupon> {
    return this.query().where('code', code.toUpperCase()).firstOrFail()
  }
}

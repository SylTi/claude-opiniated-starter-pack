import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeSave } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

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

  @column()
  declare redeemedByUserId: number | null

  @column.dateTime()
  declare redeemedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'redeemedByUserId' })
  declare redeemedByUser: BelongsTo<typeof User>

  isExpired(): boolean {
    if (!this.expiresAt) return false
    return DateTime.now() > this.expiresAt
  }

  isRedeemed(): boolean {
    return this.redeemedByUserId !== null
  }

  isRedeemable(): boolean {
    if (!this.isActive) return false
    if (this.isExpired()) return false
    if (this.isRedeemed()) return false
    return true
  }

  async redeem(userId: number): Promise<void> {
    this.redeemedByUserId = userId
    this.redeemedAt = DateTime.now()
    this.isActive = false
    await this.save()
  }

  async redeemForUser(userId: number): Promise<number> {
    if (!this.isRedeemable()) {
      throw new Error('Coupon is not redeemable')
    }

    const user = await User.findOrFail(userId)
    await this.redeem(userId)
    const newBalance = await user.addCredit(this.creditAmount, this.currency)
    return newBalance
  }

  async redeemForTeam(teamId: number, userId: number): Promise<number> {
    if (!this.isRedeemable()) {
      throw new Error('Coupon is not redeemable')
    }

    const { default: Team } = await import('#models/team')
    const team = await Team.findOrFail(teamId)
    await this.redeem(userId)
    const newBalance = await team.addCredit(this.creditAmount, this.currency)
    return newBalance
  }

  static async findByCode(code: string): Promise<Coupon | null> {
    return this.query().where('code', code.toUpperCase()).first()
  }

  static async findByCodeOrFail(code: string): Promise<Coupon> {
    return this.query().where('code', code.toUpperCase()).firstOrFail()
  }
}

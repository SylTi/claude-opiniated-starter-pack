import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import DiscountCode from '#models/discount_code'
import User from '#models/user'

export default class DiscountCodeUsage extends BaseModel {
  static table = 'discount_code_usages'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare discountCodeId: number

  @column()
  declare userId: number

  @column.dateTime()
  declare usedAt: DateTime

  @column()
  declare checkoutSessionId: string | null

  @belongsTo(() => DiscountCode)
  declare discountCode: BelongsTo<typeof DiscountCode>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  static async recordUsage(
    discountCodeId: number,
    userId: number,
    checkoutSessionId?: string | null
  ): Promise<DiscountCodeUsage> {
    const usage = await this.create({
      discountCodeId,
      userId,
      usedAt: DateTime.now(),
      checkoutSessionId: checkoutSessionId ?? null,
    })

    await DiscountCode.query().where('id', discountCodeId).increment('times_used', 1)

    return usage
  }

  static async countByUserAndCode(userId: number, discountCodeId: number): Promise<number> {
    const result = await this.query()
      .where('discountCodeId', discountCodeId)
      .where('userId', userId)
      .count('* as total')

    return Number(result[0].$extras.total)
  }
}

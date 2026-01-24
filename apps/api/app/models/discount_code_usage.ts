import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import DiscountCode from '#models/discount_code'
import User from '#models/user'
import Tenant from '#models/tenant'

export default class DiscountCodeUsage extends BaseModel {
  static table = 'discount_code_usages'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare discountCodeId: number

  // Billing context - which tenant used the discount
  @column()
  declare tenantId: number

  // Audit trail - who performed the action
  @column()
  declare userId: number

  @column.dateTime()
  declare usedAt: DateTime

  @column()
  declare checkoutSessionId: string | null

  @belongsTo(() => DiscountCode)
  declare discountCode: BelongsTo<typeof DiscountCode>

  // Billing context
  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  // Audit trail
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /**
   * Record discount code usage
   * @param discountCodeId - The discount code that was used
   * @param tenantId - Which tenant used the discount (billing context)
   * @param userId - Who performed the action (audit trail)
   * @param checkoutSessionId - Optional checkout session reference
   */
  static async recordUsage(
    discountCodeId: number,
    tenantId: number,
    userId: number,
    checkoutSessionId?: string | null
  ): Promise<DiscountCodeUsage> {
    const usage = await this.create({
      discountCodeId,
      tenantId,
      userId,
      usedAt: DateTime.now(),
      checkoutSessionId: checkoutSessionId ?? null,
    })

    await DiscountCode.query().where('id', discountCodeId).increment('times_used', 1)

    return usage
  }

  /**
   * Count usages by tenant and discount code (for billing limits)
   */
  static async countByTenantAndCode(tenantId: number, discountCodeId: number): Promise<number> {
    const result = await this.query()
      .where('discountCodeId', discountCodeId)
      .where('tenantId', tenantId)
      .count('* as total')

    return Number(result[0].$extras.total)
  }

  /**
   * @deprecated Use countByTenantAndCode - Tenant is the billing unit
   */
  static async countByUserAndCode(userId: number, discountCodeId: number): Promise<number> {
    const result = await this.query()
      .where('discountCodeId', discountCodeId)
      .where('userId', userId)
      .count('* as total')

    return Number(result[0].$extras.total)
  }
}

import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Tenant from '#models/tenant'

export default class PaymentCustomer extends BaseModel {
  static table = 'payment_customers'

  @column({ isPrimary: true })
  declare id: number

  // Tenant is the billing unit - each tenant has one payment customer per provider
  @column()
  declare tenantId: number

  @column()
  declare provider: string

  @column()
  declare providerCustomerId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Tenant)
  declare tenant: BelongsTo<typeof Tenant>

  /**
   * Find payment customer by tenant and provider
   */
  static async findByTenant(tenantId: number, provider: string): Promise<PaymentCustomer | null> {
    return PaymentCustomer.query().where('tenantId', tenantId).where('provider', provider).first()
  }

  /**
   * Find or create a payment customer for a tenant
   */
  static async findOrCreateByTenant(
    tenantId: number,
    provider: string,
    providerCustomerId: string
  ): Promise<PaymentCustomer> {
    const existing = await PaymentCustomer.findByTenant(tenantId, provider)
    if (existing) {
      return existing
    }

    return PaymentCustomer.create({
      tenantId,
      provider,
      providerCustomerId,
    })
  }

  /**
   * Update or create a payment customer for a tenant (upsert)
   */
  static async upsertByTenant(
    tenantId: number,
    provider: string,
    providerCustomerId: string
  ): Promise<PaymentCustomer> {
    const existing = await PaymentCustomer.findByTenant(tenantId, provider)

    if (existing) {
      existing.providerCustomerId = providerCustomerId
      await existing.save()
      return existing
    }

    return PaymentCustomer.create({
      tenantId,
      provider,
      providerCustomerId,
    })
  }

  /**
   * Find by provider customer ID
   */
  static async findByProviderCustomerId(
    provider: string,
    providerCustomerId: string
  ): Promise<PaymentCustomer | null> {
    return PaymentCustomer.query()
      .where('provider', provider)
      .where('providerCustomerId', providerCustomerId)
      .first()
  }
}

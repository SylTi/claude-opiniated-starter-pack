import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type SubscriberType = 'user' | 'team'

export default class PaymentCustomer extends BaseModel {
  static table = 'payment_customers'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare subscriberType: SubscriberType

  @column()
  declare subscriberId: number

  @column()
  declare provider: string

  @column()
  declare providerCustomerId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  /**
   * Find payment customer by subscriber
   */
  static async findBySubscriber(
    subscriberType: SubscriberType,
    subscriberId: number,
    provider: string
  ): Promise<PaymentCustomer | null> {
    return PaymentCustomer.query()
      .where('subscriberType', subscriberType)
      .where('subscriberId', subscriberId)
      .where('provider', provider)
      .first()
  }

  /**
   * Find or create a payment customer for a subscriber
   */
  static async findOrCreateBySubscriber(
    subscriberType: SubscriberType,
    subscriberId: number,
    provider: string,
    providerCustomerId: string
  ): Promise<PaymentCustomer> {
    const existing = await PaymentCustomer.findBySubscriber(subscriberType, subscriberId, provider)
    if (existing) {
      return existing
    }

    return PaymentCustomer.create({
      subscriberType,
      subscriberId,
      provider,
      providerCustomerId,
    })
  }

  /**
   * Update or create a payment customer for a subscriber (upsert)
   */
  static async upsertBySubscriber(
    subscriberType: SubscriberType,
    subscriberId: number,
    provider: string,
    providerCustomerId: string
  ): Promise<PaymentCustomer> {
    const existing = await PaymentCustomer.findBySubscriber(subscriberType, subscriberId, provider)

    if (existing) {
      existing.providerCustomerId = providerCustomerId
      await existing.save()
      return existing
    }

    return PaymentCustomer.create({
      subscriberType,
      subscriberId,
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

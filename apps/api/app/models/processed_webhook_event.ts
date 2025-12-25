import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ProcessedWebhookEvent extends BaseModel {
  static table = 'processed_webhook_events'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare eventId: string

  @column()
  declare provider: string

  @column()
  declare eventType: string | null

  @column.dateTime()
  declare processedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  /**
   * Check if an event has already been processed
   */
  static async hasBeenProcessed(eventId: string, provider: string): Promise<boolean> {
    const event = await this.query().where('eventId', eventId).where('provider', provider).first()
    return event !== null
  }

  /**
   * Mark an event as processed
   */
  static async markAsProcessed(
    eventId: string,
    provider: string,
    eventType?: string
  ): Promise<ProcessedWebhookEvent> {
    return this.create({
      eventId,
      provider,
      eventType: eventType ?? null,
      processedAt: DateTime.now(),
    })
  }

  /**
   * Clean up old processed events (for maintenance)
   * Removes events older than the specified number of days
   */
  static async cleanupOldEvents(daysOld: number = 30): Promise<number> {
    const cutoff = DateTime.now().minus({ days: daysOld })
    const result = await this.query().where('processedAt', '<', cutoff.toSQL()).delete()
    return result[0] ?? 0
  }
}

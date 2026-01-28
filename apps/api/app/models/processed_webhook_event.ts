import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import BaseModel from '#models/base_model'

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
   *
   * @deprecated Use SystemOperationService.cleanupOldWebhookEvents() instead.
   *             This method is kept for backwards compatibility but delegates to the service.
   *
   * NOTE: This is a system maintenance operation that runs outside HttpContext.
   * Prefer using the centralized SystemOperationService for privileged operations.
   */
  static async cleanupOldEvents(daysOld: number = 30): Promise<number> {
    // Import inline to avoid circular dependency
    const { systemOps } = await import('#services/system_operation_service')
    return systemOps.cleanupOldWebhookEvents(daysOld)
  }
}

import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import SubscriptionService from '#services/subscription_service'

export default class CheckExpiredSubscriptions extends BaseCommand {
  static commandName = 'check:expired-subscriptions'
  static description = 'Check and expire subscriptions that have passed their expiration date'

  static options: CommandOptions = {
    startApp: true,
  }

  async run(): Promise<void> {
    this.logger.info('Starting subscription expiration check...')

    const subscriptionService = new SubscriptionService()

    try {
      // All subscriptions are tenant-based (tenant is the billing unit)
      const expiredSubscriptions = await subscriptionService.processExpiredSubscriptions()

      this.logger.info(`Found ${expiredSubscriptions.length} expired tenant subscriptions`)

      // Send expiration emails
      for (const subscription of expiredSubscriptions) {
        try {
          await subscriptionService.sendExpirationEmail(subscription)
          this.logger.info(`Sent expiration email to tenant owner: ${subscription.ownerEmail}`)
        } catch (error) {
          this.logger.error(`Failed to send email to ${subscription.ownerEmail}: ${error}`)
        }
      }

      this.logger.success(`Processed ${expiredSubscriptions.length} expired subscriptions`)
    } catch (error) {
      this.logger.error(`Error processing subscriptions: ${error}`)
      throw error
    }
  }
}

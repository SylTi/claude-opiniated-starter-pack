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
      const { expiredUsers, expiredTeams } = await subscriptionService.processExpiredSubscriptions()

      this.logger.info(`Found ${expiredUsers.length} expired user subscriptions`)
      this.logger.info(`Found ${expiredTeams.length} expired team subscriptions`)

      // Send expiration emails
      for (const user of expiredUsers) {
        try {
          await subscriptionService.sendExpirationEmail(user)
          this.logger.info(`Sent expiration email to user: ${user.email}`)
        } catch (error) {
          this.logger.error(`Failed to send email to ${user.email}: ${error}`)
        }
      }

      for (const team of expiredTeams) {
        try {
          await subscriptionService.sendExpirationEmail(team)
          this.logger.info(`Sent expiration email to team owner: ${team.email}`)
        } catch (error) {
          this.logger.error(`Failed to send email to ${team.email}: ${error}`)
        }
      }

      this.logger.success(
        `Processed ${expiredUsers.length + expiredTeams.length} expired subscriptions`
      )
    } catch (error) {
      this.logger.error(`Error processing subscriptions: ${error}`)
      throw error
    }
  }
}

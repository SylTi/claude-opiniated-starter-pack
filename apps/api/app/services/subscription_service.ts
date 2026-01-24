import { DateTime } from 'luxon'
import Subscription from '#models/subscription'
import SubscriptionTier from '#models/subscription_tier'
import env from '#start/env'

interface ExpiredSubscription {
  tenantId: number
  tenantName: string
  ownerEmail: string
  previousTier: string
  expiresAt: string
}

export default class SubscriptionService {
  private appUrl: string

  constructor() {
    this.appUrl = env.get('APP_URL', 'http://localhost:3000')
  }

  /**
   * Find and expire all subscriptions that have passed their expiration date
   * All subscriptions are tenant-based (tenant is the billing unit)
   */
  async processExpiredSubscriptions(): Promise<ExpiredSubscription[]> {
    const now = DateTime.now()
    const expiredTenants: ExpiredSubscription[] = []

    // Get free tier for comparison
    const freeTier = await SubscriptionTier.getFreeTier()

    // Find expired active subscriptions
    const subscriptionsToExpire = await Subscription.query()
      .where('status', 'active')
      .whereNot('tierId', freeTier.id)
      .whereNotNull('expiresAt')
      .where('expiresAt', '<=', now.toSQL())
      .preload('tier')
      .preload('tenant', (query) => {
        query.preload('owner')
      })

    for (const subscription of subscriptionsToExpire) {
      const tenant = subscription.tenant
      if (!tenant) continue

      const ownerEmail = tenant.owner?.email

      if (ownerEmail) {
        expiredTenants.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          ownerEmail,
          previousTier: subscription.tier.slug,
          expiresAt: subscription.expiresAt?.toISO() ?? '',
        })
      }

      // Expire the current subscription and create a free one
      subscription.status = 'expired'
      await subscription.save()
      await Subscription.createForTenant(tenant.id, freeTier.id)
    }

    return expiredTenants
  }

  /**
   * Update tenant subscription tier
   */
  async updateTenantSubscription(
    tenantId: number,
    tierSlug: string,
    expiresAt: DateTime | null = null
  ): Promise<Subscription> {
    const tier = await SubscriptionTier.findBySlugOrFail(tierSlug)

    // Cancel current active subscription
    await Subscription.query()
      .where('tenantId', tenantId)
      .where('status', 'active')
      .update({ status: 'cancelled' })

    // Create new subscription
    return Subscription.createForTenant(tenantId, tier.id, expiresAt)
  }

  /**
   * Generate HTML email for subscription expiration
   */
  generateExpirationEmailHtml(subscription: ExpiredSubscription): string {
    const renewUrl = `${this.appUrl}/subscription/renew`
    const tierLabel = this.getTierLabel(subscription.previousTier)

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Expired</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="background-color: #ef4444; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Subscription Expired</h1>
    </div>

    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
        Hello,
      </p>

      <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
        The <strong>${tierLabel}</strong> subscription for <strong>${subscription.tenantName}</strong> has expired on <strong>${new Date(subscription.expiresAt).toLocaleDateString()}</strong>.
      </p>

      <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
        Your workspace has been downgraded to the <strong>Free</strong> plan. Some features may no longer be available.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${renewUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Renew Subscription
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
        If you have any questions, please contact our support team.
      </p>
    </div>

    <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">
        This email was sent because your subscription expired.
      </p>
    </div>
  </div>
</body>
</html>
`
  }

  /**
   * Generate plain text email for subscription expiration
   */
  generateExpirationEmailText(subscription: ExpiredSubscription): string {
    const renewUrl = `${this.appUrl}/subscription/renew`
    const tierLabel = this.getTierLabel(subscription.previousTier)

    return `
Hello,

The ${tierLabel} subscription for "${subscription.tenantName}" has expired on ${new Date(subscription.expiresAt).toLocaleDateString()}.

Your workspace has been downgraded to the Free plan. Some features may no longer be available.

To renew your subscription, visit: ${renewUrl}

If you have any questions, please contact our support team.
`
  }

  /**
   * Get human-readable tier label from slug
   */
  private getTierLabel(tierSlug: string): string {
    const labels: Record<string, string> = {
      free: 'Free',
      tier1: 'Tier 1',
      tier2: 'Tier 2',
    }
    return labels[tierSlug] || tierSlug
  }

  /**
   * Send expiration email (placeholder - to be implemented with actual email service)
   */
  async sendExpirationEmail(subscription: ExpiredSubscription): Promise<void> {
    const htmlContent = this.generateExpirationEmailHtml(subscription)
    const textContent = this.generateExpirationEmailText(subscription)

    // TODO: Implement actual email sending when email service is configured
    // For now, log the email details
    console.log('='.repeat(60))
    console.log(`EXPIRATION EMAIL TO: ${subscription.ownerEmail}`)
    console.log(`SUBJECT: Your ${subscription.previousTier} subscription has expired`)
    console.log('-'.repeat(60))
    console.log('TEXT VERSION:')
    console.log(textContent)
    console.log('-'.repeat(60))
    console.log('HTML VERSION LENGTH:', htmlContent.length, 'characters')
    console.log('='.repeat(60))

    // Example implementation with nodemailer or other service:
    // await this.mailer.send({
    //   to: subscription.ownerEmail,
    //   subject: `Your ${subscription.previousTier} subscription has expired`,
    //   html,
    //   text,
    // })
  }
}

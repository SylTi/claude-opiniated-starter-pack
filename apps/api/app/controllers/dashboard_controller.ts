import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import LoginHistory from '#models/login_history'
import OAuthAccount from '#models/oauth_account'
import Subscription from '#models/subscription'

export default class DashboardController {
  /**
   * Get user-specific dashboard statistics
   */
  async getUserStats({ auth, response }: HttpContext): Promise<void> {
    const user = auth.user!

    // Calculate account age
    const accountCreated = user.createdAt
    const now = DateTime.now()
    const accountAgeDays = Math.floor(now.diff(accountCreated, 'days').days)

    // Get login statistics
    const totalLogins = await LoginHistory.query()
      .where('userId', user.id)
      .where('success', true)
      .count('* as total')

    const lastLogin = await LoginHistory.query()
      .where('userId', user.id)
      .where('success', true)
      .orderBy('createdAt', 'desc')
      .first()

    // Get recent login history (last 5)
    const recentLogins = await LoginHistory.query()
      .where('userId', user.id)
      .orderBy('createdAt', 'desc')
      .limit(5)

    // Get connected OAuth accounts count
    const connectedAccounts = await OAuthAccount.query()
      .where('userId', user.id)
      .count('* as total')

    // Get subscription info for user's current tenant (tenant is the billing unit)
    let subscriptionTier = 'free'
    let subscriptionExpiresAt: string | null = null
    if (user.currentTenantId) {
      const subscription = await Subscription.getActiveForTenant(user.currentTenantId)
      subscriptionTier = subscription?.tier?.slug ?? 'free'
      subscriptionExpiresAt = subscription?.expiresAt?.toISO() ?? null
    }

    response.json({
      data: {
        accountAgeDays,
        totalLogins: Number(totalLogins[0].$extras.total),
        lastLoginAt: lastLogin?.createdAt.toISO() ?? null,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        subscriptionTier,
        subscriptionExpiresAt,
        connectedOAuthAccounts: Number(connectedAccounts[0].$extras.total),
        recentActivity: recentLogins.map((login) => ({
          method: login.loginMethod,
          success: login.success,
          ipAddress: login.ipAddress,
          createdAt: login.createdAt.toISO(),
        })),
      },
    })
  }
}

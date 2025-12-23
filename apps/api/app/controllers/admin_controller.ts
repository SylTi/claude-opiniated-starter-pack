import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import LoginHistory from '#models/login_history'
import Team from '#models/team'
import SubscriptionTier from '#models/subscription_tier'
import SubscriptionService from '#services/subscription_service'

export default class AdminController {
  /**
   * Get admin dashboard statistics
   */
  async getStats({ response }: HttpContext): Promise<void> {
    const totalUsers = await User.query().count('* as total')
    const verifiedUsers = await User.query().where('emailVerified', true).count('* as total')
    const mfaEnabledUsers = await User.query().where('mfaEnabled', true).count('* as total')

    const now = DateTime.now()
    const thirtyDaysAgo = now.minus({ days: 30 })
    const sevenDaysAgo = now.minus({ days: 7 })

    const newUsersThisMonth = await User.query()
      .where('createdAt', '>=', thirtyDaysAgo.toSQL())
      .count('* as total')

    const activeSessionsThisWeek = await LoginHistory.query()
      .where('createdAt', '>=', sevenDaysAgo.toSQL())
      .where('success', true)
      .countDistinct('userId as total')

    const usersByRole = await User.query().select('role').count('* as count').groupBy('role')

    response.json({
      data: {
        totalUsers: Number(totalUsers[0].$extras.total),
        verifiedUsers: Number(verifiedUsers[0].$extras.total),
        mfaEnabledUsers: Number(mfaEnabledUsers[0].$extras.total),
        newUsersThisMonth: Number(newUsersThisMonth[0].$extras.total),
        activeUsersThisWeek: Number(activeSessionsThisWeek[0].$extras.total),
        usersByRole: usersByRole.map((r) => ({
          role: r.role,
          count: Number(r.$extras.count),
        })),
      },
    })
  }

  /**
   * List all users with admin details
   */
  async listUsers({ response }: HttpContext): Promise<void> {
    const users = await User.query()
      .select(
        'id',
        'email',
        'fullName',
        'role',
        'currentTeamId',
        'emailVerified',
        'emailVerifiedAt',
        'mfaEnabled',
        'avatarUrl',
        'createdAt',
        'updatedAt'
      )
      .preload('currentTeam')
      .orderBy('createdAt', 'desc')

    // Get subscriptions for all users
    const usersWithSubscriptions = await Promise.all(
      users.map(async (user) => {
        const subscription = await user.getActiveSubscription()
        return {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          subscriptionTier: subscription?.tier?.slug ?? 'free',
          subscriptionExpiresAt: subscription?.expiresAt?.toISO() ?? null,
          currentTeamId: user.currentTeamId,
          currentTeamName: user.currentTeam?.name ?? null,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt?.toISO() ?? null,
          mfaEnabled: user.mfaEnabled,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt.toISO(),
          updatedAt: user.updatedAt?.toISO() ?? null,
        }
      })
    )

    response.json({
      data: usersWithSubscriptions,
    })
  }

  /**
   * Manually verify a user's email
   */
  async verifyUserEmail({ params, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)

    if (user.emailVerified) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'User email is already verified',
      })
    }

    user.emailVerified = true
    user.emailVerifiedAt = DateTime.now()
    await user.save()

    response.json({
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt?.toISO(),
      },
      message: 'User email has been verified successfully',
    })
  }

  /**
   * Manually unverify a user's email (for testing purposes)
   */
  async unverifyUserEmail({ params, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)

    if (!user.emailVerified) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'User email is already unverified',
      })
    }

    user.emailVerified = false
    user.emailVerifiedAt = null
    await user.save()

    response.json({
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        emailVerifiedAt: null,
      },
      message: 'User email has been unverified successfully',
    })
  }

  /**
   * Delete a user
   */
  async deleteUser({ params, auth, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)
    const currentUser = auth.user!

    if (user.id === currentUser.id) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'You cannot delete your own account from admin panel',
      })
    }

    await user.delete()

    response.json({
      message: 'User has been deleted successfully',
    })
  }

  /**
   * Update user's subscription tier
   */
  async updateUserTier({ params, request, response }: HttpContext): Promise<void> {
    const user = await User.findOrFail(params.id)
    const { subscriptionTier, subscriptionExpiresAt } = request.only([
      'subscriptionTier',
      'subscriptionExpiresAt',
    ])

    // Validate tier exists
    const tier = await SubscriptionTier.findBySlug(subscriptionTier)
    if (!tier) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Invalid subscription tier',
      })
    }

    // Parse expiration date
    let expiresAt: DateTime | null = null
    if (subscriptionTier !== 'free' && subscriptionExpiresAt) {
      expiresAt = DateTime.fromISO(subscriptionExpiresAt)
    }

    // Use subscription service to update
    const subscriptionService = new SubscriptionService()
    const subscription = await subscriptionService.updateUserSubscription(
      user.id,
      subscriptionTier,
      expiresAt
    )

    response.json({
      data: {
        id: user.id,
        email: user.email,
        subscriptionTier: tier.slug,
        subscriptionExpiresAt: subscription.expiresAt?.toISO() ?? null,
      },
      message: 'User subscription tier has been updated successfully',
    })
  }

  /**
   * List all teams with admin details
   */
  async listTeams({ response }: HttpContext): Promise<void> {
    const teams = await Team.query()
      .preload('owner')
      .preload('members')
      .orderBy('createdAt', 'desc')

    // Get subscriptions for all teams
    const teamsWithSubscriptions = await Promise.all(
      teams.map(async (team) => {
        const subscription = await team.getActiveSubscription()
        return {
          id: team.id,
          name: team.name,
          slug: team.slug,
          subscriptionTier: subscription?.tier?.slug ?? 'free',
          subscriptionExpiresAt: subscription?.expiresAt?.toISO() ?? null,
          ownerId: team.ownerId,
          ownerEmail: team.owner?.email ?? null,
          memberCount: team.members.length,
          createdAt: team.createdAt.toISO(),
          updatedAt: team.updatedAt?.toISO() ?? null,
        }
      })
    )

    response.json({
      data: teamsWithSubscriptions,
    })
  }

  /**
   * Update team's subscription tier
   */
  async updateTeamTier({ params, request, response }: HttpContext): Promise<void> {
    const team = await Team.findOrFail(params.id)
    const { subscriptionTier, subscriptionExpiresAt } = request.only([
      'subscriptionTier',
      'subscriptionExpiresAt',
    ])

    // Validate tier exists
    const tier = await SubscriptionTier.findBySlug(subscriptionTier)
    if (!tier) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Invalid subscription tier',
      })
    }

    // Parse expiration date
    let expiresAt: DateTime | null = null
    if (subscriptionTier !== 'free' && subscriptionExpiresAt) {
      expiresAt = DateTime.fromISO(subscriptionExpiresAt)
    }

    // Use subscription service to update
    const subscriptionService = new SubscriptionService()
    const subscription = await subscriptionService.updateTeamSubscription(
      team.id,
      subscriptionTier,
      expiresAt
    )

    response.json({
      data: {
        id: team.id,
        name: team.name,
        subscriptionTier: tier.slug,
        subscriptionExpiresAt: subscription.expiresAt?.toISO() ?? null,
      },
      message: 'Team subscription tier has been updated successfully',
    })
  }

  /**
   * List all available subscription tiers
   */
  async listTiers({ response }: HttpContext): Promise<void> {
    const tiers = await SubscriptionTier.getActiveTiers()

    response.json({
      data: tiers.map((tier) => ({
        id: tier.id,
        slug: tier.slug,
        name: tier.name,
        level: tier.level,
        maxTeamMembers: tier.maxTeamMembers,
        priceMonthly: tier.priceMonthly,
        yearlyDiscountPercent: tier.yearlyDiscountPercent,
        features: tier.features,
        isActive: tier.isActive,
      })),
    })
  }
}

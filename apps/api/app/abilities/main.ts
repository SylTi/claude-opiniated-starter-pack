/*
|--------------------------------------------------------------------------
| Bouncer abilities
|--------------------------------------------------------------------------
|
| Define abilities for authorization checks throughout the application.
|
*/

import User from '#models/user'
import Team from '#models/team'
import SubscriptionTier from '#models/subscription_tier'
import { Bouncer } from '@adonisjs/bouncer'
import type { SubscriberType } from '#models/subscription'

/**
 * Check if user is an admin
 */
export const isAdmin = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})

/**
 * Check if user can access admin panel
 */
export const accessAdminPanel = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})

/**
 * Check if user can manage users
 */
export const manageUsers = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})

/**
 * Check if user can edit their own profile
 */
export const editOwnProfile = Bouncer.ability((user: User, targetUser: User) => {
  return user.id === targetUser.id
})

/**
 * Check if user can view another user's profile
 */
export const viewUserProfile = Bouncer.ability((user: User, targetUser: User) => {
  return user.id === targetUser.id || user.role === 'admin'
})

/**
 * Check if user can manage billing for a subscriber (user or team)
 */
export const manageBilling = Bouncer.ability(
  async (user: User, subscriberType: SubscriberType, subscriberId: number) => {
    if (subscriberType === 'user') {
      return user.id === subscriberId
    }

    // For team, must be owner
    const team = await Team.find(subscriberId)
    if (!team) return false
    return team.ownerId === user.id
  }
)

/**
 * Check if user has access to a feature based on tier
 */
export const accessFeature = Bouncer.ability(async (user: User, requiredTierSlug: string) => {
  const effectiveTier = await user.getEffectiveSubscriptionTier()
  const requiredTier = await SubscriptionTier.findBySlug(requiredTierSlug)
  if (!requiredTier) return false
  return effectiveTier.hasAccessToTier(requiredTier)
})

/**
 * Check if user can upgrade subscription
 */
export const canUpgradeSubscription = Bouncer.ability((_user: User) => {
  // All authenticated users can initiate upgrades
  return true
})

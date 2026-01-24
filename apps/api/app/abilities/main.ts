/*
|--------------------------------------------------------------------------
| Bouncer abilities
|--------------------------------------------------------------------------
|
| Define abilities for authorization checks throughout the application.
|
*/

import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import SubscriptionTier from '#models/subscription_tier'
import { Bouncer } from '@adonisjs/bouncer'

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
 * Check if user can manage billing for a tenant (tenant is the billing unit)
 */
export const manageBilling = Bouncer.ability(async (user: User, tenantId: number) => {
  // Must be owner or admin of the tenant
  const membership = await TenantMembership.query()
    .where('tenantId', tenantId)
    .where('userId', user.id)
    .first()

  if (!membership) return false
  return membership.isAdmin()
})

/**
 * Check if user has access to a feature based on their current tenant's tier
 */
export const accessFeature = Bouncer.ability(async (user: User, requiredTierSlug: string) => {
  if (!user.currentTenantId) return false

  const tenant = await Tenant.find(user.currentTenantId)
  if (!tenant) return false

  const effectiveTier = await tenant.getSubscriptionTier()
  const requiredTier = await SubscriptionTier.findBySlug(requiredTierSlug)
  if (!requiredTier) return false
  return effectiveTier.hasAccessToTier(requiredTier)
})

/**
 * Check if user can upgrade subscription for a tenant
 */
export const canUpgradeSubscription = Bouncer.ability(async (user: User, tenantId: number) => {
  // Must be owner or admin of the tenant
  const membership = await TenantMembership.query()
    .where('tenantId', tenantId)
    .where('userId', user.id)
    .first()

  if (!membership) return false
  return membership.isAdmin()
})

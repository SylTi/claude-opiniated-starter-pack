/**
 * RBAC Permissions Constants
 *
 * Defines all core actions and role-permission mappings for tenant-scoped access control.
 *
 * Principles:
 * - Deny by default
 * - Explicit allow lists per role
 * - Pure, deterministic (no side effects)
 * - Code-based (not database) for testability and version control
 */

import type { TenantRole } from '#constants/roles'

/**
 * All core tenant-scoped actions.
 * Use these constants throughout the codebase to avoid magic strings.
 */
export const ACTIONS = {
  // Tenant management
  TENANT_READ: 'tenant:read',
  TENANT_UPDATE: 'tenant:update',
  TENANT_DELETE: 'tenant:delete',

  // Member management
  MEMBER_LIST: 'member:list',
  MEMBER_ADD: 'member:add',
  MEMBER_REMOVE: 'member:remove',
  MEMBER_UPDATE_ROLE: 'member:update_role',

  // Invitation management
  INVITATION_LIST: 'invitation:list',
  INVITATION_SEND: 'invitation:send',
  INVITATION_CANCEL: 'invitation:cancel',

  // Billing management
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',

  // Subscription management
  SUBSCRIPTION_VIEW: 'subscription:view',
  SUBSCRIPTION_UPGRADE: 'subscription:upgrade',
  SUBSCRIPTION_CANCEL: 'subscription:cancel',

  // Plugin management
  PLUGIN_MANAGE: 'plugin:manage',
} as const

export type TenantAction = (typeof ACTIONS)[keyof typeof ACTIONS]

/**
 * All possible action values as an array for validation/iteration.
 */
export const ALL_ACTIONS: TenantAction[] = Object.values(ACTIONS)

/**
 * Role-permission mapping.
 * Each role has an explicit list of allowed actions.
 */
export const ROLE_PERMISSIONS: Record<TenantRole, readonly TenantAction[]> = {
  owner: [
    // Tenant management - full access
    ACTIONS.TENANT_READ,
    ACTIONS.TENANT_UPDATE,
    ACTIONS.TENANT_DELETE,
    // Member management - full access
    ACTIONS.MEMBER_LIST,
    ACTIONS.MEMBER_ADD,
    ACTIONS.MEMBER_REMOVE,
    ACTIONS.MEMBER_UPDATE_ROLE,
    // Invitation management - full access
    ACTIONS.INVITATION_LIST,
    ACTIONS.INVITATION_SEND,
    ACTIONS.INVITATION_CANCEL,
    // Billing - full access
    ACTIONS.BILLING_VIEW,
    ACTIONS.BILLING_MANAGE,
    // Subscription - full access
    ACTIONS.SUBSCRIPTION_VIEW,
    ACTIONS.SUBSCRIPTION_UPGRADE,
    ACTIONS.SUBSCRIPTION_CANCEL,
    // Plugin management - full access
    ACTIONS.PLUGIN_MANAGE,
  ],
  admin: [
    // Tenant management - read and update, but NOT delete
    ACTIONS.TENANT_READ,
    ACTIONS.TENANT_UPDATE,
    // Member management - full access except role updates
    ACTIONS.MEMBER_LIST,
    ACTIONS.MEMBER_ADD,
    ACTIONS.MEMBER_REMOVE,
    // Invitation management - full access
    ACTIONS.INVITATION_LIST,
    ACTIONS.INVITATION_SEND,
    ACTIONS.INVITATION_CANCEL,
    // Billing - view only
    ACTIONS.BILLING_VIEW,
    // Subscription - view and upgrade, but NOT cancel
    ACTIONS.SUBSCRIPTION_VIEW,
    ACTIONS.SUBSCRIPTION_UPGRADE,
    // Plugin management - full access
    ACTIONS.PLUGIN_MANAGE,
  ],
  member: [
    // Read-only access
    ACTIONS.TENANT_READ,
    ACTIONS.MEMBER_LIST,
    ACTIONS.BILLING_VIEW,
    ACTIONS.SUBSCRIPTION_VIEW,
  ],
  viewer: [
    // Strict read-only access (no billing/subscription visibility)
    ACTIONS.TENANT_READ,
    ACTIONS.MEMBER_LIST,
  ],
} as const

/**
 * Sensitive actions that should be logged via audit-events.
 * Denials of these actions are particularly important to track.
 */
export const SENSITIVE_ACTIONS: readonly TenantAction[] = [
  ACTIONS.TENANT_DELETE,
  ACTIONS.MEMBER_REMOVE,
  ACTIONS.MEMBER_UPDATE_ROLE,
  ACTIONS.BILLING_MANAGE,
  ACTIONS.SUBSCRIPTION_CANCEL,
] as const

/**
 * Check if an action is considered sensitive.
 */
export function isSensitiveAction(action: TenantAction): boolean {
  return SENSITIVE_ACTIONS.includes(action)
}

/**
 * RBAC Service
 *
 * Pure, deterministic authorization logic for tenant-scoped access control.
 * No database access - all decisions are based on role and action constants.
 *
 * Principles:
 * - Deny by default
 * - Pure functions (no side effects)
 * - Fully testable without mocking
 */

import {
  ROLE_PERMISSIONS,
  SENSITIVE_ACTIONS,
  ACTIONS,
  type TenantAction,
} from '#constants/permissions'
import type { TenantRole } from '#constants/roles'

/**
 * Actions that resource ownership can bypass.
 * These are safe, non-destructive actions where the resource owner
 * should have access regardless of their tenant role.
 *
 * SECURITY: Sensitive/destructive actions are intentionally excluded:
 * - TENANT_DELETE (could delete entire tenant)
 * - MEMBER_REMOVE (could remove other members)
 * - MEMBER_UPDATE_ROLE (could escalate privileges)
 * - SUBSCRIPTION_CANCEL (financial impact)
 * - BILLING_MANAGE (financial impact)
 */
const OWNERSHIP_BYPASS_ACTIONS: readonly TenantAction[] = [
  ACTIONS.TENANT_READ,
  ACTIONS.TENANT_UPDATE,
  ACTIONS.MEMBER_LIST,
  ACTIONS.MEMBER_ADD,
  ACTIONS.INVITATION_LIST,
  ACTIONS.INVITATION_SEND,
  ACTIONS.INVITATION_CANCEL,
  ACTIONS.BILLING_VIEW,
  ACTIONS.SUBSCRIPTION_VIEW,
  ACTIONS.SUBSCRIPTION_UPGRADE,
] as const

/**
 * Context for ownership-based permission checks.
 */
export interface ResourceContext {
  /** The ID of the user who owns the resource */
  ownerId: number
  /** The ID of the user making the request */
  userId: number
}

/**
 * Check if a role has permission to perform an action.
 *
 * @param role - The tenant role to check
 * @param action - The action to verify
 * @returns true if the role is allowed to perform the action
 *
 * @example
 * ```typescript
 * can('owner', ACTIONS.TENANT_DELETE) // true
 * can('member', ACTIONS.TENANT_DELETE) // false
 * can('unknown', ACTIONS.TENANT_READ) // false (deny by default)
 * ```
 */
export function can(role: TenantRole | string, action: TenantAction): boolean {
  // Deny by default for unknown roles
  const permissions = ROLE_PERMISSIONS[role as TenantRole]
  if (!permissions) {
    return false
  }

  return permissions.includes(action)
}

/**
 * Check if a role has permission to perform an action, considering resource ownership.
 * Ownership only grants access to safe, non-destructive actions defined in OWNERSHIP_BYPASS_ACTIONS.
 *
 * SECURITY: This function intentionally limits ownership bypass to prevent privilege escalation.
 * Sensitive actions (delete, remove, role changes, billing management) require proper RBAC roles.
 *
 * @param context - The resource ownership context
 * @param role - The tenant role to check
 * @param action - The action to verify
 * @returns true if allowed (either by role or ownership for safe actions)
 *
 * @example
 * ```typescript
 * // User owns the resource - safe action allowed
 * canWithOwnership({ ownerId: 1, userId: 1 }, 'member', ACTIONS.TENANT_READ) // true
 *
 * // User owns the resource - sensitive action NOT allowed by ownership alone
 * canWithOwnership({ ownerId: 1, userId: 1 }, 'member', ACTIONS.MEMBER_UPDATE_ROLE) // false
 *
 * // User does not own, check role
 * canWithOwnership({ ownerId: 2, userId: 1 }, 'admin', ACTIONS.MEMBER_REMOVE) // true
 * canWithOwnership({ ownerId: 2, userId: 1 }, 'member', ACTIONS.MEMBER_REMOVE) // false
 * ```
 */
export function canWithOwnership(
  context: ResourceContext,
  role: TenantRole | string,
  action: TenantAction
): boolean {
  // Owner of the resource has permission ONLY for safe, non-destructive actions
  if (context.ownerId === context.userId && OWNERSHIP_BYPASS_ACTIONS.includes(action)) {
    return true
  }

  // Otherwise, check role permissions
  return can(role, action)
}

/**
 * Check if an action is considered sensitive and should be logged.
 *
 * @param action - The action to check
 * @returns true if the action is sensitive
 */
export function isSensitiveAction(action: TenantAction): boolean {
  return SENSITIVE_ACTIONS.includes(action)
}

/**
 * Get all permissions for a given role.
 *
 * @param role - The tenant role
 * @returns Array of allowed actions, or empty array for unknown roles
 *
 * @example
 * ```typescript
 * getPermissionsForRole('member') // ['tenant:read', 'member:list', ...]
 * getPermissionsForRole('unknown') // []
 * ```
 */
export function getPermissionsForRole(role: TenantRole | string): readonly TenantAction[] {
  const permissions = ROLE_PERMISSIONS[role as TenantRole]
  return permissions ?? []
}

/**
 * Check if a role has permission to perform ALL of the given actions.
 *
 * @param role - The tenant role to check
 * @param actions - Array of actions to verify
 * @returns true if the role can perform ALL actions
 *
 * @example
 * ```typescript
 * canAll('owner', [ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_DELETE]) // true
 * canAll('admin', [ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_DELETE]) // false
 * canAll('member', [ACTIONS.TENANT_READ, ACTIONS.MEMBER_LIST]) // true
 * ```
 */
export function canAll(role: TenantRole | string, actions: TenantAction[]): boolean {
  return actions.every((action) => can(role, action))
}

/**
 * Check if a role has permission to perform ANY of the given actions.
 *
 * @param role - The tenant role to check
 * @param actions - Array of actions to verify
 * @returns true if the role can perform at least one action
 *
 * @example
 * ```typescript
 * canAny('member', [ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_READ]) // true (can read)
 * canAny('member', [ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_DELETE]) // false
 * ```
 */
export function canAny(role: TenantRole | string, actions: TenantAction[]): boolean {
  return actions.some((action) => can(role, action))
}

/**
 * Get the denied actions from a list of required actions.
 *
 * @param role - The tenant role to check
 * @param actions - Array of actions to verify
 * @returns Array of actions that are NOT allowed for this role
 *
 * @example
 * ```typescript
 * getDeniedActions('admin', [ACTIONS.TENANT_UPDATE, ACTIONS.TENANT_DELETE])
 * // Returns: ['tenant:delete']
 * ```
 */
export function getDeniedActions(
  role: TenantRole | string,
  actions: TenantAction[]
): TenantAction[] {
  return actions.filter((action) => !can(role, action))
}

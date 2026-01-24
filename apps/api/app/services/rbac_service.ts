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

import { ROLE_PERMISSIONS, SENSITIVE_ACTIONS, type TenantAction } from '#constants/permissions'
import type { TenantRole } from '#constants/roles'

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
 * If the user owns the resource, the action is always allowed.
 *
 * @param context - The resource ownership context
 * @param role - The tenant role to check
 * @param action - The action to verify
 * @returns true if allowed (either by role or ownership)
 *
 * @example
 * ```typescript
 * // User owns the resource
 * canWithOwnership({ ownerId: 1, userId: 1 }, 'member', ACTIONS.MEMBER_UPDATE_ROLE) // true
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
  // Owner of the resource always has permission
  if (context.ownerId === context.userId) {
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

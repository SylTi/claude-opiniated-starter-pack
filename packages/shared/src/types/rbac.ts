/**
 * RBAC Types
 *
 * Shared type definitions for role-based access control.
 * Used by both backend and frontend for type safety.
 */

import type { TenantRole } from './tenant.js'

/**
 * All possible tenant-scoped actions.
 */
export type TenantAction =
  // Tenant management
  | 'tenant:read'
  | 'tenant:update'
  | 'tenant:delete'
  // Member management
  | 'member:list'
  | 'member:add'
  | 'member:remove'
  | 'member:update_role'
  // Invitation management
  | 'invitation:list'
  | 'invitation:send'
  | 'invitation:cancel'
  // Billing management
  | 'billing:view'
  | 'billing:manage'
  // Subscription management
  | 'subscription:view'
  | 'subscription:upgrade'
  | 'subscription:cancel'

/**
 * DTO for permissions response.
 */
export interface RbacPermissionsDTO {
  /** The user's role in the tenant */
  role: TenantRole
  /** List of actions the user can perform */
  permissions: TenantAction[]
}

/**
 * DTO for RBAC denied error response.
 */
export interface RbacDeniedResponseDTO {
  /** Error type identifier */
  error: 'RbacDenied'
  /** Human-readable error message */
  message: string
  /** List of actions that were denied */
  deniedActions: TenantAction[]
}

/**
 * Type guard to check if an API error is an RBAC denial.
 */
export function isRbacDeniedResponse(error: unknown): error is RbacDeniedResponseDTO {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    (error as { error: string }).error === 'RbacDenied'
  )
}

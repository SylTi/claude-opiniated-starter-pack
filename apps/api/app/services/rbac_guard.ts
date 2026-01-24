/**
 * RBAC Guard
 *
 * Helper class for inline permission checks in controllers.
 * Provides both soft checks (returns boolean) and hard checks (throws error).
 *
 * @example
 * ```typescript
 * async update({ tenant }: HttpContext) {
 *   const guard = new RbacGuard(tenant)
 *
 *   // Soft check - returns boolean
 *   if (guard.can(ACTIONS.TENANT_UPDATE)) {
 *     // Allow full update
 *   }
 *
 *   // Hard check - throws RbacDeniedError if unauthorized
 *   guard.authorize(ACTIONS.TENANT_DELETE)
 * }
 * ```
 */

import type { HttpContext } from '@adonisjs/core/http'
import { can, canWithOwnership, type ResourceContext } from '#services/rbac_service'
import type { TenantAction } from '#constants/permissions'
import type { TenantRole } from '#constants/roles'

/**
 * Custom error for RBAC denials.
 * Can be caught by the exception handler to return proper 403 responses.
 */
export class RbacDeniedError extends Error {
  public readonly deniedActions: TenantAction[]

  constructor(deniedActions: TenantAction[]) {
    super('You do not have permission to perform this action')
    this.name = 'RbacDeniedError'
    this.deniedActions = deniedActions
  }
}

/**
 * Type guard to check if an error is an RbacDeniedError.
 */
export function isRbacDeniedError(error: unknown): error is RbacDeniedError {
  return error instanceof RbacDeniedError
}

/**
 * Tenant context shape expected from the tenant middleware.
 */
export interface TenantContext {
  id: number
  membership: {
    id: number
    tenantId: number
    userId: number
    role: string
  }
}

/**
 * Type guard to check if the input is an HttpContext (has 'request' property).
 */
function isHttpContext(obj: unknown): obj is HttpContext {
  return typeof obj === 'object' && obj !== null && 'request' in obj && 'response' in obj
}

/**
 * RBAC Guard for inline permission checks.
 */
export class RbacGuard {
  private readonly role: TenantRole
  private readonly userId: number

  /**
   * Create a new RBAC guard from HTTP context or tenant context directly.
   *
   * @param contextOrTenant - Either HttpContext or tenant context object
   * @throws Error if tenant context is not available
   */
  constructor(contextOrTenant: HttpContext | TenantContext) {
    let tenant: TenantContext | undefined

    if (isHttpContext(contextOrTenant)) {
      // It's an HttpContext, get tenant from it
      tenant = contextOrTenant.tenant as TenantContext | undefined
    } else {
      // It's a TenantContext directly
      tenant = contextOrTenant
    }

    if (!tenant) {
      throw new Error('RbacGuard requires tenant context. Ensure tenant middleware is active.')
    }

    this.role = tenant.membership.role as TenantRole
    this.userId = tenant.membership.userId
  }

  /**
   * Get the current user's role.
   */
  getRole(): TenantRole {
    return this.role
  }

  /**
   * Get the current user's ID.
   */
  getUserId(): number {
    return this.userId
  }

  /**
   * Check if the user can perform the given action.
   * Returns false if not authorized (soft check).
   *
   * @param action - The action to check
   * @returns true if authorized
   */
  can(action: TenantAction): boolean {
    return can(this.role, action)
  }

  /**
   * Check if the user can perform the given action OR owns the resource.
   * Returns false if not authorized (soft check).
   *
   * @param action - The action to check
   * @param resource - Object containing the resource owner ID
   * @returns true if authorized by role or ownership
   */
  canOrOwns(action: TenantAction, resource: { ownerId: number }): boolean {
    const context: ResourceContext = {
      ownerId: resource.ownerId,
      userId: this.userId,
    }
    return canWithOwnership(context, this.role, action)
  }

  /**
   * Authorize the user to perform the given action.
   * Throws RbacDeniedError if not authorized (hard check).
   *
   * @param action - The action to authorize
   * @throws RbacDeniedError if not authorized
   */
  authorize(action: TenantAction): void {
    if (!this.can(action)) {
      throw new RbacDeniedError([action])
    }
  }

  /**
   * Authorize the user to perform the given action OR verify ownership.
   * Throws RbacDeniedError if not authorized (hard check).
   *
   * @param action - The action to authorize
   * @param resource - Object containing the resource owner ID
   * @throws RbacDeniedError if not authorized by role or ownership
   */
  authorizeOrOwns(action: TenantAction, resource: { ownerId: number }): void {
    if (!this.canOrOwns(action, resource)) {
      throw new RbacDeniedError([action])
    }
  }

  /**
   * Check if the user can perform ALL of the given actions.
   *
   * @param actions - Array of actions to check
   * @returns true if all actions are authorized
   */
  canAll(actions: TenantAction[]): boolean {
    return actions.every((action) => this.can(action))
  }

  /**
   * Check if the user can perform ANY of the given actions.
   *
   * @param actions - Array of actions to check
   * @returns true if at least one action is authorized
   */
  canAny(actions: TenantAction[]): boolean {
    return actions.some((action) => this.can(action))
  }

  /**
   * Authorize the user to perform ALL of the given actions.
   * Throws RbacDeniedError with all denied actions if not fully authorized.
   *
   * @param actions - Array of actions to authorize
   * @throws RbacDeniedError if any action is not authorized
   */
  authorizeAll(actions: TenantAction[]): void {
    const deniedActions = actions.filter((action) => !this.can(action))
    if (deniedActions.length > 0) {
      throw new RbacDeniedError(deniedActions)
    }
  }
}

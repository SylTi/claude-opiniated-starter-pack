/**
 * RBAC Middleware
 *
 * Route-level enforcement middleware for tenant-scoped access control.
 * Must be used AFTER auth and tenant context middlewares.
 *
 * @example
 * ```typescript
 * // In routes.ts
 * import { rbac } from '#start/kernel'
 * import { ACTIONS } from '#constants/permissions'
 *
 * router.put('/:id', [TenantsController, 'update']).use(rbac(ACTIONS.TENANT_UPDATE))
 * router.delete('/:id', [TenantsController, 'destroy']).use(rbac(ACTIONS.TENANT_DELETE))
 * ```
 */

import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { getDeniedActions, isSensitiveAction } from '#services/rbac_service'
import type { TenantAction } from '#constants/permissions'
import type { TenantRole } from '#constants/roles'

/**
 * RBAC context attached to the HTTP context after middleware runs.
 */
export interface RbacContext {
  /** The user's role in the current tenant */
  role: TenantRole
  /** The required actions for this route */
  requiredActions: TenantAction[]
  /** Whether the user passed the RBAC check */
  authorized: boolean
}

/**
 * Factory function to create RBAC middleware for specific actions.
 *
 * @param actions - One or more actions required for the route
 * @returns Middleware class instance
 */
export function createRbacMiddleware(...actions: TenantAction[]) {
  return class RbacMiddleware {
    async handle(ctx: HttpContext, next: NextFn): Promise<void> {
      // Tenant context must be set by tenant middleware
      if (!ctx.tenant) {
        return ctx.response.internalServerError({
          error: 'ConfigurationError',
          message: 'RBAC middleware requires tenant context. Ensure tenant middleware runs first.',
        })
      }

      const role = ctx.tenant.membership.role as TenantRole
      const deniedActions = getDeniedActions(role, actions)

      // Attach RBAC context for controller use
      ctx.rbac = {
        role,
        requiredActions: actions,
        authorized: deniedActions.length === 0,
      }

      // If any required action is denied
      if (deniedActions.length > 0) {
        // Log denial for sensitive actions (prepare for audit-events integration)
        const sensitiveDenials = deniedActions.filter(isSensitiveAction)
        if (sensitiveDenials.length > 0) {
          // TODO: Integrate with audit-events (03-audit-events)
          // For now, this is a placeholder for future audit logging
          // await auditService.logDenial(ctx, sensitiveDenials)
        }

        return ctx.response.forbidden({
          error: 'RbacDenied',
          message: 'You do not have permission to perform this action',
          deniedActions,
        })
      }

      await next()
    }
  }
}

/**
 * Type augmentation for HttpContext to include RBAC information.
 */
declare module '@adonisjs/core/http' {
  interface HttpContext {
    rbac?: RbacContext
  }
}

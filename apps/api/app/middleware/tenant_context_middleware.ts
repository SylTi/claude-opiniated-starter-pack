import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Tenant context middleware resolves the tenant from header/cookie
 * and verifies user membership before setting RLS context.
 *
 * Security: ALWAYS verify membership on backend. Cookie/header is only a hint.
 *
 * Must be used AFTER auth middleware.
 */
export default class TenantContextMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const user = ctx.auth.user

    if (!user) {
      return ctx.response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    // Get tenant hint from header/cookie (NOT trusted)
    const tenantIdHint = this.resolveTenantIdHint(ctx)
    if (!tenantIdHint) {
      return ctx.response.badRequest({
        error: 'TenantRequired',
        message: 'X-Tenant-ID header is required',
      })
    }

    // ALWAYS verify membership on backend - never trust the hint alone
    const membership = await db
      .from('tenant_memberships')
      .where('tenant_id', tenantIdHint)
      .where('user_id', user.id)
      .first()

    if (!membership) {
      return ctx.response.forbidden({
        error: 'Forbidden',
        message: 'Not a member of this tenant',
      })
    }

    // Membership verified - now safe to set RLS context
    const verifiedTenantId = membership.tenant_id

    // Wrap request in transaction with RLS context
    await db.transaction(async (trx) => {
      // Set PostgreSQL session variables for RLS
      await trx.rawQuery("SELECT set_config('app.user_id', ?, true)", [String(user.id)])
      await trx.rawQuery("SELECT set_config('app.tenant_id', ?, true)", [String(verifiedTenantId)])

      // Attach tenant context to request
      ctx.tenant = {
        id: verifiedTenantId,
        membership: {
          id: membership.id,
          tenantId: membership.tenant_id,
          userId: membership.user_id,
          role: membership.role,
        },
      }

      // Attach transaction for controllers to use
      ctx.tenantDb = trx

      await next()
    })
  }

  /**
   * Resolve tenant ID hint from header or cookie.
   * This is just a HINT - actual tenant is verified via membership check.
   */
  private resolveTenantIdHint(ctx: HttpContext): number | null {
    // Check header first (API clients)
    const headerValue = ctx.request.header('X-Tenant-ID')
    if (headerValue) {
      const parsed = Number.parseInt(headerValue, 10)
      return Number.isNaN(parsed) ? null : parsed
    }

    // Fallback to cookie (browser clients)
    const cookieValue = ctx.request.cookie('tenant_id')
    if (cookieValue) {
      const parsed = Number.parseInt(cookieValue, 10)
      return Number.isNaN(parsed) ? null : parsed
    }

    return null
  }
}

/**
 * Type augmentation for HttpContext to include tenant information.
 */
declare module '@adonisjs/core/http' {
  interface HttpContext {
    tenant?: {
      id: number
      membership: {
        id: number
        tenantId: number
        userId: number
        role: string
      }
    }
    tenantDb?: ReturnType<typeof db.transaction> extends Promise<infer T> ? T : never
  }
}

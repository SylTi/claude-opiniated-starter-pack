import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Admin Context Middleware
 *
 * Sets system RLS context (user_id=0, tenant_id=0) for admin routes.
 * This allows admin users to query all tenants and subscriptions
 * without RLS filtering.
 *
 * SECURITY CONSIDERATIONS:
 * - This middleware must only be applied to routes protected by admin middleware
 * - It grants cross-tenant access, bypassing normal RLS tenant isolation
 * - Admin actions are still audit-logged through AuditContext
 * - Uses transaction-scoped context (is_local=true) to prevent cross-request leaks
 *
 * IMPLEMENTATION:
 * Sets ctx.tenantDb which BaseModel uses automatically for all queries.
 * This overrides any authDb set by AuthContextMiddleware since BaseModel
 * prefers tenantDb over authDb (see base_model.ts line 26).
 *
 * USAGE:
 * Apply after auth and admin middleware to ensure user is authenticated admin:
 *   .use([middleware.auth(), middleware.authContext(), middleware.admin(), middleware.adminContext()])
 */
export default class AdminContextMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    // Wrap entire request in a transaction with system RLS context
    // Using is_local=true ensures context is transaction-scoped, not connection-scoped
    // This prevents privilege leakage if the connection is returned to the pool
    await db.transaction(async (trx) => {
      await trx.rawQuery("SELECT set_config('app.user_id', '0', true)")
      await trx.rawQuery("SELECT set_config('app.tenant_id', '0', true)")

      // Set tenantDb which BaseModel uses for automatic RLS binding
      // This overrides authDb since BaseModel prefers tenantDb
      ctx.tenantDb = trx

      await next()
    })
  }
}

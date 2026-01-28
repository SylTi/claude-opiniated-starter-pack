import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Auth Context Middleware
 *
 * Wraps the request in a transaction with PostgreSQL session variable set
 * for the authenticated user. This enables RLS policies that check
 * app_current_user_id().
 *
 * Must be used AFTER auth middleware.
 *
 * IMPORTANT: Controllers must use ctx.authDb for queries that need RLS.
 * The session variable is only set within the transaction provided.
 *
 * For full tenant context (which also sets tenant_id), use TenantContextMiddleware.
 */
export default class AuthContextMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const user = ctx.auth.user

    if (!user) {
      // No authenticated user, continue without setting context
      return next()
    }

    // Wrap request in transaction with RLS context
    await db.transaction(async (trx) => {
      // Set PostgreSQL session variable for RLS (is_local=true for transaction scope)
      await trx.rawQuery("SELECT set_config('app.user_id', ?, true)", [String(user.id)])

      // Attach transaction for controllers to use
      ctx.authDb = trx

      await next()
    })
  }
}

/**
 * Type augmentation for HttpContext to include authDb.
 */
declare module '@adonisjs/core/http' {
  interface HttpContext {
    authDb?: ReturnType<typeof db.transaction> extends Promise<infer T> ? T : never
  }
}

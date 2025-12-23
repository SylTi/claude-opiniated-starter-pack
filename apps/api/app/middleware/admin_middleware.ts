import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Admin middleware checks if the authenticated user has the admin role.
 * Must be used AFTER auth middleware.
 */
export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const user = ctx.auth.user

    if (!user) {
      return ctx.response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    if (user.role !== 'admin') {
      return ctx.response.forbidden({
        error: 'Forbidden',
        message: 'Admin access required',
      })
    }

    return next()
  }
}

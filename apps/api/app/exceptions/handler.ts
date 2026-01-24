import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { isRbacDeniedError } from '#services/rbac_guard'
import { AuditContext } from '#services/audit_context'
import { AUDIT_EVENT_TYPES } from '#constants/audit_events'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    // Handle RBAC denied errors with proper 403 response
    if (isRbacDeniedError(error)) {
      // Emit audit event for permission denial
      const audit = new AuditContext(ctx)
      audit.emit(AUDIT_EVENT_TYPES.RBAC_PERMISSION_DENIED, undefined, {
        deniedActions: error.deniedActions,
        path: ctx.request.url(),
      })

      return ctx.response.forbidden({
        error: 'RbacDenied',
        message: error.message,
        deniedActions: error.deniedActions,
      })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}

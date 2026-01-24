/**
 * Audit Context Helper
 *
 * Simplified helper for emitting audit events from HTTP context.
 * Auto-populates tenantId and actor from the authenticated context.
 *
 * @example
 * ```typescript
 * import { AuditContext } from '#services/audit_context'
 * import { AUDIT_EVENT_TYPES } from '@saas/shared'
 *
 * async login(ctx: HttpContext) {
 *   const audit = new AuditContext(ctx)
 *
 *   // After successful login
 *   audit.emit(AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS, { type: 'user', id: user.id })
 * }
 * ```
 */

import type { HttpContext } from '@adonisjs/core/http'
import type { AuditEventResource, AuditEventType, AuditEventActor } from '@saas/shared'
import { auditEventEmitter, type RequestContext } from '#services/audit_event_emitter'

/**
 * Tenant context shape from middleware.
 */
interface TenantContext {
  id: number
  membership: {
    userId: number
    role: string
  }
}

/**
 * Audit Context for simplified event emission from HTTP handlers.
 */
export class AuditContext {
  private readonly ctx: HttpContext
  private readonly requestContext: RequestContext

  constructor(ctx: HttpContext) {
    this.ctx = ctx
    this.requestContext = {
      ip: this.extractIp(),
      userAgent: ctx.request.header('user-agent') ?? null,
    }
  }

  /**
   * Emit an audit event with auto-populated context.
   *
   * @param type - Event type
   * @param resource - Optional affected resource
   * @param meta - Optional metadata
   */
  emit(type: AuditEventType, resource?: AuditEventResource, meta?: Record<string, unknown>): void {
    auditEventEmitter.emit({
      type,
      tenantId: this.getTenantId(),
      actor: this.getActor(),
      resource,
      meta,
    })
  }

  /**
   * Emit an audit event with a custom actor (e.g., for login failures where user may not be authenticated).
   *
   * @param type - Event type
   * @param actor - Custom actor
   * @param resource - Optional affected resource
   * @param meta - Optional metadata
   */
  emitWithActor(
    type: AuditEventType,
    actor: AuditEventActor,
    resource?: AuditEventResource,
    meta?: Record<string, unknown>
  ): void {
    auditEventEmitter.emit({
      type,
      tenantId: this.getTenantId(),
      actor,
      resource,
      meta,
    })
  }

  /**
   * Emit for a specific tenant (useful when switching tenants).
   *
   * @param type - Event type
   * @param tenantId - Target tenant ID
   * @param resource - Optional affected resource
   * @param meta - Optional metadata
   */
  emitForTenant(
    type: AuditEventType,
    tenantId: number,
    resource?: AuditEventResource,
    meta?: Record<string, unknown>
  ): void {
    auditEventEmitter.emit({
      type,
      tenantId,
      actor: this.getActor(),
      resource,
      meta,
    })
  }

  /**
   * Get the current tenant ID from context.
   *
   * @returns Tenant ID or null if not in tenant context
   */
  getTenantId(): number | null {
    const tenant = this.ctx.tenant as TenantContext | undefined
    return tenant?.id ?? null
  }

  /**
   * Get the current user ID from auth context.
   *
   * @returns User ID or null if not authenticated
   */
  getUserId(): number | null {
    return this.ctx.auth?.user?.id ?? null
  }

  /**
   * Get actor for current context.
   * Falls back to anonymous user if not authenticated.
   *
   * @returns Actor object
   */
  getActor(): AuditEventActor {
    const userId = this.getUserId()

    if (userId) {
      return auditEventEmitter.createUserActor(userId, this.requestContext)
    }

    // Anonymous actor for unauthenticated requests
    return {
      type: 'user',
      id: null,
      ip: this.requestContext.ip ?? null,
      userAgent: this.requestContext.userAgent ?? null,
    }
  }

  /**
   * Create a user actor for a specific user ID.
   *
   * @param userId - User ID
   * @returns Actor object
   */
  createUserActor(userId: number): AuditEventActor {
    return auditEventEmitter.createUserActor(userId, this.requestContext)
  }

  /**
   * Extract client IP from request.
   * Handles X-Forwarded-For for proxied requests.
   */
  private extractIp(): string | null {
    // Check X-Forwarded-For header first (for proxied requests)
    const forwardedFor = this.ctx.request.header('x-forwarded-for')
    if (forwardedFor) {
      // Take the first IP in the chain (original client)
      const firstIp = forwardedFor.split(',')[0]?.trim()
      if (firstIp) {
        return firstIp
      }
    }

    // Fall back to direct IP
    return this.ctx.request.ip() ?? null
  }
}

/**
 * Factory function for creating audit context.
 *
 * @param ctx - HTTP context
 * @returns AuditContext instance
 */
export function createAuditContext(ctx: HttpContext): AuditContext {
  return new AuditContext(ctx)
}

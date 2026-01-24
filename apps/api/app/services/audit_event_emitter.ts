/**
 * Audit Event Emitter
 *
 * Facade for emitting audit events with automatic sanitization.
 * Provides helper methods for creating actors from different contexts.
 *
 * @example
 * ```typescript
 * import { auditEventEmitter } from '#services/audit_event_emitter'
 * import { AUDIT_EVENT_TYPES } from '@saas/shared'
 *
 * auditEventEmitter.emit({
 *   type: AUDIT_EVENT_TYPES.AUTH_LOGIN_SUCCESS,
 *   tenantId: null,
 *   actor: auditEventEmitter.createUserActor(userId, { ip, userAgent }),
 *   resource: { type: 'user', id: userId },
 * })
 * ```
 */

import type { AuditEvent, AuditEventActor, AuditEventResource, AuditEventType } from '@saas/shared'
import { auditEventBus } from '#services/audit_event_bus'

/**
 * Request context for actor creation.
 */
export interface RequestContext {
  ip?: string | null
  userAgent?: string | null
}

/**
 * Options for emitting an audit event.
 */
export interface EmitOptions {
  type: AuditEventType
  tenantId: number | null
  actor: AuditEventActor
  resource?: AuditEventResource
  meta?: Record<string, unknown>
}

/**
 * Known browser families for user-agent summarization.
 */
const BROWSER_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /Edg\//i, name: 'Edge' },
  { pattern: /Chrome\//i, name: 'Chrome' },
  { pattern: /Firefox\//i, name: 'Firefox' },
  { pattern: /Safari\//i, name: 'Safari' },
  { pattern: /MSIE|Trident/i, name: 'IE' },
  { pattern: /Opera|OPR\//i, name: 'Opera' },
]

/**
 * Known OS patterns for user-agent summarization.
 */
const OS_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /Windows/i, name: 'Windows' },
  { pattern: /Mac OS X|macOS/i, name: 'macOS' },
  { pattern: /Linux/i, name: 'Linux' },
  { pattern: /Android/i, name: 'Android' },
  { pattern: /iOS|iPhone|iPad/i, name: 'iOS' },
]

/**
 * Audit Event Emitter class.
 */
class AuditEventEmitter {
  /**
   * Emit an audit event.
   * Automatically adds timestamp and sanitizes metadata.
   *
   * @param options - Event emission options
   */
  emit(options: EmitOptions): void {
    const event: AuditEvent = {
      type: options.type,
      tenantId: options.tenantId,
      at: new Date().toISOString(),
      actor: options.actor,
      resource: options.resource,
      meta: options.meta ? this.sanitizeMeta(options.meta) : undefined,
    }

    auditEventBus.publish(event)
  }

  /**
   * Emit an audit event synchronously (for testing).
   *
   * @param options - Event emission options
   */
  emitSync(options: EmitOptions): void {
    const event: AuditEvent = {
      type: options.type,
      tenantId: options.tenantId,
      at: new Date().toISOString(),
      actor: options.actor,
      resource: options.resource,
      meta: options.meta ? this.sanitizeMeta(options.meta) : undefined,
    }

    auditEventBus.publishSync(event)
  }

  /**
   * Create an actor from user context.
   *
   * @param userId - User ID
   * @param context - Request context (IP, user agent)
   * @returns Actor object for audit events
   */
  createUserActor(userId: number | string, context?: RequestContext): AuditEventActor {
    return {
      type: 'user',
      id: userId,
      ip: context?.ip ? this.sanitizeIp(context.ip) : null,
      userAgent: context?.userAgent ? this.summarizeUserAgent(context.userAgent) : null,
    }
  }

  /**
   * Create an actor for a service (e.g., webhooks).
   *
   * @param serviceId - Service identifier (e.g., 'stripe', 'sendgrid')
   * @returns Actor object for audit events
   */
  createServiceActor(serviceId: string): AuditEventActor {
    return {
      type: 'service',
      id: serviceId,
      ip: null,
      userAgent: null,
    }
  }

  /**
   * Create an actor for system operations (e.g., cron jobs).
   *
   * @returns Actor object for audit events
   */
  createSystemActor(): AuditEventActor {
    return {
      type: 'system',
      id: null,
      ip: null,
      userAgent: null,
    }
  }

  /**
   * Sanitize IP address.
   * For IPv6, truncates to prefix. For IPv4, keeps as-is.
   *
   * @param ip - Raw IP address
   * @returns Sanitized IP
   */
  private sanitizeIp(ip: string): string {
    // Handle IPv6 by keeping only the first 4 segments (network prefix)
    if (ip.includes(':')) {
      const segments = ip.split(':')
      if (segments.length > 4) {
        return segments.slice(0, 4).join(':') + '::'
      }
    }
    return ip
  }

  /**
   * Summarize user agent to browser/OS only.
   * Prevents leaking full UA strings which may contain sensitive info.
   *
   * @param userAgent - Raw user agent string
   * @returns Summarized browser/OS info
   */
  private summarizeUserAgent(userAgent: string): string {
    let browser = 'Unknown'
    let os = 'Unknown'

    for (const { pattern, name } of BROWSER_PATTERNS) {
      if (pattern.test(userAgent)) {
        browser = name
        break
      }
    }

    for (const { pattern, name } of OS_PATTERNS) {
      if (pattern.test(userAgent)) {
        os = name
        break
      }
    }

    return `${browser}/${os}`
  }

  /**
   * Sanitize metadata to remove PII.
   * Strips known sensitive fields and validates structure.
   *
   * @param meta - Raw metadata object
   * @returns Sanitized metadata
   */
  private sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = [
      'email',
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'creditCard',
      'credit_card',
      'ssn',
      'phone',
      'address',
    ]

    const sanitized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(meta)) {
      // Skip sensitive fields
      const lowerKey = key.toLowerCase()
      if (sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]'
        continue
      }

      // Handle nested objects (one level deep)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMeta(value as Record<string, unknown>)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }
}

/**
 * Singleton instance of the audit event emitter.
 */
export const auditEventEmitter = new AuditEventEmitter()

export default AuditEventEmitter

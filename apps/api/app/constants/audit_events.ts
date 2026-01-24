/**
 * Audit Event Constants
 *
 * Re-exports audit event types from shared package for backend use.
 */

export {
  AUDIT_EVENT_TYPES,
  type AuditEvent,
  type AuditEventActor,
  type AuditEventResource,
  type AuditEventType,
  isValidAuditEventType,
} from '@saas/shared'

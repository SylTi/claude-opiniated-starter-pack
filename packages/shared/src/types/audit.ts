/**
 * Audit Event Types
 *
 * Shared type definitions for the audit event system.
 * Used by both backend (emission) and downstream features (logging, sinks, DLP).
 */

/**
 * All possible audit event types.
 * Organized by domain for clarity.
 */
export const AUDIT_EVENT_TYPES = {
  // Auth
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILURE: 'auth.login.failure',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REGISTER: 'auth.register',
  AUTH_PASSWORD_CHANGE: 'auth.password.change',
  AUTH_PASSWORD_RESET_REQUEST: 'auth.password.reset_request',
  AUTH_PASSWORD_RESET: 'auth.password.reset',
  AUTH_EMAIL_VERIFY: 'auth.email.verify',
  AUTH_MFA_ENABLE: 'auth.mfa.enable',
  AUTH_MFA_DISABLE: 'auth.mfa.disable',

  // Tenant
  TENANT_CREATE: 'tenant.create',
  TENANT_UPDATE: 'tenant.update',
  TENANT_DELETE: 'tenant.delete',
  TENANT_SWITCH: 'tenant.switch',

  // Member
  MEMBER_ADD: 'member.add',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_ROLE_UPDATE: 'member.role.update',
  MEMBER_LEAVE: 'member.leave',

  // Invitation
  INVITATION_SEND: 'invitation.send',
  INVITATION_ACCEPT: 'invitation.accept',
  INVITATION_DECLINE: 'invitation.decline',
  INVITATION_CANCEL: 'invitation.cancel',

  // Billing
  SUBSCRIPTION_CREATE: 'subscription.create',
  SUBSCRIPTION_UPDATE: 'subscription.update',
  SUBSCRIPTION_CANCEL: 'subscription.cancel',
  BILLING_PAYMENT_SUCCESS: 'billing.payment.success',
  BILLING_PAYMENT_FAILURE: 'billing.payment.failure',

  // Admin
  ADMIN_USER_VERIFY_EMAIL: 'admin.user.verify_email',
  ADMIN_USER_UNVERIFY_EMAIL: 'admin.user.unverify_email',
  ADMIN_USER_DELETE: 'admin.user.delete',
  ADMIN_TIER_UPDATE: 'admin.tier.update',

  // RBAC
  RBAC_PERMISSION_DENIED: 'rbac.permission.denied',
} as const

/**
 * Union type of all audit event type values.
 */
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES]

/**
 * Actor who triggered the audit event.
 */
export interface AuditEventActor {
  /** Type of actor */
  type: 'user' | 'service' | 'system'
  /** Actor identifier (user ID, service name) */
  id: string | number | null
  /** IP address (sanitized if needed) */
  ip?: string | null
  /** User agent (summarized, not full string) */
  userAgent?: string | null
}

/**
 * Resource affected by the audit event.
 */
export interface AuditEventResource {
  /** Resource type (e.g., 'user', 'tenant', 'subscription') */
  type: string
  /** Resource identifier */
  id: string | number
}

/**
 * Complete audit event structure.
 */
export interface AuditEvent {
  /** Tenant context (null for non-tenant-scoped events) */
  tenantId: number | null
  /** Event type from AUDIT_EVENT_TYPES */
  type: AuditEventType
  /** ISO 8601 timestamp */
  at: string
  /** Who triggered the event */
  actor: AuditEventActor
  /** Optional affected resource */
  resource?: AuditEventResource
  /** Optional additional metadata (must be sanitized, no PII) */
  meta?: Record<string, unknown>
}

/**
 * Type guard to check if a string is a valid audit event type.
 */
export function isValidAuditEventType(type: string): type is AuditEventType {
  return Object.values(AUDIT_EVENT_TYPES).includes(type as AuditEventType)
}

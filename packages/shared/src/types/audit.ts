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

  // SSO
  SSO_CONFIG_CREATE: 'sso.config.create',
  SSO_CONFIG_UPDATE: 'sso.config.update',
  SSO_CONFIG_DELETE: 'sso.config.delete',
  SSO_CONFIG_VALIDATE: 'sso.config.validate',
  SSO_ENABLE: 'sso.enable',
  SSO_DISABLE: 'sso.disable',
  SSO_LOGIN_SUCCESS: 'sso.login.success',
  SSO_LOGIN_FAILURE: 'sso.login.failure',
  SSO_USER_PROVISIONED: 'sso.user.provisioned',

  // Authorization
  AUTHZ_DENIED: 'authz.denied',
  AUTHZ_GRANTED: 'authz.granted',

  // Plugin Lifecycle
  PLUGIN_ENABLE: 'plugin.enable',
  PLUGIN_DISABLE: 'plugin.disable',
  PLUGIN_BOOT: 'plugin.boot',
  PLUGIN_QUARANTINE: 'plugin.quarantine',
  PLUGIN_CONFIG_UPDATE: 'plugin.config.update',

  // Plugin RBAC
  PLUGIN_RBAC_ROLE_CREATED: 'plugin.rbac.role.created',
  PLUGIN_RBAC_ROLE_UPDATED: 'plugin.rbac.role.updated',
  PLUGIN_RBAC_ROLE_DELETED: 'plugin.rbac.role.deleted',
  PLUGIN_RBAC_MEMBER_ADDED: 'plugin.rbac.member.added',
  PLUGIN_RBAC_MEMBER_REMOVED: 'plugin.rbac.member.removed',
  PLUGIN_RBAC_GRANT_ADDED: 'plugin.rbac.grant.added',
  PLUGIN_RBAC_GRANT_REMOVED: 'plugin.rbac.grant.removed',

  // Plugin Custom Events (plugin-specific audit events)
  PLUGIN_CUSTOM: 'plugin.custom',

  // UI Incidents (Design/Navigation)
  UI_SHELL_CRASH: 'ui.shell.crash',
  UI_THEME_ERROR: 'ui.theme.error',
  UI_NAV_MANDATORY_RESTORED: 'ui.nav.mandatory_restored',
  UI_NAV_INVALID_MODEL: 'ui.nav.invalid_model',
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
  type: 'user' | 'service' | 'system' | 'plugin'
  /** Actor identifier (user ID, service name, plugin ID) */
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

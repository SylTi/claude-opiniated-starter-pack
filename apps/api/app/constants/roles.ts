/**
 * Role constants to avoid magic strings throughout the codebase.
 * Use these instead of hardcoding 'admin', 'user', etc.
 */

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

// Tenant member roles
export const TENANT_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const

export type TenantRole = (typeof TENANT_ROLES)[keyof typeof TENANT_ROLES]

// Invitation roles (subset of tenant roles)
export const INVITATION_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const

export type InvitationRole = (typeof INVITATION_ROLES)[keyof typeof INVITATION_ROLES]

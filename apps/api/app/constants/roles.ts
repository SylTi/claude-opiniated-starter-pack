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

// Team member roles
export const TEAM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const

export type TeamRole = (typeof TEAM_ROLES)[keyof typeof TEAM_ROLES]

// Invitation roles (subset of team roles)
export const INVITATION_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const

export type InvitationRole = (typeof INVITATION_ROLES)[keyof typeof INVITATION_ROLES]

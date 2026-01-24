/**
 * Custom error classes for tenant operations.
 * Using typed errors instead of magic strings for better maintainability.
 */

/**
 * Thrown when attempting to add a user who is already a tenant member
 */
export class AlreadyMemberError extends Error {
  readonly code = 'ALREADY_MEMBER' as const

  constructor() {
    super('User is already a member of this tenant')
    this.name = 'AlreadyMemberError'
  }
}

/**
 * Thrown when tenant has reached maximum member limit
 */
export class MemberLimitReachedError extends Error {
  readonly code = 'MEMBER_LIMIT_REACHED' as const
  readonly maxMembers: number

  constructor(maxMembers: number) {
    super(`Tenant has reached the maximum of ${maxMembers} members`)
    this.name = 'MemberLimitReachedError'
    this.maxMembers = maxMembers
  }
}

/**
 * Type guard to check if error is AlreadyMemberError
 */
export function isAlreadyMemberError(error: unknown): error is AlreadyMemberError {
  return error instanceof AlreadyMemberError
}

/**
 * Type guard to check if error is MemberLimitReachedError
 */
export function isMemberLimitReachedError(error: unknown): error is MemberLimitReachedError {
  return error instanceof MemberLimitReachedError
}

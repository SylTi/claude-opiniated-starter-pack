/**
 * Authorization Types
 *
 * Shared type definitions for the AuthzService.
 * Used by plugins to define authorization checks and resolvers.
 */

/**
 * Authorization check request.
 */
export interface AuthzCheck {
  /** Ability being checked (e.g., "notes.note.write") */
  ability: string
  /** Optional resource being accessed */
  resource?: {
    /** Resource type (e.g., "note", "board") */
    type: string
    /** Resource identifier */
    id: string | number
  }
}

/**
 * Authorization decision.
 */
export interface AuthzDecision {
  /** Whether the action is allowed */
  allow: boolean
  /** Reason for the decision (for logging/debugging) */
  reason?: string
}

/**
 * Context passed to authorization resolvers.
 */
export interface AuthzContext {
  /** Current user ID */
  userId: number
  /** Current tenant ID */
  tenantId: number
  /** User's role in the tenant */
  tenantRole?: string
  /** Additional context from request */
  extra?: Record<string, unknown>
}

/**
 * Authorization resolver function type.
 * Plugins register resolvers for their namespace.
 */
export type AuthzResolver = (ctx: AuthzContext, check: AuthzCheck) => Promise<AuthzDecision>

/**
 * Authorization denied response.
 */
export interface AuthzDeniedResponseDTO {
  /** Error type identifier */
  error: 'AuthzDenied'
  /** Human-readable error message */
  message: string
  /** The ability that was denied */
  ability: string
  /** Resource that was being accessed (if any) */
  resource?: { type: string; id: string | number }
  /** Plugin namespace */
  namespace?: string
}

/**
 * Type guard to check if an API error is an authz denial.
 */
export function isAuthzDeniedResponse(error: unknown): error is AuthzDeniedResponseDTO {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    (error as { error: string }).error === 'AuthzDenied'
  )
}

/**
 * Parse namespace from ability string.
 * Returns the namespace (up to first dot) or null if no dot found.
 *
 * @example
 * parseNamespace('notes.note.write') // 'notes'
 * parseNamespace('billing:view') // null (core ability)
 */
export function parseNamespace(ability: string): string | null {
  const dotIndex = ability.indexOf('.')
  if (dotIndex === -1) {
    return null
  }
  return ability.substring(0, dotIndex)
}

/**
 * Check if an ability belongs to a plugin namespace.
 */
export function isPluginAbility(ability: string): boolean {
  return parseNamespace(ability) !== null
}

/**
 * Check if an ability is a core ability (no namespace).
 */
export function isCoreAbility(ability: string): boolean {
  return parseNamespace(ability) === null
}

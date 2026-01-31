/**
 * Custom error classes for authorization operations.
 */

import type { AuthzCheck } from '@saas/shared'

/**
 * Thrown when an authorization check fails.
 */
export class AuthzDeniedError extends Error {
  readonly code = 'AUTHZ_DENIED' as const
  readonly ability: string
  readonly resourceType?: string
  readonly resourceId?: string | number
  readonly namespace?: string

  constructor(check: AuthzCheck, reason?: string) {
    const message = reason || `Authorization denied for ability "${check.ability}"`
    super(message)
    this.name = 'AuthzDeniedError'
    this.ability = check.ability
    this.resourceType = check.resource?.type
    this.resourceId = check.resource?.id

    // Extract namespace from ability
    const dotIndex = check.ability.indexOf('.')
    if (dotIndex !== -1) {
      this.namespace = check.ability.substring(0, dotIndex)
    }
  }

  /**
   * Convert to API response format.
   */
  toResponse(): {
    error: 'AuthzDenied'
    message: string
    ability: string
    resource?: { type: string; id: string | number }
    namespace?: string
  } {
    const response: ReturnType<AuthzDeniedError['toResponse']> = {
      error: 'AuthzDenied',
      message: this.message,
      ability: this.ability,
    }

    if (this.resourceType && this.resourceId) {
      response.resource = {
        type: this.resourceType,
        id: this.resourceId,
      }
    }

    if (this.namespace) {
      response.namespace = this.namespace
    }

    return response
  }
}

/**
 * Type guard to check if error is AuthzDeniedError.
 */
export function isAuthzDeniedError(error: unknown): error is AuthzDeniedError {
  return error instanceof AuthzDeniedError
}

/**
 * Thrown when a namespace is already registered.
 */
export class NamespaceConflictError extends Error {
  readonly code = 'NAMESPACE_CONFLICT' as const
  readonly namespace: string
  readonly existingPluginId: string
  readonly newPluginId: string

  constructor(namespace: string, existingPluginId: string, newPluginId: string) {
    super(
      `Namespace "${namespace}" is already registered by plugin "${existingPluginId}", ` +
        `cannot register for plugin "${newPluginId}"`
    )
    this.name = 'NamespaceConflictError'
    this.namespace = namespace
    this.existingPluginId = existingPluginId
    this.newPluginId = newPluginId
  }
}

/**
 * Type guard to check if error is NamespaceConflictError.
 */
export function isNamespaceConflictError(error: unknown): error is NamespaceConflictError {
  return error instanceof NamespaceConflictError
}

/**
 * Thrown when no resolver is found for a namespace.
 */
export class NamespaceNotFoundError extends Error {
  readonly code = 'NAMESPACE_NOT_FOUND' as const
  readonly namespace: string
  readonly ability: string

  constructor(namespace: string, ability: string) {
    super(`No authorization resolver found for namespace "${namespace}" (ability: "${ability}")`)
    this.name = 'NamespaceNotFoundError'
    this.namespace = namespace
    this.ability = ability
  }
}

/**
 * Type guard to check if error is NamespaceNotFoundError.
 */
export function isNamespaceNotFoundError(error: unknown): error is NamespaceNotFoundError {
  return error instanceof NamespaceNotFoundError
}

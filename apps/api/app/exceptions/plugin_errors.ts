/**
 * Custom error classes for plugin operations.
 */

import type { PluginSchemaMismatchDTO } from '@saas/shared'

/**
 * Thrown when a plugin's database schema version doesn't match the expected version.
 * This is a FATAL error that prevents the application from starting.
 */
export class PluginSchemaMismatchError extends Error {
  readonly code = 'PLUGIN_SCHEMA_MISMATCH' as const
  readonly pluginId: string
  readonly expectedVersion: number
  readonly actualVersion: number
  readonly remediation: string

  constructor(details: PluginSchemaMismatchDTO) {
    super(
      `Plugin "${details.pluginId}" schema mismatch: expected version ${details.expectedVersion}, ` +
        `found version ${details.actualVersion}. ${details.remediation}`
    )
    this.name = 'PluginSchemaMismatchError'
    this.pluginId = details.pluginId
    this.expectedVersion = details.expectedVersion
    this.actualVersion = details.actualVersion
    this.remediation = details.remediation
  }

  /**
   * Convert to DTO for API response.
   */
  toDTO(): PluginSchemaMismatchDTO {
    return {
      pluginId: this.pluginId,
      expectedVersion: this.expectedVersion,
      actualVersion: this.actualVersion,
      remediation: this.remediation,
    }
  }
}

/**
 * Type guard to check if error is PluginSchemaMismatchError.
 */
export function isPluginSchemaMismatchError(error: unknown): error is PluginSchemaMismatchError {
  return error instanceof PluginSchemaMismatchError
}

/**
 * Thrown when a plugin fails to boot.
 */
export class PluginBootError extends Error {
  readonly code = 'PLUGIN_BOOT_ERROR' as const
  readonly pluginId: string
  readonly phase: 'validation' | 'capabilities' | 'routes' | 'hooks' | 'authz'
  readonly cause?: Error

  constructor(pluginId: string, phase: PluginBootError['phase'], message: string, cause?: Error) {
    super(`Plugin "${pluginId}" failed to boot during ${phase} phase: ${message}`)
    this.name = 'PluginBootError'
    this.pluginId = pluginId
    this.phase = phase
    this.cause = cause
  }
}

/**
 * Type guard to check if error is PluginBootError.
 */
export function isPluginBootError(error: unknown): error is PluginBootError {
  return error instanceof PluginBootError
}

/**
 * Thrown when a plugin is not found.
 */
export class PluginNotFoundError extends Error {
  readonly code = 'PLUGIN_NOT_FOUND' as const
  readonly pluginId: string

  constructor(pluginId: string) {
    super(`Plugin "${pluginId}" is not registered`)
    this.name = 'PluginNotFoundError'
    this.pluginId = pluginId
  }
}

/**
 * Type guard to check if error is PluginNotFoundError.
 */
export function isPluginNotFoundError(error: unknown): error is PluginNotFoundError {
  return error instanceof PluginNotFoundError
}

/**
 * Thrown when a plugin is disabled for a tenant.
 */
export class PluginDisabledError extends Error {
  readonly code = 'PLUGIN_DISABLED' as const
  readonly pluginId: string
  readonly tenantId: number

  constructor(pluginId: string, tenantId: number) {
    super(`Plugin "${pluginId}" is not enabled for tenant ${tenantId}`)
    this.name = 'PluginDisabledError'
    this.pluginId = pluginId
    this.tenantId = tenantId
  }
}

/**
 * Type guard to check if error is PluginDisabledError.
 */
export function isPluginDisabledError(error: unknown): error is PluginDisabledError {
  return error instanceof PluginDisabledError
}

/**
 * Thrown when a plugin capability check fails.
 */
export class PluginCapabilityError extends Error {
  readonly code = 'PLUGIN_CAPABILITY_DENIED' as const
  readonly pluginId: string
  readonly capability: string

  constructor(pluginId: string, capability: string) {
    super(`Plugin "${pluginId}" does not have capability "${capability}"`)
    this.name = 'PluginCapabilityError'
    this.pluginId = pluginId
    this.capability = capability
  }
}

/**
 * Type guard to check if error is PluginCapabilityError.
 */
export function isPluginCapabilityError(error: unknown): error is PluginCapabilityError {
  return error instanceof PluginCapabilityError
}

/**
 * Thrown when a plugin is quarantined (failed boot).
 */
export class PluginQuarantinedError extends Error {
  readonly code = 'PLUGIN_QUARANTINED' as const
  readonly pluginId: string
  readonly reason: string

  constructor(pluginId: string, reason: string) {
    super(`Plugin "${pluginId}" is quarantined: ${reason}`)
    this.name = 'PluginQuarantinedError'
    this.pluginId = pluginId
    this.reason = reason
  }
}

/**
 * Type guard to check if error is PluginQuarantinedError.
 */
export function isPluginQuarantinedError(error: unknown): error is PluginQuarantinedError {
  return error instanceof PluginQuarantinedError
}

/**
 * Plugin Types
 *
 * Shared type definitions for the plugin system.
 * Used by both backend and frontend for type safety.
 */

/**
 * Plugin tier levels.
 */
export type PluginTier = 'A' | 'B' | 'C' | 'main-app'

/**
 * Plugin status in the system.
 */
export type PluginStatus = 'pending' | 'booting' | 'active' | 'quarantined' | 'disabled'

/**
 * Plugin state for a specific tenant.
 */
export interface PluginStateDTO {
  /** Unique plugin identifier */
  pluginId: string
  /** Plugin display name */
  displayName?: string
  /** Plugin description */
  description?: string
  /** Plugin version */
  version: string
  /** Plugin tier */
  tier: PluginTier
  /** Whether the plugin is enabled for this tenant */
  enabled: boolean
  /** Plugin-specific configuration */
  config?: Record<string, unknown>
  /** When the plugin was installed */
  installedAt?: string
  /** When the plugin state was last updated */
  updatedAt?: string
}

/**
 * Plugin state create/update request.
 */
export interface PluginStateUpdateDTO {
  /** Enable or disable the plugin */
  enabled?: boolean
  /** Plugin-specific configuration */
  config?: Record<string, unknown>
}

/**
 * Plugin info for listing available plugins.
 */
export interface PluginInfoDTO {
  /** Unique plugin identifier */
  pluginId: string
  /** Package name */
  packageName: string
  /** Plugin display name */
  displayName?: string
  /** Plugin description */
  description?: string
  /** Plugin version */
  version: string
  /** Plugin tier */
  tier: PluginTier
  /** Capabilities requested */
  requestedCapabilities: Array<{
    capability: string
    reason: string
  }>
  /** Whether the plugin has database tables */
  hasDatabase: boolean
  /** Whether the plugin has routes */
  hasRoutes: boolean
  /** Dependencies (other plugin IDs) */
  dependencies?: string[]
}

/**
 * Plugin DB state for schema version tracking.
 */
export interface PluginDbStateDTO {
  /** Plugin identifier */
  pluginId: string
  /** Current schema version */
  schemaVersion: number
  /** Installed plugin version */
  installedPluginVersion?: string
  /** Last migration that was run */
  lastMigrationName?: string
  /** When the last migration was applied */
  lastMigratedAt?: string
}

/**
 * Plugin schema mismatch error details.
 */
export interface PluginSchemaMismatchDTO {
  /** Plugin identifier */
  pluginId: string
  /** Expected schema version from manifest */
  expectedVersion: number
  /** Actual schema version in database */
  actualVersion: number
  /** Remediation message */
  remediation: string
}

/**
 * Plugin verification result.
 */
export interface PluginVerificationResultDTO {
  /** Plugin identifier */
  pluginId: string
  /** Whether the plugin passed verification */
  valid: boolean
  /** Verification errors */
  errors: string[]
  /** Verification warnings */
  warnings: string[]
}

/**
 * Plugin boot result.
 */
export interface PluginBootResultDTO {
  /** Total plugins processed */
  total: number
  /** Successfully booted plugins */
  active: string[]
  /** Quarantined plugins (failed to boot) */
  quarantined: Array<{
    pluginId: string
    error: string
  }>
  /** Disabled plugins */
  disabled: string[]
}

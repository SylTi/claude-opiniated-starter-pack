/**
 * Plugin Manifest Types
 *
 * The plugin.meta.json contract that all plugins must follow.
 */

import type { CapabilityRequirement } from './capabilities.js'
import type { HookRegistration } from './hooks.js'

/**
 * Plugin tiers define access levels:
 * - A: UI plugins (unprivileged) - filters/slots only, no server routes, no DB
 * - B: App plugins (moderately privileged) - routes, own tables, background jobs
 */
export type PluginTier = 'A' | 'B'

/**
 * Plugin migration configuration.
 * Only required for Tier B plugins with database tables.
 */
export interface PluginMigrationConfig {
  /** Directory containing migration files (relative to package root) */
  dir: string
  /** Current schema version (monotonic increasing integer) */
  schemaVersion: number
}

/**
 * Plugin table declaration.
 * All plugin tables must have tenant_id for RLS.
 */
export interface PluginTableDeclaration {
  /** Table name (must be prefixed with plugin_{pluginId}_) */
  name: string
  /** Must always be true - enforced at boot time */
  hasTenantId: true
}

/**
 * The plugin.meta.json structure.
 * This is the source of truth for plugin metadata.
 */
export interface PluginManifest {
  /** Unique plugin identifier (e.g., 'motion', 'notes') */
  pluginId: string

  /** Package name (e.g., '@plugins/motion-boards') */
  packageName: string

  /** Semantic version (e.g., '1.0.0') */
  version: string

  /** Plugin tier (A or B) */
  tier: PluginTier

  /** Human-readable display name */
  displayName?: string

  /** Brief description of the plugin */
  description?: string

  /** Capabilities requested by this plugin */
  requestedCapabilities: CapabilityRequirement[]

  /** Hook registrations (optional) */
  hooks?: HookRegistration[]

  /** Route prefix for Tier B plugins (default: /apps/{pluginId}) */
  routePrefix?: string

  /** Tables declared by this plugin (Tier B only) */
  tables?: PluginTableDeclaration[]

  /** Global tables that are NOT tenant-scoped (requires explicit approval) */
  globalTables?: string[]

  /** Migration configuration (Tier B only, if plugin has DB) */
  migrations?: PluginMigrationConfig

  /** Authorization namespace (Tier B only, e.g., 'notes.') */
  authzNamespace?: string

  /** Minimum required app version (semver) */
  minAppVersion?: string

  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[]
}

/**
 * Validate a plugin manifest.
 */
export function validatePluginManifest(manifest: PluginManifest): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Required fields
  if (!manifest.pluginId || typeof manifest.pluginId !== 'string') {
    errors.push('pluginId is required and must be a string')
  }

  if (!manifest.packageName || typeof manifest.packageName !== 'string') {
    errors.push('packageName is required and must be a string')
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('version is required and must be a string')
  }

  if (!manifest.tier || !['A', 'B'].includes(manifest.tier)) {
    errors.push('tier must be "A" or "B"')
  }

  if (!Array.isArray(manifest.requestedCapabilities)) {
    errors.push('requestedCapabilities must be an array')
  }

  // Tier B specific validations
  if (manifest.tier === 'B') {
    // Route prefix validation - must match expected pattern or be omitted
    // Strict check: must be exactly the expected prefix OR start with expectedPrefix + "/"
    // This prevents a plugin from claiming "/api/v1/apps/{pluginId}-other" and shadowing another plugin
    if (manifest.routePrefix) {
      const expectedPrefix = `/api/v1/apps/${manifest.pluginId}`
      const isExactMatch = manifest.routePrefix === expectedPrefix
      const isSubPath = manifest.routePrefix.startsWith(expectedPrefix + '/')
      if (!isExactMatch && !isSubPath) {
        errors.push(
          `routePrefix must be exactly "${expectedPrefix}" or start with "${expectedPrefix}/" ` +
            `(got "${manifest.routePrefix}"). Plugins cannot mount routes outside their namespace.`
        )
      }
    }

    // Tables must have correct prefix
    if (manifest.tables) {
      for (const table of manifest.tables) {
        if (!table.name.startsWith(`plugin_${manifest.pluginId}_`)) {
          errors.push(`Table "${table.name}" must be prefixed with "plugin_${manifest.pluginId}_"`)
        }
        if (table.hasTenantId !== true) {
          errors.push(`Table "${table.name}" must declare hasTenantId: true`)
        }
      }
    }

    // Migrations require schemaVersion
    if (manifest.migrations) {
      if (typeof manifest.migrations.schemaVersion !== 'number' || manifest.migrations.schemaVersion < 0) {
        errors.push('migrations.schemaVersion must be a non-negative integer')
      }
      if (!manifest.migrations.dir || typeof manifest.migrations.dir !== 'string') {
        errors.push('migrations.dir is required when migrations is specified')
      }
    }

    // Authz namespace must end with dot
    if (manifest.authzNamespace && !manifest.authzNamespace.endsWith('.')) {
      errors.push('authzNamespace must end with a dot (e.g., "notes.")')
    }

    // Authz namespace requires app:authz capability
    // Guard with Array.isArray to avoid crash if requestedCapabilities is invalid
    if (manifest.authzNamespace && Array.isArray(manifest.requestedCapabilities)) {
      const hasAuthzCapability = manifest.requestedCapabilities.some(
        (cap) => cap.capability === 'app:authz'
      )
      if (!hasAuthzCapability) {
        errors.push(
          'authzNamespace requires the "app:authz" capability. ' +
            'Add { capability: "app:authz", reason: "..." } to requestedCapabilities.'
        )
      }
    }
  }

  // Tier A cannot have Tier B features
  if (manifest.tier === 'A') {
    if (manifest.routePrefix) {
      errors.push('Tier A plugins cannot have routePrefix (they have no server routes)')
    }
    if (manifest.tables && manifest.tables.length > 0) {
      errors.push('Tier A plugins cannot have database tables')
    }
    if (manifest.migrations) {
      errors.push('Tier A plugins cannot have migrations')
    }
    if (manifest.authzNamespace) {
      errors.push('Tier A plugins cannot have authzNamespace')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Plugin state in the registry.
 */
export type PluginStatus = 'pending' | 'booting' | 'active' | 'quarantined' | 'disabled'

/**
 * Plugin runtime state after boot.
 */
export interface PluginRuntimeState {
  /** Plugin manifest */
  manifest: PluginManifest
  /** Current status */
  status: PluginStatus
  /** Error message if quarantined */
  errorMessage?: string
  /** Capabilities that were granted */
  grantedCapabilities: string[]
  /** Boot timestamp */
  bootedAt?: Date
}

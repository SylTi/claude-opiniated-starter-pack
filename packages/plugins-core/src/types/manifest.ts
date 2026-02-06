/**
 * Plugin Manifest Types
 *
 * The plugin.meta.json contract that all plugins must follow.
 */

import type { CapabilityRequirement } from './capabilities.js'
import type { HookRegistration } from './hooks.js'

/**
 * User role for plugin access control.
 * Matches UserRole from @saas/shared.
 */
export type PluginRequiredRole = 'admin' | 'user' | 'guest'

/**
 * Valid required role values for validation.
 */
export const VALID_REQUIRED_ROLES: readonly PluginRequiredRole[] = ['admin', 'user', 'guest'] as const

/**
 * Access control configuration for plugin UI routes.
 * Enforced by the plugin layout at /apps/[pluginId].
 */
export interface PluginAccessControl {
  /**
   * Minimum role required to access the plugin UI.
   * - 'admin': Only admins can access
   * - 'user': Admins and regular users (not guests)
   * - 'guest': Anyone authenticated (default if not specified)
   */
  requiredRole?: PluginRequiredRole
}

/**
 * Auth token scope declaration for plugin integrations.
 */
export interface PluginAuthTokenScope {
  /** Unique scope identifier (e.g., "mcp:read") */
  id: string
  /** Human-readable label */
  label: string
  /** Optional description for UI */
  description?: string
  /** Whether this scope is checked by default */
  defaultChecked?: boolean
}

/**
 * Auth token kind declaration for plugin integrations.
 */
export interface PluginAuthTokenKind {
  /** Unique kind identifier (e.g., "integration", "browser_ext") */
  id: string
  /** Human-readable title */
  title: string
  /** Optional description for UI */
  description?: string
  /** Optional create dialog title */
  createTitle?: string
  /** Optional create dialog description */
  createDescription?: string
  /** Optional empty state message */
  emptyMessage?: string
  /** Optional revoke confirmation message */
  revokeMessage?: string
  /** Allowed scopes for this token kind */
  scopes: PluginAuthTokenScope[]
}

/**
 * Auth token configuration for plugin integrations.
 */
export interface PluginAuthTokensConfig {
  kinds: PluginAuthTokenKind[]
}

/**
 * Plugin tiers define access levels:
 * - A: UI plugins (unprivileged) - filters/slots only, no server routes, no DB
 * - B: App plugins (moderately privileged) - routes, own tables, background jobs
 * - main-app: Design ownership (exactly one allowed) - global theme, baseline nav, shells
 */
export type PluginTier = 'A' | 'B' | 'main-app'

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

  /**
   * Route prefix for Tier B plugins.
   *
   * Security: Plugins are ALWAYS mounted at /api/v1/apps/{pluginId}.
   * Custom prefixes are only allowed as subpaths of this base path.
   *
   * Valid examples:
   * - undefined (uses default: /api/v1/apps/{pluginId})
   * - "/api/v1/apps/notes" (exact match)
   * - "/api/v1/apps/notes/v2" (subpath)
   *
   * Invalid examples (will be ignored with a warning):
   * - "/api/v1/other" (outside plugin namespace)
   * - "/apps/notes" (missing /api/v1 prefix)
   *
   * The plugin route mounter enforces this constraint to prevent
   * plugins from shadowing core routes or other plugins' routes.
   */
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

  /**
   * Access control for plugin UI routes.
   * If not specified, any authenticated user can access.
   */
  accessControl?: PluginAccessControl

  /**
   * Auth token configuration for integrations.
   * When provided, the core /api/v1/auth-tokens endpoint enforces
   * allowed token kinds and scopes based on this configuration.
   */
  authTokens?: PluginAuthTokensConfig
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

  if (!manifest.tier || !['A', 'B', 'main-app'].includes(manifest.tier)) {
    errors.push('tier must be "A", "B", or "main-app"')
  }

  if (!Array.isArray(manifest.requestedCapabilities)) {
    errors.push('requestedCapabilities must be an array')
  }

  // Auth token configuration validation
  if (manifest.authTokens !== undefined) {
    const authTokens = manifest.authTokens
    if (!authTokens || !Array.isArray(authTokens.kinds) || authTokens.kinds.length === 0) {
      errors.push('authTokens.kinds must be a non-empty array')
    } else {
      const kindIds = new Set<string>()

      for (const kind of authTokens.kinds) {
        if (!kind || typeof kind !== 'object') {
          errors.push('authTokens.kinds entries must be objects')
          continue
        }

        if (!kind.id || typeof kind.id !== 'string') {
          errors.push('authTokens.kinds[].id is required and must be a string')
        } else if (kindIds.has(kind.id)) {
          errors.push(`authTokens.kinds contains duplicate id "${kind.id}"`)
        } else {
          kindIds.add(kind.id)
        }

        if (!kind.title || typeof kind.title !== 'string') {
          errors.push('authTokens.kinds[].title is required and must be a string')
        }

        const optionalFields: Array<[keyof PluginAuthTokenKind, string]> = [
          ['description', 'description'],
          ['createTitle', 'createTitle'],
          ['createDescription', 'createDescription'],
          ['emptyMessage', 'emptyMessage'],
          ['revokeMessage', 'revokeMessage'],
        ]
        for (const [fieldKey, fieldName] of optionalFields) {
          const value = kind[fieldKey]
          if (value !== undefined && typeof value !== 'string') {
            errors.push(`authTokens.kinds[].${fieldName} must be a string if provided`)
          }
        }

        if (!Array.isArray(kind.scopes) || kind.scopes.length === 0) {
          errors.push(`authTokens.kinds["${kind.id ?? 'unknown'}"].scopes must be a non-empty array`)
          continue
        }

        const scopeIds = new Set<string>()
        for (const scope of kind.scopes) {
          if (!scope || typeof scope !== 'object') {
            errors.push(`authTokens.kinds["${kind.id ?? 'unknown'}"].scopes entries must be objects`)
            continue
          }

          if (!scope.id || typeof scope.id !== 'string') {
            errors.push('authTokens.kinds[].scopes[].id is required and must be a string')
          } else if (scopeIds.has(scope.id)) {
            errors.push(
              `authTokens.kinds["${kind.id ?? 'unknown'}"].scopes contains duplicate id "${scope.id}"`
            )
          } else {
            scopeIds.add(scope.id)
          }

          if (!scope.label || typeof scope.label !== 'string') {
            errors.push('authTokens.kinds[].scopes[].label is required and must be a string')
          }

          if (scope.description !== undefined && typeof scope.description !== 'string') {
            errors.push('authTokens.kinds[].scopes[].description must be a string if provided')
          }

          if (scope.defaultChecked !== undefined && typeof scope.defaultChecked !== 'boolean') {
            errors.push('authTokens.kinds[].scopes[].defaultChecked must be a boolean if provided')
          }
        }
      }
    }
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

  // Main-app tier: design ownership + optional Tier B features
  // Per spec §1.3: Main App may contain a design module (always) + optional Tier B server module
  if (manifest.tier === 'main-app') {
    // Main-app cannot have routePrefix (routes go through standard plugin mount)
    if (manifest.routePrefix) {
      errors.push('main-app tier cannot have routePrefix (routes are mounted at app level)')
    }

    // Main-app CAN have tables, migrations, and authzNamespace (like Tier B)
    // Validate tables if present
    if (manifest.tables) {
      for (const table of manifest.tables) {
        if (!table.name.startsWith(`plugin_${manifest.pluginId}_`)) {
          errors.push(`Table "${table.name}" must be prefixed with "plugin_${manifest.pluginId}_"`)
        }
        if (table.hasTenantId !== true && !manifest.globalTables?.includes(table.name)) {
          errors.push(`Table "${table.name}" must declare hasTenantId: true (or be listed in globalTables)`)
        }
      }
    }

    // Validate migrations if present
    if (manifest.migrations) {
      if (typeof manifest.migrations.schemaVersion !== 'number' || manifest.migrations.schemaVersion < 0) {
        errors.push('migrations.schemaVersion must be a non-negative integer')
      }
      if (!manifest.migrations.dir || typeof manifest.migrations.dir !== 'string') {
        errors.push('migrations.dir is required when migrations is specified')
      }
    }

    // Validate authzNamespace if present
    if (manifest.authzNamespace && !manifest.authzNamespace.endsWith('.')) {
      errors.push('authzNamespace must end with a dot (e.g., "notarium.")')
    }

    // Main-app must request design capabilities
    if (Array.isArray(manifest.requestedCapabilities)) {
      const hasDesignCapability = manifest.requestedCapabilities.some(
        (cap) => cap.capability === 'ui:design:global'
      )
      if (!hasDesignCapability) {
        errors.push(
          'main-app tier must request "ui:design:global" capability. ' +
            'Add { capability: "ui:design:global", reason: "..." } to requestedCapabilities.'
        )
      }
    }
  }

  // Validate accessControl if present
  if (manifest.accessControl !== undefined) {
    if (
      typeof manifest.accessControl !== 'object' ||
      manifest.accessControl === null ||
      Array.isArray(manifest.accessControl)
    ) {
      errors.push('accessControl must be a plain object (not null or array)')
    } else if (manifest.accessControl.requiredRole !== undefined) {
      if (!VALID_REQUIRED_ROLES.includes(manifest.accessControl.requiredRole as PluginRequiredRole)) {
        errors.push(
          `accessControl.requiredRole must be one of: ${VALID_REQUIRED_ROLES.join(', ')} ` +
            `(got "${manifest.accessControl.requiredRole}")`
        )
      }
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

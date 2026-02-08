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
 * - C: Platform plugins (privileged) - controlled core service facades + Tier B features
 * - main-app: Design ownership (exactly one allowed) - global theme, baseline nav, shells
 */
export type PluginTier = 'A' | 'B' | 'C' | 'main-app'

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

export interface PluginFeatureDefinition {
  /** Default tenant state when no per-tenant override exists */
  defaultEnabled: boolean
}

export type PluginFeaturesMap = Record<string, PluginFeatureDefinition>

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

  /** Tier C: action hooks this plugin is allowed to dispatch */
  definedHooks?: string[]

  /** Tier C: filter hooks this plugin is allowed to dispatch */
  definedFilters?: string[]

  /** Optional route/runtime feature gates managed by core policy */
  features?: PluginFeaturesMap

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

  /** Tier C: deployment requires enterprise core support */
  requiresEnterprise?: boolean

  /** Tier C: enterprise features required by this plugin */
  requiredEnterpriseFeatures?: string[]

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

const HOOK_NAMESPACE_PATTERN = /^[a-z0-9-]+:[a-z0-9]+(?:[._-][a-z0-9]+)*$/i
const FEATURE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i

function validateRoutePrefix(pluginId: string, routePrefix: string, errors: string[]): void {
  const expectedPrefix = `/api/v1/apps/${pluginId}`
  const isExactMatch = routePrefix === expectedPrefix
  const isSubPath = routePrefix.startsWith(expectedPrefix + '/')
  if (!isExactMatch && !isSubPath) {
    errors.push(
      `routePrefix must be exactly "${expectedPrefix}" or start with "${expectedPrefix}/" ` +
        `(got "${routePrefix}"). Plugins cannot mount routes outside their namespace.`
    )
  }
}

function validatePluginTables(
  pluginId: string,
  tables: PluginTableDeclaration[] | undefined,
  errors: string[],
  globalTables?: string[]
): void {
  if (!tables) return

  for (const table of tables) {
    if (!table.name.startsWith(`plugin_${pluginId}_`)) {
      errors.push(`Table "${table.name}" must be prefixed with "plugin_${pluginId}_"`)
    }
    if (table.hasTenantId !== true && !globalTables?.includes(table.name)) {
      errors.push(`Table "${table.name}" must declare hasTenantId: true`)
    }
  }
}

function validateMigrations(migrations: PluginMigrationConfig | undefined, errors: string[]): void {
  if (!migrations) return

  if (typeof migrations.schemaVersion !== 'number' || migrations.schemaVersion < 0) {
    errors.push('migrations.schemaVersion must be a non-negative integer')
  }
  if (!migrations.dir || typeof migrations.dir !== 'string') {
    errors.push('migrations.dir is required when migrations is specified')
  }
}

function validateDefinedHookNames(
  pluginId: string,
  hookNames: string[] | undefined,
  fieldName: 'definedHooks' | 'definedFilters',
  errors: string[]
): void {
  if (!hookNames) return

  for (const hookName of hookNames) {
    if (typeof hookName !== 'string' || hookName.length === 0) {
      errors.push(`${fieldName} must contain only non-empty strings`)
      continue
    }

    if (!hookName.startsWith(`${pluginId}:`)) {
      errors.push(`${fieldName} hook "${hookName}" must be prefixed with "${pluginId}:"`)
    }

    if (!HOOK_NAMESPACE_PATTERN.test(hookName)) {
      errors.push(
        `${fieldName} hook "${hookName}" is invalid. Expected format "{pluginId}:{event.name}"`
      )
    }
  }
}

function validateFeatures(features: PluginFeaturesMap | undefined, errors: string[]): void {
  if (features === undefined) {
    return
  }

  if (typeof features !== 'object' || features === null || Array.isArray(features)) {
    errors.push('features must be an object mapping feature IDs to { defaultEnabled: boolean }')
    return
  }

  for (const [featureId, definition] of Object.entries(features)) {
    if (!FEATURE_ID_PATTERN.test(featureId)) {
      errors.push(
        `Feature "${featureId}" is invalid. Expected format "{name}" using letters/numbers with optional . _ - separators.`
      )
      continue
    }

    if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) {
      errors.push(`features["${featureId}"] must be an object`)
      continue
    }

    if (typeof definition.defaultEnabled !== 'boolean') {
      errors.push(`features["${featureId}"].defaultEnabled must be a boolean`)
    }
  }
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

  if (!manifest.tier || !['A', 'B', 'C', 'main-app'].includes(manifest.tier)) {
    errors.push('tier must be "A", "B", "C", or "main-app"')
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

  if (Array.isArray(manifest.requestedCapabilities)) {
    const requestedCapabilityIds = manifest.requestedCapabilities.map((cap) => cap.capability)

    for (const capabilityId of requestedCapabilityIds) {
      if (capabilityId.startsWith('core:') && capabilityId.includes('.')) {
        errors.push(
          `Capability "${capabilityId}" is invalid. core:* capabilities must use ":" separators, not "."`
        )
      }
    }

    if (manifest.tier !== 'C') {
      const coreCapabilities = requestedCapabilityIds.filter((capabilityId) =>
        capabilityId.startsWith('core:')
      )
      if (coreCapabilities.length > 0) {
        errors.push(
          `Only Tier C plugins can request core:* capabilities. Found: ${coreCapabilities.join(', ')}`
        )
      }
    }
  }

  validateFeatures(manifest.features, errors)

  // Tier B specific validations
  if (manifest.tier === 'B') {
    if (manifest.routePrefix) {
      validateRoutePrefix(manifest.pluginId, manifest.routePrefix, errors)
    }

    validatePluginTables(manifest.pluginId, manifest.tables, errors)
    validateMigrations(manifest.migrations, errors)

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

    if (manifest.definedHooks && manifest.definedHooks.length > 0) {
      errors.push('Tier B plugins cannot declare definedHooks (Tier C only)')
    }
    if (manifest.definedFilters && manifest.definedFilters.length > 0) {
      errors.push('Tier B plugins cannot declare definedFilters (Tier C only)')
    }
    if (manifest.requiresEnterprise !== undefined) {
      errors.push('Tier B plugins cannot declare requiresEnterprise')
    }
    if (manifest.requiredEnterpriseFeatures !== undefined) {
      errors.push('Tier B plugins cannot declare requiredEnterpriseFeatures')
    }
  }

  // Tier C specific validations
  if (manifest.tier === 'C') {
    if (manifest.routePrefix) {
      validateRoutePrefix(manifest.pluginId, manifest.routePrefix, errors)
    }

    validatePluginTables(manifest.pluginId, manifest.tables, errors)
    validateMigrations(manifest.migrations, errors)

    if (manifest.authzNamespace !== undefined) {
      errors.push('Tier C plugins cannot set authzNamespace (it is derived as "{pluginId}.")')
    }

    validateDefinedHookNames(manifest.pluginId, manifest.definedHooks, 'definedHooks', errors)
    validateDefinedHookNames(manifest.pluginId, manifest.definedFilters, 'definedFilters', errors)

    const hasDefinedHooks = (manifest.definedHooks?.length ?? 0) > 0
    const hasDefinedFilters = (manifest.definedFilters?.length ?? 0) > 0
    if ((hasDefinedHooks || hasDefinedFilters) && Array.isArray(manifest.requestedCapabilities)) {
      const hasHooksDefineCapability = manifest.requestedCapabilities.some(
        (cap) => cap.capability === 'core:hooks:define'
      )
      if (!hasHooksDefineCapability) {
        errors.push(
          'definedHooks/definedFilters require the "core:hooks:define" capability in requestedCapabilities.'
        )
      }
    }

    if (
      manifest.requiresEnterprise !== undefined &&
      typeof manifest.requiresEnterprise !== 'boolean'
    ) {
      errors.push('requiresEnterprise must be a boolean if provided')
    }

    if (manifest.requiredEnterpriseFeatures !== undefined) {
      if (
        !Array.isArray(manifest.requiredEnterpriseFeatures) ||
        manifest.requiredEnterpriseFeatures.some(
          (featureId) => typeof featureId !== 'string' || featureId.trim().length === 0
        )
      ) {
        errors.push('requiredEnterpriseFeatures must be an array of non-empty strings')
      }
    }

    if (
      manifest.requiresEnterprise !== true &&
      (manifest.requiredEnterpriseFeatures?.length ?? 0) > 0
    ) {
      errors.push('requiredEnterpriseFeatures can only be declared when requiresEnterprise is true')
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
    if (manifest.definedHooks && manifest.definedHooks.length > 0) {
      errors.push('Tier A plugins cannot declare definedHooks (Tier C only)')
    }
    if (manifest.definedFilters && manifest.definedFilters.length > 0) {
      errors.push('Tier A plugins cannot declare definedFilters (Tier C only)')
    }
    if (manifest.requiresEnterprise !== undefined) {
      errors.push('Tier A plugins cannot declare requiresEnterprise')
    }
    if (manifest.requiredEnterpriseFeatures !== undefined) {
      errors.push('Tier A plugins cannot declare requiredEnterpriseFeatures')
    }
    if (manifest.features !== undefined) {
      errors.push('Tier A plugins cannot declare features (no server/runtime feature gates)')
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
    validatePluginTables(manifest.pluginId, manifest.tables, errors, manifest.globalTables)
    validateMigrations(manifest.migrations, errors)

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

    if (manifest.definedHooks && manifest.definedHooks.length > 0) {
      errors.push('main-app plugins cannot declare definedHooks (Tier C only)')
    }
    if (manifest.definedFilters && manifest.definedFilters.length > 0) {
      errors.push('main-app plugins cannot declare definedFilters (Tier C only)')
    }
    if (manifest.requiresEnterprise !== undefined) {
      errors.push('main-app plugins cannot declare requiresEnterprise')
    }
    if (manifest.requiredEnterpriseFeatures !== undefined) {
      errors.push('main-app plugins cannot declare requiredEnterpriseFeatures')
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
  /** Tier C runtime core capabilities granted at deployment scope */
  deploymentGrantedCoreCapabilities?: string[]
  /** Boot timestamp */
  bootedAt?: Date
}

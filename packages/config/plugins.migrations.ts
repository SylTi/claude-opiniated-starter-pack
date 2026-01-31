/**
 * Plugin Migrations Resolver
 *
 * Resolves plugin migration directories for use in adonisrc.ts.
 * Side-effect-free: Only reads plugin.meta.json, never imports entrypoints.
 *
 * This module is compiled to JS and can be safely imported at build time.
 *
 * SPEC COMPLIANCE:
 * - Uses static loader maps (no fs.readdir)
 * - Resolution happens in @pkg/config (package that owns plugin deps)
 * - Migration discovery is metadata-driven (plugin.meta.json)
 */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { serverPluginManifests, serverPluginPackages } from './plugins.server.js'

// Use createRequire to resolve package paths (works in ESM)
const require = createRequire(import.meta.url)

/**
 * Resolved migration directory info.
 */
export interface PluginMigrationInfo {
  pluginId: string
  packageName: string
  migrationDir: string
  schemaVersion: number
}

/**
 * Resolve the absolute path to a plugin's migration directory.
 * Uses require.resolve to find the package, then combines with migrations.dir.
 *
 * @param packageName - The plugin package name (e.g., '@plugins/notes')
 * @param migrationsDir - The relative migrations directory from plugin.meta.json
 */
function resolvePluginMigrationPath(packageName: string, migrationsDir: string): string {
  try {
    // Resolve the plugin.meta.json to get the package root
    const metaPath = require.resolve(`${packageName}/plugin.meta.json`)
    const packageRoot = dirname(metaPath)

    // Combine with the migrations directory
    return join(packageRoot, migrationsDir)
  } catch (error) {
    // Package not found or exports issue
    throw new Error(
      `Could not resolve migration path for ${packageName}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Resolve plugin migration directories.
 * Returns absolute paths to migration directories for plugins that have migrations.
 *
 * This function is async because it loads plugin manifests dynamically.
 *
 * Note: This requires all plugin packages to be installed.
 */
export async function resolvePluginMigrationDirs(): Promise<PluginMigrationInfo[]> {
  const migrations: PluginMigrationInfo[] = []

  for (const [pluginId, loader] of Object.entries(serverPluginManifests)) {
    try {
      const manifest = await loader()

      // Skip plugins without migrations
      if (!manifest.migrations?.dir) {
        continue
      }

      // Resolve the absolute path using require.resolve
      const absolutePath = resolvePluginMigrationPath(manifest.packageName, manifest.migrations.dir)

      migrations.push({
        pluginId,
        packageName: manifest.packageName,
        migrationDir: absolutePath,
        schemaVersion: manifest.migrations.schemaVersion,
      })
    } catch (error) {
      // Log but don't fail - plugin may not be installed yet
      console.warn(`Could not load manifest for plugin "${pluginId}":`, error)
    }
  }

  return migrations
}

/**
 * Synchronously resolve plugin migration directories.
 * Uses serverPluginPackages for authoritative package names (no convention assumptions).
 *
 * This is useful for configuration files that need synchronous initialization.
 * It reads the plugin.meta.json files synchronously using require.
 */
export function resolvePluginMigrationDirsSync(): PluginMigrationInfo[] {
  const migrations: PluginMigrationInfo[] = []

  // Use serverPluginPackages for authoritative package names
  for (const [pluginId, packageName] of Object.entries(serverPluginPackages)) {
    try {
      // Load plugin.meta.json synchronously
      const metaPath = require.resolve(`${packageName}/plugin.meta.json`)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const manifest = require(metaPath)

      // Skip plugins without migrations
      if (!manifest.migrations?.dir) {
        continue
      }

      // Resolve the absolute path
      const packageRoot = dirname(metaPath)
      const absolutePath = join(packageRoot, manifest.migrations.dir)

      migrations.push({
        pluginId,
        packageName: manifest.packageName,
        migrationDir: absolutePath,
        schemaVersion: manifest.migrations.schemaVersion,
      })
    } catch (error) {
      // Log but don't fail - plugin may not be installed yet
      console.warn(`Could not load manifest for plugin "${pluginId}":`, error)
    }
  }

  return migrations
}

/**
 * Get just the migration directory paths (for use in database config).
 * Returns absolute paths that can be used directly in Adonis migration config.
 */
export function getPluginMigrationPaths(): string[] {
  const infos = resolvePluginMigrationDirsSync()
  return infos.map((info) => info.migrationDir)
}

/**
 * Get the expected schema version for a plugin.
 * Returns null if plugin has no migrations or manifest couldn't be loaded.
 */
export async function getExpectedSchemaVersion(pluginId: string): Promise<number | null> {
  const loader = serverPluginManifests[pluginId]
  if (!loader) return null

  try {
    const manifest = await loader()
    return manifest.migrations?.schemaVersion ?? null
  } catch {
    return null
  }
}

/**
 * Get all expected schema versions for all plugins.
 * Returns a map of pluginId -> schemaVersion.
 */
export async function getAllExpectedSchemaVersions(): Promise<Map<string, number>> {
  const versions = new Map<string, number>()

  for (const [pluginId, loader] of Object.entries(serverPluginManifests)) {
    try {
      const manifest = await loader()
      if (manifest.migrations?.schemaVersion != null) {
        versions.set(pluginId, manifest.migrations.schemaVersion)
      }
    } catch {
      // Skip plugins that fail to load
    }
  }

  return versions
}

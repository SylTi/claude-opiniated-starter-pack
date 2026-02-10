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

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serverPluginManifests, serverPluginPackages } from './plugins.server.js'

// Use createRequire to resolve package paths (works in ESM)
const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

function getMonorepoRoot(): string {
  return resolve(__dirname, '../..')
}

function getPluginRootById(pluginId: string): string {
  return join(getMonorepoRoot(), 'plugins', pluginId)
}

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
 * Resolved plugin test seeder file info.
 */
export interface PluginTestSeederInfo {
  pluginId: string
  packageName: string
  seederFilePath: string
}

const TEST_SEEDER_CANDIDATES = [
  'database/seeders/test_data_seeder.ts',
  'database/seeders/test_data_seeder.js',
  'database/seeders/test_data.ts',
  'database/seeders/test_data.js',
]

function resolvePluginRoot(pluginId: string, packageName: string): string {
  try {
    const metaPath = require.resolve(`${packageName}/plugin.meta.json`)
    return dirname(metaPath)
  } catch {
    const pluginRoot = getPluginRootById(pluginId)
    const manifestPath = join(pluginRoot, 'plugin.meta.json')
    if (existsSync(manifestPath)) {
      return pluginRoot
    }
  }

  throw new Error(`Could not resolve plugin root for ${packageName} (pluginId=${pluginId})`)
}

/**
 * Resolve the absolute path to a plugin's migration directory.
 * First tries package resolution, then falls back to monorepo plugin path.
 *
 * @param pluginId - The plugin id (e.g., 'notes')
 * @param packageName - The plugin package name (e.g., '@plugins/notes')
 * @param migrationsDir - The relative migrations directory from plugin.meta.json
 */
function resolvePluginMigrationPath(
  pluginId: string,
  packageName: string,
  migrationsDir: string
): string {
  try {
    const packageRoot = resolvePluginRoot(pluginId, packageName)
    return join(packageRoot, migrationsDir)
  } catch {
    const pluginRoot = getPluginRootById(pluginId)
    const manifestPath = join(pluginRoot, 'plugin.meta.json')
    if (existsSync(manifestPath)) {
      return join(pluginRoot, migrationsDir)
    }
  }

  throw new Error(`Could not resolve migration path for ${packageName} (pluginId=${pluginId})`)
}

function loadManifestSync(pluginId: string, packageName: string): Record<string, unknown> {
  try {
    const metaPath = require.resolve(`${packageName}/plugin.meta.json`)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(metaPath) as Record<string, unknown>
  } catch {
    const manifestPath = join(getPluginRootById(pluginId), 'plugin.meta.json')
    if (!existsSync(manifestPath)) {
      throw new Error(`Manifest not found at ${manifestPath}`)
    }

    const content = readFileSync(manifestPath, 'utf-8')
    return JSON.parse(content) as Record<string, unknown>
  }
}

/**
 * Resolve plugin migration directories.
 * Returns absolute paths to migration directories for plugins that have migrations.
 *
 * This function is async because it loads plugin manifests dynamically.
 *
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

      const absolutePath = resolvePluginMigrationPath(
        pluginId,
        manifest.packageName,
        manifest.migrations.dir
      )

      migrations.push({
        pluginId,
        packageName: manifest.packageName,
        migrationDir: absolutePath,
        schemaVersion: manifest.migrations.schemaVersion,
      })
    } catch (error) {
      // Log but don't fail - plugin may not be installed or present in this checkout.
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
      const manifest = loadManifestSync(pluginId, packageName) as {
        packageName: string
        migrations?: { dir?: string; schemaVersion?: number }
      }

      // Skip plugins without migrations
      if (!manifest.migrations?.dir) {
        continue
      }
      if (typeof manifest.migrations.schemaVersion !== 'number') {
        continue
      }

      const absolutePath = resolvePluginMigrationPath(pluginId, packageName, manifest.migrations.dir)

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
 * Synchronously resolve plugin test seeders.
 *
 * Convention-based and optional:
 * - database/seeders/test_data_seeder.ts
 * - database/seeders/test_data_seeder.js
 * - database/seeders/test_data.ts
 * - database/seeders/test_data.js
 */
export function resolvePluginTestSeedersSync(): PluginTestSeederInfo[] {
  const seeders: PluginTestSeederInfo[] = []

  for (const [pluginId, packageName] of Object.entries(serverPluginPackages)) {
    try {
      const pluginRoot = resolvePluginRoot(pluginId, packageName)
      const seederFilePath = TEST_SEEDER_CANDIDATES
        .map((candidate) => join(pluginRoot, candidate))
        .find((candidatePath) => existsSync(candidatePath))

      if (!seederFilePath) {
        continue
      }

      seeders.push({
        pluginId,
        packageName,
        seederFilePath,
      })
    } catch {
      // Plugin package/folder is not available in this checkout.
      continue
    }
  }

  return seeders
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

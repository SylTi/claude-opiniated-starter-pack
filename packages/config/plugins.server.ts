/**
 * Server Plugin Loader Maps
 *
 * Static loader maps for server-side plugin discovery.
 * NO fs.readdir at runtime - all plugins must be listed here.
 *
 * Plugin configuration is in plugins.config.ts (can be overridden per deployment).
 * This file contains the loading logic which receives upstream updates.
 */

import type { PluginManifest } from '@saas/plugins-core'
import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_PLUGINS, getMainAppPluginId } from './plugins.config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Get the monorepo root directory.
 * packages/config -> ../.. -> monorepo root
 */
function getMonorepoRoot(): string {
  return resolve(__dirname, '../..')
}

/**
 * Load JSON manifest by reading the file directly.
 */
function loadJsonManifest(pluginId: string): PluginManifest {
  const manifestPath = join(getMonorepoRoot(), 'plugins', pluginId, 'plugin.meta.json')
  const content = readFileSync(manifestPath, 'utf-8')
  return JSON.parse(content) as PluginManifest
}

/**
 * Type for manifest loader function.
 */
export type ManifestLoader = () => Promise<PluginManifest>

/**
 * Type for plugin server entrypoint loader.
 */
export type ServerPluginLoader = () => Promise<{
  default?: unknown
  register?: (context: unknown) => void | Promise<void>
}>

/**
 * Static map of plugin package names.
 * Used for sync resolution - the packageName from metadata is authoritative.
 *
 * Keys are plugin IDs, values are package names (e.g., '@plugins/notes').
 */
export const serverPluginPackages: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_PLUGINS).map(([id, config]) => [id, config.packageName])
)

/**
 * Static map of plugin manifests.
 * Keys are plugin IDs, values are loaders for plugin.meta.json.
 */
export const serverPluginManifests: Record<string, ManifestLoader> = Object.fromEntries(
  Object.entries(ALL_PLUGINS).map(([id]) => [
    id,
    async () => loadJsonManifest(id),
  ])
)

/**
 * Static map of plugin server entrypoints.
 * Keys are plugin IDs, values are dynamic imports of server.js.
 */
export const serverPluginLoaders: Record<string, ServerPluginLoader> = Object.fromEntries(
  Object.entries(ALL_PLUGINS).map(([id, config]) => [
    id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.serverImport as any,
  ])
)

/**
 * Get all registered plugin IDs.
 */
export function getRegisteredPluginIds(): string[] {
  return Object.keys(serverPluginManifests)
}

/**
 * Check if a plugin is registered.
 */
export function isPluginRegistered(pluginId: string): boolean {
  return pluginId in serverPluginManifests
}

/**
 * Get the main-app plugin ID.
 */
export { getMainAppPluginId }

/**
 * Load a plugin's manifest.
 */
export async function loadPluginManifest(pluginId: string): Promise<PluginManifest | null> {
  const loader = serverPluginManifests[pluginId]
  if (!loader) return null

  try {
    return await loader()
  } catch (error) {
    console.error(`Failed to load manifest for plugin "${pluginId}":`, error)
    return null
  }
}

/**
 * Load all plugin manifests.
 */
export async function loadAllPluginManifests(): Promise<Map<string, PluginManifest>> {
  const manifests = new Map<string, PluginManifest>()

  for (const pluginId of Object.keys(serverPluginManifests)) {
    const manifest = await loadPluginManifest(pluginId)
    if (manifest) {
      manifests.set(pluginId, manifest)
    }
  }

  return manifests
}

/**
 * Load a plugin's server entrypoint.
 */
export async function loadPluginServer(pluginId: string): Promise<unknown | null> {
  const loader = serverPluginLoaders[pluginId]
  if (!loader) return null

  try {
    return await loader()
  } catch (error) {
    console.error(`Failed to load server entrypoint for plugin "${pluginId}":`, error)
    return null
  }
}

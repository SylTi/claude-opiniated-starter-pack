/**
 * Client Plugin Loader Maps
 *
 * Static loader maps for client-side plugin discovery.
 * NO fs.readdir at runtime - all plugins come from plugins.config.ts.
 */

import type { PluginManifest } from '@saas/plugins-core'
import { ALL_PLUGINS, extractManifest, getMainAppPluginId } from './plugins.config.js'

/**
 * Type for manifest loader function.
 */
export type ManifestLoader = () => Promise<PluginManifest>

/**
 * Type for plugin client entrypoint loader.
 */
export type ClientPluginLoader = () => Promise<{
  default?: unknown
  register?: (context: unknown) => void | Promise<void>
}>

/**
 * Static map of plugin package names for client.
 * Used for sync resolution - the packageName from metadata is authoritative.
 *
 * Keys are plugin IDs, values are package names (e.g., '@plugins/notes').
 * This MUST stay in sync with clientPluginManifests.
 *
 */
export const clientPluginPackages: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_PLUGINS).map(([id, config]) => [id, config.packageName])
)

/**
 * Static map of plugin manifests for the client.
 * Keys are plugin IDs, values are dynamic imports of plugin.meta.json.
 *
 */
export const clientPluginManifests: Record<string, ManifestLoader> = Object.fromEntries(
  Object.entries(ALL_PLUGINS).map(([id, config]) => [
    id,
    async () => {
      const imported = await config.manifestImport()
      return extractManifest(imported)
    },
  ])
)

/**
 * Static map of plugin client entrypoints.
 * Keys are plugin IDs, values are dynamic imports of client.js.
 *
 */
export const clientPluginLoaders: Record<string, ClientPluginLoader> = Object.fromEntries(
  Object.entries(ALL_PLUGINS).map(([id, config]) => [
    id,
    config.clientImport,
  ])
)

/**
 * Get all registered plugin IDs for the client.
 */
export function getRegisteredClientPluginIds(): string[] {
  return Object.keys(clientPluginManifests)
}

/**
 * Check if a plugin has a client entrypoint.
 */
export { getMainAppPluginId }

export function hasClientEntrypoint(pluginId: string): boolean {
  return pluginId in clientPluginLoaders
}

/**
 * Load a plugin's manifest for the client.
 */
export async function loadClientPluginManifest(pluginId: string): Promise<PluginManifest | null> {
  const loader = clientPluginManifests[pluginId]
  if (!loader) return null

  try {
    return await loader()
  } catch (error) {
    console.error(`Failed to load manifest for plugin "${pluginId}":`, error)
    return null
  }
}

/**
 * Load a plugin's client entrypoint.
 */
export async function loadClientPlugin(pluginId: string): Promise<unknown | null> {
  const loader = clientPluginLoaders[pluginId]
  if (!loader) return null

  try {
    return await loader()
  } catch (error) {
    console.error(`Failed to load client entrypoint for plugin "${pluginId}":`, error)
    return null
  }
}

/**
 * Client Plugin Loader Maps
 *
 * Static loader maps for client-side plugin discovery.
 * NO fs.readdir at runtime - all plugins must be listed here.
 *
 * To add a new plugin:
 * 1. Add its manifest loader to clientPluginManifests
 * 2. Add its client entrypoint loader to clientPluginLoaders
 */

import type { PluginManifest } from '@saas/plugins-core'

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
 */
export const clientPluginPackages: Record<string, string> = {
  'nav-links': '@plugins/nav-links',
  notes: '@plugins/notes',
}

/**
 * Static map of plugin manifests for the client.
 * Keys are plugin IDs, values are dynamic imports of plugin.meta.json.
 */
export const clientPluginManifests: Record<string, ManifestLoader> = {
  // Example Tier A plugin
  'nav-links': async () => {
    const mod = await import('@plugins/nav-links/plugin.meta.json')
    return mod.default as PluginManifest
  },

  // Example Tier B plugin
  notes: async () => {
    const mod = await import('@plugins/notes/plugin.meta.json')
    return mod.default as PluginManifest
  },
}

/**
 * Static map of plugin client entrypoints.
 * Keys are plugin IDs, values are dynamic imports of client.js.
 */
export const clientPluginLoaders: Record<string, ClientPluginLoader> = {
  // Tier A plugins have client entrypoints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'nav-links': () => import('@plugins/nav-links') as any,

  // Tier B plugins may also have client entrypoints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notes: () => import('@plugins/notes/client') as any,
}

/**
 * Get all registered plugin IDs for the client.
 */
export function getRegisteredClientPluginIds(): string[] {
  return Object.keys(clientPluginManifests)
}

/**
 * Check if a plugin has a client entrypoint.
 */
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

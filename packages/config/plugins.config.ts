/**
 * Plugin Configuration
 *
 * This is the SINGLE FILE to edit when switching main-app plugins.
 *
 * Currently configured for: @plugins/main-app
 */

import type { PluginManifest } from '@saas/plugins-core'

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type PluginClientModule = {
  [key: string]: unknown
  default?: unknown
  register?(context: unknown): void | Promise<void>
}

export type PluginConfig = {
  id: string
  packageName: string
  /**
   * Server entrypoint package path used by API runtime.
   * Defaults to packageName when omitted.
   */
  serverEntrypoint?: string
  clientImport: () => Promise<PluginClientModule>
  manifestImport: () => Promise<unknown>
}

type PluginConfigOptions = {
  packageName?: string
  serverEntrypoint?: string
  clientEntrypoint?: string
  manifestEntrypoint?: string
}

/**
 * Create a plugin config using convention-based defaults.
 *
 * Defaults:
 * - packageName: @plugins/{id}
 * - serverEntrypoint: packageName
 * - clientEntrypoint: {packageName}/client
 * - manifestEntrypoint: {packageName}/plugin.meta.json
 */
function createPluginConfig(id: string, options: PluginConfigOptions = {}): PluginConfig {
  const packageName = options.packageName ?? `@plugins/${id}`
  const serverEntrypoint = options.serverEntrypoint ?? packageName
  const clientEntrypoint = options.clientEntrypoint ?? `${packageName}/client`
  const manifestEntrypoint = options.manifestEntrypoint ?? `${packageName}/plugin.meta.json`

  return {
    id,
    packageName,
    serverEntrypoint,
    clientImport: () => import(clientEntrypoint),
    manifestImport: () => import(manifestEntrypoint),
  }
}

// =============================================================================
// MAIN-APP PLUGIN
// =============================================================================

/**
 * Main-app plugin configuration.
 * Currently using @plugins/main-app as the main-app plugin.
 */
export const MAIN_APP_PLUGIN: PluginConfig = {
  id: 'main-app',
  packageName: '@plugins/main-app',
  serverEntrypoint: '@plugins/main-app',
  clientImport: () => import('@plugins/main-app/client'),
  manifestImport: () => import('@plugins/main-app/plugin.meta.json'),
}

// =============================================================================
// ADDITIONAL PLUGINS (Tier A, Tier B, Tier C)
// =============================================================================

/**
 * Additional plugins to load (besides main-app).
 */
export const ADDITIONAL_PLUGINS: Record<string, PluginConfig> = {
  'nav-links': createPluginConfig('nav-links', {
    serverEntrypoint: '@plugins/nav-links/server',
    clientEntrypoint: '@plugins/nav-links',
  }),
  notes: createPluginConfig('notes'),
}

// =============================================================================
// EXPORTS
// =============================================================================

export const ALL_PLUGINS: Record<string, PluginConfig> = {
  [MAIN_APP_PLUGIN.id]: MAIN_APP_PLUGIN,
  ...ADDITIONAL_PLUGINS,
}

export function getMainAppPluginId(): string {
  return MAIN_APP_PLUGIN.id
}

/**
 * Helper to extract manifest from import result.
 */
export function extractManifest(imported: unknown): PluginManifest {
  const mod = imported as { default?: PluginManifest } & PluginManifest
  return (mod.default ?? mod) as PluginManifest
}

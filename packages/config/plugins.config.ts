/**
 * Plugin Configuration
 *
 * This is the SINGLE FILE to edit when switching main-app plugins.
 *
 * Currently configured for: @plugins/main-app
 */
/// <reference path="./plugins-modules.d.ts" />

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

/**
 * NOTE: Each plugin MUST use literal string imports (not variables) so that
 * Turbopack can statically analyze and resolve them at build time.
 * Do NOT use createPluginConfig() with dynamic variable imports.
 */

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
  'nav-links': {
    id: 'nav-links',
    packageName: '@plugins/nav-links',
    serverEntrypoint: '@plugins/nav-links/server',
    clientImport: () => import('@plugins/nav-links'),
    manifestImport: () => import('@plugins/nav-links/plugin.meta.json'),
  },
  notes: {
    id: 'notes',
    packageName: '@plugins/notes',
    clientImport: () => import('@plugins/notes/client'),
    manifestImport: () => import('@plugins/notes/plugin.meta.json'),
  },
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

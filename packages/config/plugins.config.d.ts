/**
 * Plugin Configuration
 *
 * This is the SINGLE FILE to edit when switching main-app plugins.
 *
 * DEPLOYMENT OVERRIDE (e.g., to use notarium instead of main-app):
 * 1. git update-index --skip-worktree packages/config/plugins.config.ts
 * 2. Change MAIN_APP_PLUGIN config (lines ~33-39)
 * 3. Change the re-exports at the bottom (design and clientDesign imports)
 *
 * Example for notarium:
 *   MAIN_APP_PLUGIN.packageName = '@plugins/notarium'
 *   export { design } from '@plugins/notarium'
 *   export { clientDesign } from '@plugins/notarium/client'
 */
import type { PluginManifest } from '@saas/plugins-core';
export type PluginConfig = {
    id: string;
    packageName: string;
    serverImport: () => Promise<unknown>;
    clientImport: () => Promise<unknown>;
    manifestImport: () => Promise<unknown>;
};
/**
 * Main-app plugin configuration.
 */
export declare const MAIN_APP_PLUGIN: PluginConfig;
/**
 * Additional plugins to load (besides main-app).
 */
export declare const ADDITIONAL_PLUGINS: Record<string, PluginConfig>;
export declare const ALL_PLUGINS: Record<string, PluginConfig>;
export declare function getMainAppPluginId(): string;
/**
 * Helper to extract manifest from import result.
 * JSON imports have the manifest as both default export and spread on module.
 */
export declare function extractManifest(imported: unknown): PluginManifest;
/** Server-side design export */
export { design } from '@plugins/main-app';
/** Client-side design export */
export { clientDesign } from '@plugins/main-app/client';
//# sourceMappingURL=plugins.config.d.ts.map
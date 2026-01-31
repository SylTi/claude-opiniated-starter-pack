/**
 * Plugin Type Augmentation
 *
 * This file imports type augmentations from all registered plugins.
 * Include this file in your tsconfig to get full type support for plugins.
 */

// Import type augmentations from plugins
// These are conditionally imported based on what's installed

// Example: Import types from nav-links plugin
/// <reference types="@plugins/nav-links/types" />

// Example: Import types from notes plugin
/// <reference types="@plugins/notes/types" />

/**
 * Augment the HookRegistry with plugin-specific hooks.
 * Plugins can add their own hook types here.
 */
declare module '@saas/plugins-core' {
  interface PluginHookContext {
    // Plugins can augment this interface with their context types
  }
}

export {}

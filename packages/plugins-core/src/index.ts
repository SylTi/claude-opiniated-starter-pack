/**
 * @saas/plugins-core
 *
 * Core package for the plugin system.
 * Provides types, registries, enforcement, navigation, and migration helpers for plugins.
 */

// Types
export * from './types/index.js'

// Registries
export * from './registry/index.js'

// Enforcement
export * from './enforcement/index.js'

// Navigation
export * from './navigation/index.js'

// Migration helpers
export * from './migrations/index.js'

// NOTE: Framework context is NOT re-exported here because it uses React hooks
// and would break server component imports. Import from '@saas/plugins-core/framework' instead.

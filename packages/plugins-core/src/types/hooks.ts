/**
 * Plugin Hook Definitions
 *
 * WordPress-style hooks for plugin extensibility.
 * Two types: filters (modify data) and actions (side effects).
 */

/**
 * Priority levels for hook execution.
 * Lower numbers execute first.
 */
export const HOOK_PRIORITY = {
  HIGHEST: 0,
  HIGH: 25,
  NORMAL: 50,
  LOW: 75,
  LOWEST: 100,
} as const

export type HookPriority = (typeof HOOK_PRIORITY)[keyof typeof HOOK_PRIORITY] | number

/**
 * Filter callback - receives data and returns modified data.
 * Filters are pure functions that transform data.
 */
export type FilterCallback<T = unknown> = (data: T, context?: Record<string, unknown>) => T | Promise<T>

/**
 * Action callback - receives data and performs side effects.
 * Actions don't return values.
 */
export type ActionCallback<T = unknown> = (data: T, context?: Record<string, unknown>) => void | Promise<void>

/**
 * Registered hook handler with metadata.
 */
export interface HookHandler<T = unknown> {
  /** Plugin that registered this hook */
  pluginId: string
  /** Hook callback function */
  callback: FilterCallback<T> | ActionCallback<T>
  /** Execution priority (lower = earlier) */
  priority: HookPriority
  /** Order of registration (for stable sorting) */
  registrationOrder: number
}

/**
 * Hook registration options.
 */
export interface HookRegistrationOptions {
  /** Execution priority (default: NORMAL) */
  priority?: HookPriority
}

/**
 * Hook registration declared in plugin.meta.json.
 */
export interface HookRegistration {
  /** Hook name (e.g., 'nav:items', 'dashboard:widgets') */
  hook: string
  /** Handler function name to call */
  handler: string
  /** Execution priority */
  priority?: HookPriority
}

/**
 * Built-in filter hooks.
 */
export const FILTER_HOOKS = {
  // Navigation
  'nav:items': 'nav:items',
  'nav:user-menu': 'nav:user-menu',

  // Dashboard
  'dashboard:widgets': 'dashboard:widgets',
  'dashboard:stats': 'dashboard:stats',

  // Settings
  'settings:sections': 'settings:sections',

  // API responses (server-side)
  'api:response': 'api:response',
} as const

export type FilterHook = (typeof FILTER_HOOKS)[keyof typeof FILTER_HOOKS]

/**
 * Built-in action hooks.
 */
export const ACTION_HOOKS = {
  // Lifecycle
  'app:boot': 'app:boot',
  'app:ready': 'app:ready',
  'app:shutdown': 'app:shutdown',

  // User events
  'user:login': 'user:login',
  'user:logout': 'user:logout',

  // Tenant events
  'tenant:switch': 'tenant:switch',
  'tenant:create': 'tenant:create',
} as const

export type ActionHook = (typeof ACTION_HOOKS)[keyof typeof ACTION_HOOKS]

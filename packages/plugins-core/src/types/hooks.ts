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
 * Type maps that plugins can augment for strongly-typed hooks.
 */
export interface ServerActionHooks {}
export interface ServerFilterHooks {}
export interface ClientFilterHooks {}

/**
 * Plugin-facing hook contract: listener registration only.
 * Dispatch methods are intentionally excluded from this surface.
 */
export interface HookListenerRegistry {
  registerAction<H extends keyof ServerActionHooks & string>(
    hook: H,
    cb: (
      ...args: ServerActionHooks[H] extends unknown[] ? ServerActionHooks[H] : unknown[]
    ) => void | Promise<void>,
    priority?: number
  ): () => void
  registerAction(
    hook: string,
    cb: (...args: unknown[]) => void | Promise<void>,
    priority?: number
  ): () => void

  registerFilter<H extends keyof ServerFilterHooks & string>(
    hook: H,
    cb: (
      ...args: ServerFilterHooks[H] extends unknown[] ? ServerFilterHooks[H] : unknown[]
    ) => unknown | Promise<unknown>,
    priority?: number
  ): () => void
  registerFilter(
    hook: string,
    cb: (...args: unknown[]) => unknown | Promise<unknown>,
    priority?: number
  ): () => void
}

/**
 * Browser-side listener registration contract (filters only).
 */
export interface ClientHookListenerRegistry {
  registerFilter<H extends keyof ClientFilterHooks & string>(
    hook: H,
    cb: (
      ...args: ClientFilterHooks[H] extends unknown[] ? ClientFilterHooks[H] : unknown[]
    ) => unknown | Promise<unknown>,
    priority?: number
  ): () => void
  registerFilter(
    hook: string,
    cb: (...args: unknown[]) => unknown | Promise<unknown>,
    priority?: number
  ): () => void
}

/**
 * Core-internal hook contract with dispatch APIs.
 */
export interface HookRegistryInternal extends HookListenerRegistry {
  dispatchAction(hookName: string, ...args: unknown[]): Promise<void>
  applyFilters<T>(hookName: string, initial: T, ...args: unknown[]): Promise<T>
}

/**
 * Built-in filter hooks.
 */
export const FILTER_HOOKS = {
  // Navigation (legacy - kept for backward compatibility)
  'nav:items': 'nav:items',
  'nav:user-menu': 'nav:user-menu',

  // Navigation V2 - section-based nav model
  'ui:nav:main': 'ui:nav:main',
  'ui:nav:admin': 'ui:nav:admin',
  'ui:user:menu': 'ui:user:menu',

  // Theme configuration
  'ui:theme:config': 'ui:theme:config',

  // Dashboard
  'dashboard:widgets': 'dashboard:widgets',
  'dashboard:stats': 'dashboard:stats',

  // Header
  'ui:header:actions': 'ui:header:actions',

  // Settings
  'settings:sections': 'settings:sections',

  // API responses (server-side)
  'api:response': 'api:response',
} as const

export type FilterHook = (typeof FILTER_HOOKS)[keyof typeof FILTER_HOOKS]

/**
 * Built-in action hooks.
 *
 * Aligned with plugin spec (section 2.2) plus additions for analytics
 * (DAU/MAU, MRR/ARR, Churn, LTV tracking).
 */
export const ACTION_HOOKS = {
  // Lifecycle
  'app:boot': 'app:boot',
  'app:ready': 'app:ready',
  'app:shutdown': 'app:shutdown',
  'app:resources.register': 'app:resources.register',

  // Auth (spec: section 2.2)
  'auth:registered': 'auth:registered',
  'auth:logged_in': 'auth:logged_in',
  'auth:logged_out': 'auth:logged_out',
  'auth:mfa_verified': 'auth:mfa_verified',
  'auth:password_reset': 'auth:password_reset',

  // Teams / Tenancy (spec: section 2.2 + additions)
  'team:created': 'team:created',
  'team:updated': 'team:updated',
  'team:deleted': 'team:deleted',
  'team:member_added': 'team:member_added',
  'team:member_removed': 'team:member_removed',
  'team:member_left': 'team:member_left',
  'team:switched': 'team:switched',

  // Billing (spec: section 2.2 + additions)
  'billing:customer_created': 'billing:customer_created',
  'billing:subscription_created': 'billing:subscription_created',
  'billing:subscription_updated': 'billing:subscription_updated',
  'billing:subscription_cancelled': 'billing:subscription_cancelled',
  'billing:invoice_paid': 'billing:invoice_paid',
  'billing:payment_failed': 'billing:payment_failed',

  // Compliance & System (spec: section 2.2) — observe only
  'audit:record': 'audit:record',
} as const

export type ActionHook = (typeof ACTION_HOOKS)[keyof typeof ACTION_HOOKS]

/**
 * Hook Registry
 *
 * Central registry for plugin hooks (filters and actions).
 * Implements WordPress-style hook system with priority ordering.
 *
 * Ordering: Hooks execute in (priority ASC, registrationOrder ASC) order.
 * This ensures deterministic execution order.
 */

import type {
  FilterCallback,
  ActionCallback,
  HookHandler,
  HookRegistrationOptions,
} from '../types/hooks.js'
import { HOOK_PRIORITY } from '../types/hooks.js'

/**
 * Hook Registry for managing filters and actions.
 */
export class HookRegistry {
  private filters: Map<string, HookHandler<unknown>[]> = new Map()
  private actions: Map<string, HookHandler<unknown>[]> = new Map()
  private registrationCounter: number = 0

  /**
   * Register a filter hook.
   * Filters modify data and return it.
   */
  addFilter<T = unknown>(
    hookName: string,
    pluginId: string,
    callback: FilterCallback<T>,
    options?: HookRegistrationOptions
  ): void {
    const priority = options?.priority ?? HOOK_PRIORITY.NORMAL
    const handler: HookHandler<unknown> = {
      pluginId,
      callback: callback as FilterCallback<unknown>,
      priority,
      registrationOrder: this.registrationCounter++,
    }

    const handlers = this.filters.get(hookName) ?? []
    handlers.push(handler)
    this.sortHandlers(handlers)
    this.filters.set(hookName, handlers)
  }

  /**
   * Register an action hook.
   * Actions perform side effects without returning data.
   */
  addAction<T = unknown>(
    hookName: string,
    pluginId: string,
    callback: ActionCallback<T>,
    options?: HookRegistrationOptions
  ): void {
    const priority = options?.priority ?? HOOK_PRIORITY.NORMAL
    const handler: HookHandler<unknown> = {
      pluginId,
      callback: callback as ActionCallback<unknown>,
      priority,
      registrationOrder: this.registrationCounter++,
    }

    const handlers = this.actions.get(hookName) ?? []
    handlers.push(handler)
    this.sortHandlers(handlers)
    this.actions.set(hookName, handlers)
  }

  /**
   * Remove a filter hook.
   */
  removeFilter(hookName: string, pluginId: string): boolean {
    const handlers = this.filters.get(hookName)
    if (!handlers) return false

    const filtered = handlers.filter((h) => h.pluginId !== pluginId)
    if (filtered.length === handlers.length) return false

    if (filtered.length === 0) {
      this.filters.delete(hookName)
    } else {
      this.filters.set(hookName, filtered)
    }
    return true
  }

  /**
   * Remove an action hook.
   */
  removeAction(hookName: string, pluginId: string): boolean {
    const handlers = this.actions.get(hookName)
    if (!handlers) return false

    const filtered = handlers.filter((h) => h.pluginId !== pluginId)
    if (filtered.length === handlers.length) return false

    if (filtered.length === 0) {
      this.actions.delete(hookName)
    } else {
      this.actions.set(hookName, filtered)
    }
    return true
  }

  /**
   * Remove all hooks registered by a plugin.
   * Called when a plugin is disabled or quarantined.
   */
  removeAllPluginHooks(pluginId: string): void {
    for (const [hookName, handlers] of this.filters) {
      const filtered = handlers.filter((h) => h.pluginId !== pluginId)
      if (filtered.length === 0) {
        this.filters.delete(hookName)
      } else {
        this.filters.set(hookName, filtered)
      }
    }

    for (const [hookName, handlers] of this.actions) {
      const filtered = handlers.filter((h) => h.pluginId !== pluginId)
      if (filtered.length === 0) {
        this.actions.delete(hookName)
      } else {
        this.actions.set(hookName, filtered)
      }
    }
  }

  /**
   * Apply filters to data.
   * Runs all registered filter callbacks in priority order.
   * If a filter throws, the error is logged and the next filter is called.
   */
  async applyFilters<T>(
    hookName: string,
    value: T,
    context?: Record<string, unknown>
  ): Promise<T> {
    const handlers = this.filters.get(hookName)
    if (!handlers || handlers.length === 0) {
      return value
    }

    let result = value
    for (const handler of handlers) {
      try {
        const callback = handler.callback as FilterCallback<T>
        result = await callback(result, context)
      } catch (error) {
        // Log error but continue with other filters (error isolation)
        console.error(
          `[HookRegistry] Filter error in plugin "${handler.pluginId}" for hook "${hookName}":`,
          error
        )
      }
    }

    return result
  }

  /**
   * Execute actions.
   * Runs all registered action callbacks in priority order.
   * If an action throws, the error is logged and the next action is called.
   */
  async doAction<T>(hookName: string, data: T, context?: Record<string, unknown>): Promise<void> {
    const handlers = this.actions.get(hookName)
    if (!handlers || handlers.length === 0) {
      return
    }

    for (const handler of handlers) {
      try {
        const callback = handler.callback as ActionCallback<T>
        await callback(data, context)
      } catch (error) {
        // Log error but continue with other actions (error isolation)
        console.error(
          `[HookRegistry] Action error in plugin "${handler.pluginId}" for hook "${hookName}":`,
          error
        )
      }
    }
  }

  /**
   * Check if a hook has any registered handlers.
   */
  hasFilter(hookName: string): boolean {
    const handlers = this.filters.get(hookName)
    return handlers !== undefined && handlers.length > 0
  }

  /**
   * Check if an action hook has any registered handlers.
   */
  hasAction(hookName: string): boolean {
    const handlers = this.actions.get(hookName)
    return handlers !== undefined && handlers.length > 0
  }

  /**
   * Get count of handlers for a filter hook.
   */
  getFilterCount(hookName: string): number {
    return this.filters.get(hookName)?.length ?? 0
  }

  /**
   * Get count of handlers for an action hook.
   */
  getActionCount(hookName: string): number {
    return this.actions.get(hookName)?.length ?? 0
  }

  /**
   * Get all registered hook names.
   */
  getRegisteredHooks(): { filters: string[]; actions: string[] } {
    return {
      filters: Array.from(this.filters.keys()),
      actions: Array.from(this.actions.keys()),
    }
  }

  /**
   * Sort handlers by (priority ASC, registrationOrder ASC).
   */
  private sortHandlers(handlers: HookHandler<unknown>[]): void {
    handlers.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return a.registrationOrder - b.registrationOrder
    })
  }

  /**
   * Clear all hooks. Used for testing.
   */
  clear(): void {
    this.filters.clear()
    this.actions.clear()
    this.registrationCounter = 0
  }
}

/**
 * Global hook registry instance.
 */
export const hookRegistry = new HookRegistry()

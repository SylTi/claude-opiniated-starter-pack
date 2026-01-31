/**
 * Namespace Registry
 *
 * Manages plugin authorization namespaces.
 * Each plugin can register a resolver for its namespace (e.g., "notes.").
 *
 * INVARIANTS:
 * - Duplicate namespace registration = boot-fatal error
 * - Namespace must end with a dot
 * - Core abilities (no dot) are not handled by this registry
 */

import type { AuthzResolver } from '@saas/shared'
import { parseNamespace as sharedParseNamespace } from '@saas/shared'
import { NamespaceConflictError } from '#exceptions/authz_errors'

/**
 * Namespace registration info.
 */
export interface NamespaceRegistration {
  /** Plugin ID that owns this namespace */
  pluginId: string
  /** The namespace (including trailing dot) */
  namespace: string
  /** Authorization resolver for this namespace */
  resolver: AuthzResolver
  /** When this namespace was registered */
  registeredAt: Date
}

/**
 * Namespace Registry for plugin authorization.
 */
export class NamespaceRegistry {
  private namespaces: Map<string, NamespaceRegistration> = new Map()

  /**
   * Register a namespace for a plugin.
   * @throws {NamespaceConflictError} If namespace is already registered
   */
  register(pluginId: string, namespace: string, resolver: AuthzResolver): void {
    // Validate namespace format
    if (!namespace.endsWith('.')) {
      throw new Error(`Namespace "${namespace}" must end with a dot`)
    }

    // Check for conflicts
    const existing = this.namespaces.get(namespace)
    if (existing) {
      throw new NamespaceConflictError(namespace, existing.pluginId, pluginId)
    }

    // Register the namespace
    this.namespaces.set(namespace, {
      pluginId,
      namespace,
      resolver,
      registeredAt: new Date(),
    })
  }

  /**
   * Unregister a namespace.
   * Returns true if the namespace was registered.
   */
  unregister(namespace: string): boolean {
    return this.namespaces.delete(namespace)
  }

  /**
   * Unregister all namespaces for a plugin.
   */
  unregisterPlugin(pluginId: string): void {
    for (const [namespace, registration] of this.namespaces) {
      if (registration.pluginId === pluginId) {
        this.namespaces.delete(namespace)
      }
    }
  }

  /**
   * Get the resolver for a namespace.
   */
  getResolver(namespace: string): AuthzResolver | undefined {
    return this.namespaces.get(namespace)?.resolver
  }

  /**
   * Get the registration for a namespace.
   */
  getRegistration(namespace: string): NamespaceRegistration | undefined {
    return this.namespaces.get(namespace)
  }

  /**
   * Check if a namespace is registered.
   */
  has(namespace: string): boolean {
    return this.namespaces.has(namespace)
  }

  /**
   * Get the namespace from an ability string, including the trailing dot.
   * Returns null if the ability has no namespace (core ability).
   *
   * Uses the shared parseNamespace and appends the dot for registry lookup.
   *
   * @example
   * parseNamespace('notes.item.read') // 'notes.'
   * parseNamespace('tenant:read') // null
   */
  parseNamespace(ability: string): string | null {
    const namespace = sharedParseNamespace(ability)
    if (namespace === null) {
      return null
    }
    // Include the dot for registry lookup consistency
    return `${namespace}.`
  }

  /**
   * Get all registered namespaces.
   */
  getAllNamespaces(): string[] {
    return Array.from(this.namespaces.keys())
  }

  /**
   * Get all registrations.
   */
  getAllRegistrations(): NamespaceRegistration[] {
    return Array.from(this.namespaces.values())
  }

  /**
   * Get namespaces registered by a specific plugin.
   */
  getPluginNamespaces(pluginId: string): string[] {
    return this.getAllRegistrations()
      .filter((r) => r.pluginId === pluginId)
      .map((r) => r.namespace)
  }

  /**
   * Clear all registrations. Used for testing.
   */
  clear(): void {
    this.namespaces.clear()
  }
}

/**
 * Global namespace registry instance.
 */
export const namespaceRegistry = new NamespaceRegistry()

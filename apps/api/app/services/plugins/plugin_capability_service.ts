/**
 * Plugin Capability Service
 *
 * Runtime capability checks with fail-closed behavior.
 */

import type { PluginManifest } from '@saas/plugins-core'
import { capabilityEnforcer, pluginRegistry } from '@saas/plugins-core'
import { PluginCapabilityError, PluginNotFoundError } from '#exceptions/plugin_errors'

/**
 * Plugin Capability Service for runtime checks.
 */
export default class PluginCapabilityService {
  /**
   * Check if a plugin has a capability.
   * Returns true/false without throwing.
   */
  hasCapability(pluginId: string, capability: string): boolean {
    const plugin = pluginRegistry.get(pluginId)
    if (!plugin) {
      return false
    }

    return plugin.grantedCapabilities.includes(capability)
  }

  /**
   * Require a plugin to have a capability.
   * @throws {PluginNotFoundError} If plugin is not registered
   * @throws {PluginCapabilityError} If capability is not granted
   */
  requireCapability(pluginId: string, capability: string): void {
    const plugin = pluginRegistry.get(pluginId)
    if (!plugin) {
      throw new PluginNotFoundError(pluginId)
    }

    if (!plugin.grantedCapabilities.includes(capability)) {
      throw new PluginCapabilityError(pluginId, capability)
    }
  }

  /**
   * Check if a plugin has all required capabilities.
   */
  hasAllCapabilities(pluginId: string, capabilities: string[]): boolean {
    const plugin = pluginRegistry.get(pluginId)
    if (!plugin) {
      return false
    }

    return capabilities.every((cap) => plugin.grantedCapabilities.includes(cap))
  }

  /**
   * Check if a plugin has any of the specified capabilities.
   */
  hasAnyCapability(pluginId: string, capabilities: string[]): boolean {
    const plugin = pluginRegistry.get(pluginId)
    if (!plugin) {
      return false
    }

    return capabilities.some((cap) => plugin.grantedCapabilities.includes(cap))
  }

  /**
   * Decide which capabilities to grant based on manifest.
   * Uses the capability enforcer for validation.
   */
  decideGrants(manifest: PluginManifest): {
    granted: string[]
    denied: string[]
    reasons: Record<string, string>
  } {
    return capabilityEnforcer.decideGrants(manifest)
  }

  /**
   * Check if a plugin can access database.
   */
  canAccessDatabase(pluginId: string): boolean {
    return (
      this.hasCapability(pluginId, 'app:db:read') || this.hasCapability(pluginId, 'app:db:write')
    )
  }

  /**
   * Check if a plugin can write to database.
   */
  canWriteDatabase(pluginId: string): boolean {
    return this.hasCapability(pluginId, 'app:db:write')
  }

  /**
   * Check if a plugin can register routes.
   */
  canRegisterRoutes(pluginId: string): boolean {
    return this.hasCapability(pluginId, 'app:routes')
  }

  /**
   * Check if a plugin can register authorization resolver.
   */
  canRegisterAuthz(pluginId: string): boolean {
    return this.hasCapability(pluginId, 'app:authz')
  }

  /**
   * Get all capabilities granted to a plugin.
   */
  getGrantedCapabilities(pluginId: string): string[] {
    const plugin = pluginRegistry.get(pluginId)
    if (!plugin) {
      return []
    }

    return [...plugin.grantedCapabilities]
  }

  /**
   * Get capabilities that a plugin requested but was not granted.
   */
  getDeniedCapabilities(pluginId: string): string[] {
    const plugin = pluginRegistry.get(pluginId)
    if (!plugin) {
      return []
    }

    const requested = plugin.manifest.requestedCapabilities.map((c) => c.capability)
    return requested.filter((cap) => !plugin.grantedCapabilities.includes(cap))
  }
}

/**
 * Global capability service instance.
 */
export const pluginCapabilityService = new PluginCapabilityService()

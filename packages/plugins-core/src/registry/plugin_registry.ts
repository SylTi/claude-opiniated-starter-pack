/**
 * Plugin Registry
 *
 * Central registry for plugin manifests and runtime state.
 * Manages plugin lifecycle and status tracking.
 */

import type { PluginManifest, PluginRuntimeState, PluginStatus } from '../types/manifest.js'
import { validatePluginManifest } from '../types/manifest.js'
import { validateCapabilitiesForTier } from '../types/capabilities.js'
import type { PluginCapability } from '../types/capabilities.js'

/**
 * Plugin registration result.
 */
export interface PluginRegistrationResult {
  success: boolean
  pluginId: string
  errors: string[]
}

/**
 * Plugin Registry for managing plugin state.
 */
export class PluginRegistry {
  private plugins: Map<string, PluginRuntimeState> = new Map()
  private bootOrder: string[] = []

  /**
   * Register a plugin manifest.
   * Validates the manifest and sets initial state.
   */
  register(manifest: PluginManifest): PluginRegistrationResult {
    const errors: string[] = []

    // Validate manifest structure
    const manifestValidation = validatePluginManifest(manifest)
    if (!manifestValidation.valid) {
      errors.push(...manifestValidation.errors)
    }

    // Validate capabilities for tier (pass pluginId to allow plugin-specific capabilities)
    const capabilities = manifest.requestedCapabilities.map((c) => c.capability) as PluginCapability[]
    const capValidation = validateCapabilitiesForTier(manifest.tier, capabilities, manifest.pluginId)
    if (!capValidation.valid) {
      errors.push(
        `Invalid capabilities for Tier ${manifest.tier}: ${capValidation.invalidCapabilities.join(', ')}`
      )
    }

    // Check for duplicate plugin ID
    if (this.plugins.has(manifest.pluginId)) {
      errors.push(`Plugin "${manifest.pluginId}" is already registered`)
    }

    if (errors.length > 0) {
      return {
        success: false,
        pluginId: manifest.pluginId,
        errors,
      }
    }

    // Create runtime state
    const state: PluginRuntimeState = {
      manifest,
      status: 'pending',
      grantedCapabilities: [],
    }

    this.plugins.set(manifest.pluginId, state)
    this.bootOrder.push(manifest.pluginId)

    return {
      success: true,
      pluginId: manifest.pluginId,
      errors: [],
    }
  }

  /**
   * Get a plugin's runtime state.
   */
  get(pluginId: string): PluginRuntimeState | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * Get a plugin's manifest.
   */
  getManifest(pluginId: string): PluginManifest | undefined {
    return this.plugins.get(pluginId)?.manifest
  }

  /**
   * Check if a plugin is registered.
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId)
  }

  /**
   * Update a plugin's status.
   */
  setStatus(pluginId: string, status: PluginStatus, errorMessage?: string): boolean {
    const state = this.plugins.get(pluginId)
    if (!state) return false

    state.status = status
    if (errorMessage) {
      state.errorMessage = errorMessage
    }
    if (status === 'active') {
      state.bootedAt = new Date()
    }

    return true
  }

  /**
   * Grant capabilities to a plugin.
   */
  grantCapabilities(pluginId: string, capabilities: string[]): boolean {
    const state = this.plugins.get(pluginId)
    if (!state) return false

    state.grantedCapabilities = capabilities
    return true
  }

  /**
   * Set Tier C deployment-granted runtime core capabilities.
   */
  setDeploymentGrantedCoreCapabilities(pluginId: string, capabilities: string[]): boolean {
    const state = this.plugins.get(pluginId)
    if (!state) return false

    state.deploymentGrantedCoreCapabilities = capabilities
    return true
  }

  /**
   * Check if a plugin has a specific capability.
   */
  hasCapability(pluginId: string, capability: string): boolean {
    const state = this.plugins.get(pluginId)
    if (!state) return false

    return state.grantedCapabilities.includes(capability)
  }

  /**
   * Quarantine a plugin (disable due to error).
   */
  quarantine(pluginId: string, errorMessage: string): boolean {
    return this.setStatus(pluginId, 'quarantined', errorMessage)
  }

  /**
   * Get all registered plugins.
   */
  getAll(): PluginRuntimeState[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get plugins by status.
   */
  getByStatus(status: PluginStatus): PluginRuntimeState[] {
    return this.getAll().filter((p) => p.status === status)
  }

  /**
   * Get plugins by tier.
   */
  getByTier(tier: 'A' | 'B' | 'C' | 'main-app'): PluginRuntimeState[] {
    return this.getAll().filter((p) => p.manifest.tier === tier)
  }

  /**
   * Get active plugins.
   */
  getActive(): PluginRuntimeState[] {
    return this.getByStatus('active')
  }

  /**
   * Get quarantined plugins.
   */
  getQuarantined(): PluginRuntimeState[] {
    return this.getByStatus('quarantined')
  }

  /**
   * Get the boot order (order of registration).
   */
  getBootOrder(): string[] {
    return [...this.bootOrder]
  }

  /**
   * Remove a plugin from the registry.
   */
  unregister(pluginId: string): boolean {
    const existed = this.plugins.delete(pluginId)
    if (existed) {
      this.bootOrder = this.bootOrder.filter((id) => id !== pluginId)
    }
    return existed
  }

  /**
   * Clear all plugins. Used for testing.
   */
  clear(): void {
    this.plugins.clear()
    this.bootOrder = []
  }

  /**
   * Get registry stats.
   */
  getStats(): {
    total: number
    active: number
    quarantined: number
    pending: number
    tierA: number
    tierB: number
    tierC: number
    mainApp: number
  } {
    const all = this.getAll()
    return {
      total: all.length,
      active: all.filter((p) => p.status === 'active').length,
      quarantined: all.filter((p) => p.status === 'quarantined').length,
      pending: all.filter((p) => p.status === 'pending').length,
      tierA: all.filter((p) => p.manifest.tier === 'A').length,
      tierB: all.filter((p) => p.manifest.tier === 'B').length,
      tierC: all.filter((p) => p.manifest.tier === 'C').length,
      mainApp: all.filter((p) => p.manifest.tier === 'main-app').length,
    }
  }
}

/**
 * Global plugin registry instance.
 */
export const pluginRegistry = new PluginRegistry()

/**
 * Capability Enforcer
 *
 * Enforces capability requirements at runtime.
 * Implements FAIL-CLOSED behavior: if capability not granted, action is denied.
 */

import type { PluginCapability } from '../types/capabilities.js'
import { isValidCapability, validateCapabilitiesForTier } from '../types/capabilities.js'
import type { PluginManifest, PluginTier } from '../types/manifest.js'

/**
 * Capability check result.
 */
export interface CapabilityCheckResult {
  allowed: boolean
  reason?: string
  missingCapabilities?: string[]
}

/**
 * Capability grant decision.
 */
export interface CapabilityGrantDecision {
  granted: string[]
  denied: string[]
  reasons: Record<string, string>
}

/**
 * Capability Enforcer for runtime capability checks.
 */
export class CapabilityEnforcer {
  /**
   * Check if a plugin has a required capability.
   * FAIL-CLOSED: Returns false if capability is not granted.
   */
  check(
    pluginId: string,
    requestedCapability: string,
    grantedCapabilities: string[]
  ): CapabilityCheckResult {
    // Validate capability string
    if (!isValidCapability(requestedCapability)) {
      return {
        allowed: false,
        reason: `Unknown capability: ${requestedCapability}`,
      }
    }

    // Check if capability is granted
    if (grantedCapabilities.includes(requestedCapability)) {
      return { allowed: true }
    }

    // FAIL-CLOSED: Capability not granted
    return {
      allowed: false,
      reason: `Plugin "${pluginId}" does not have capability "${requestedCapability}"`,
      missingCapabilities: [requestedCapability],
    }
  }

  /**
   * Check if a plugin has all required capabilities.
   */
  checkAll(
    pluginId: string,
    requiredCapabilities: string[],
    grantedCapabilities: string[]
  ): CapabilityCheckResult {
    const missing: string[] = []

    for (const cap of requiredCapabilities) {
      if (!grantedCapabilities.includes(cap)) {
        missing.push(cap)
      }
    }

    if (missing.length === 0) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: `Plugin "${pluginId}" is missing capabilities: ${missing.join(', ')}`,
      missingCapabilities: missing,
    }
  }

  /**
   * Decide which capabilities to grant based on manifest and tier.
   * FAIL-CLOSED: Invalid capabilities are denied.
   */
  decideGrants(manifest: PluginManifest): CapabilityGrantDecision {
    const granted: string[] = []
    const denied: string[] = []
    const reasons: Record<string, string> = {}

    for (const req of manifest.requestedCapabilities) {
      const capability = req.capability

      // Check if capability is valid (either in PLUGIN_CAPABILITIES or plugin-specific)
      const isKnownCapability = isValidCapability(capability)
      const isPluginSpecific =
        (manifest.tier === 'B' || manifest.tier === 'main-app') &&
        capability.startsWith(`${manifest.pluginId}.`)

      if (!isKnownCapability && !isPluginSpecific) {
        denied.push(capability)
        reasons[capability] = 'Unknown capability'
        continue
      }

      // For known capabilities, check if valid for tier
      if (isKnownCapability) {
        const tierValidation = validateCapabilitiesForTier(manifest.tier, [capability as PluginCapability])
        if (!tierValidation.valid) {
          denied.push(capability)
          reasons[capability] = `Not allowed for Tier ${manifest.tier} plugins`
          continue
        }
      }

      // Capability is valid and appropriate for tier
      granted.push(capability)
    }

    return { granted, denied, reasons }
  }

  /**
   * Validate that a plugin's manifest capabilities are valid for its tier.
   * Used during boot to determine if a plugin should be quarantined.
   */
  validateManifestCapabilities(manifest: PluginManifest): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    for (const req of manifest.requestedCapabilities) {
      if (!isValidCapability(req.capability)) {
        errors.push(`Unknown capability: ${req.capability}`)
        continue
      }

      const tierValidation = validateCapabilitiesForTier(manifest.tier, [req.capability as PluginCapability])
      if (!tierValidation.valid) {
        errors.push(
          `Capability "${req.capability}" is not allowed for Tier ${manifest.tier} plugins`
        )
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Check if a capability requires database access.
   */
  requiresDbAccess(capability: string): boolean {
    return capability === 'app:db:read' || capability === 'app:db:write'
  }

  /**
   * Check if a capability requires route registration.
   */
  requiresRoutes(capability: string): boolean {
    return capability === 'app:routes'
  }

  /**
   * Check if a capability requires authorization namespace.
   */
  requiresAuthz(capability: string): boolean {
    return capability === 'app:authz'
  }

  /**
   * Get capabilities required for a specific tier.
   */
  getRequiredCapabilitiesForFeature(
    tier: PluginTier,
    features: { routes?: boolean; db?: boolean; authz?: boolean }
  ): string[] {
    const caps: string[] = []

    if (tier === 'B') {
      if (features.routes) caps.push('app:routes')
      if (features.db) caps.push('app:db:read', 'app:db:write')
      if (features.authz) caps.push('app:authz')
    }

    return caps
  }
}

/**
 * Global capability enforcer instance.
 */
export const capabilityEnforcer = new CapabilityEnforcer()

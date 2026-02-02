/**
 * Plugin Capability Definitions
 *
 * Capabilities are permissions that plugins request access to.
 * All capabilities must be declared in plugin.meta.json and are
 * enforced at boot time and runtime with fail-closed behavior.
 */

/**
 * All available plugin capabilities.
 *
 * Tier A (UI plugins):
 * - ui:filter:* - Register filters/hooks for UI components
 *
 * Tier B (App plugins):
 * - app:routes - Register API routes under /api/v1/apps/{pluginId}
 * - app:db:read - Read from plugin-prefixed tables
 * - app:db:write - Write to plugin-prefixed tables
 * - app:jobs - Register background jobs
 * - app:authz - Register authorization resolver for plugin namespace
 *
 * Main-app tier (Design ownership):
 * - ui:design:global - Own global theme tokens and shell components
 * - ui:nav:baseline - Provide baseline navigation model
 */
export const PLUGIN_CAPABILITIES = {
  // Tier A - UI capabilities
  'ui:filter:nav': 'ui:filter:nav',
  'ui:filter:dashboard': 'ui:filter:dashboard',
  'ui:slot:header': 'ui:slot:header',
  'ui:slot:sidebar': 'ui:slot:sidebar',
  'ui:slot:footer': 'ui:slot:footer',

  // Tier B - App capabilities
  'app:routes': 'app:routes',
  'app:db:read': 'app:db:read',
  'app:db:write': 'app:db:write',
  'app:jobs': 'app:jobs',
  'app:authz': 'app:authz',

  // Main-app tier - Design capabilities
  'ui:design:global': 'ui:design:global',
  'ui:nav:baseline': 'ui:nav:baseline',
} as const

export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[keyof typeof PLUGIN_CAPABILITIES]

/**
 * Capability requirement declared in plugin.meta.json.
 */
export interface CapabilityRequirement {
  /** The capability being requested */
  capability: PluginCapability
  /** Human-readable reason for why this capability is needed */
  reason: string
}

/**
 * Tier A capabilities (UI only, no server access).
 */
export const TIER_A_CAPABILITIES: PluginCapability[] = [
  PLUGIN_CAPABILITIES['ui:filter:nav'],
  PLUGIN_CAPABILITIES['ui:filter:dashboard'],
  PLUGIN_CAPABILITIES['ui:slot:header'],
  PLUGIN_CAPABILITIES['ui:slot:sidebar'],
  PLUGIN_CAPABILITIES['ui:slot:footer'],
]

/**
 * Tier B capabilities (requires server access).
 */
export const TIER_B_CAPABILITIES: PluginCapability[] = [
  PLUGIN_CAPABILITIES['app:routes'],
  PLUGIN_CAPABILITIES['app:db:read'],
  PLUGIN_CAPABILITIES['app:db:write'],
  PLUGIN_CAPABILITIES['app:jobs'],
  PLUGIN_CAPABILITIES['app:authz'],
]

/**
 * Main-app tier capabilities (design ownership).
 */
export const MAIN_APP_CAPABILITIES: PluginCapability[] = [
  PLUGIN_CAPABILITIES['ui:design:global'],
  PLUGIN_CAPABILITIES['ui:nav:baseline'],
]

/**
 * Validate that capabilities are appropriate for the plugin tier.
 */
export function validateCapabilitiesForTier(
  tier: 'A' | 'B' | 'main-app',
  capabilities: PluginCapability[]
): { valid: boolean; invalidCapabilities: PluginCapability[] } {
  let allowedCapabilities: PluginCapability[]

  switch (tier) {
    case 'A':
      allowedCapabilities = TIER_A_CAPABILITIES
      break
    case 'B':
      allowedCapabilities = [...TIER_A_CAPABILITIES, ...TIER_B_CAPABILITIES]
      break
    case 'main-app':
      // Main-app can use Tier A UI capabilities plus design capabilities
      allowedCapabilities = [...TIER_A_CAPABILITIES, ...MAIN_APP_CAPABILITIES]
      break
  }

  const invalidCapabilities = capabilities.filter((cap) => !allowedCapabilities.includes(cap))

  return {
    valid: invalidCapabilities.length === 0,
    invalidCapabilities,
  }
}

/**
 * Check if a capability string is valid.
 */
export function isValidCapability(capability: string): capability is PluginCapability {
  return Object.values(PLUGIN_CAPABILITIES).includes(capability as PluginCapability)
}

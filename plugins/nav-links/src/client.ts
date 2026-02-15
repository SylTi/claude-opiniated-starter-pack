/**
 * Nav Links Plugin - Client Entrypoint
 *
 * A Tier A plugin that adds custom navigation links.
 * No server routes, no database - just UI filters.
 */

import type { NavItem, NavItemsContext, NavLinksConfig } from './types.js'
import { navLinksText, translations } from './translations.js'

/**
 * Default configuration.
 */
const defaultConfig: NavLinksConfig = {
  links: [
    {
      id: 'custom-docs',
      label: navLinksText('defaults.documentation'),
      href: '/docs',
      icon: 'book',
      order: 100,
    },
  ],
  position: 'end',
}

/**
 * Current configuration (loaded from plugin state).
 */
let currentConfig: NavLinksConfig = defaultConfig

/**
 * Set plugin configuration.
 * Called when the plugin is initialized or config is updated.
 */
export function setConfig(config: Partial<NavLinksConfig>): void {
  currentConfig = {
    ...defaultConfig,
    ...config,
    links: config.links ?? defaultConfig.links,
  }
}

/**
 * Nav items filter handler.
 *
 * This filter receives the current navigation items and returns
 * modified items with custom links added.
 *
 * @param items - Current navigation items
 * @param context - Context including user/tenant info
 * @returns Modified navigation items
 */
export function navItemsFilter(items: NavItem[], context?: NavItemsContext): NavItem[] {
  const customLinks = currentConfig.links

  // Skip if no custom links
  if (!customLinks || customLinks.length === 0) {
    return items
  }

  // Clone items to avoid mutation
  const result = [...items]

  // Determine insertion position
  const position = currentConfig.position ?? 'end'

  if (position === 'start') {
    // Insert at beginning
    result.unshift(...customLinks)
  } else if (position === 'end') {
    // Insert at end
    result.push(...customLinks)
  } else if (position.startsWith('before:')) {
    // Insert before specific item
    const targetId = position.replace('before:', '')
    const index = result.findIndex((item) => item.id === targetId)
    if (index >= 0) {
      result.splice(index, 0, ...customLinks)
    } else {
      result.push(...customLinks)
    }
  } else if (position.startsWith('after:')) {
    // Insert after specific item
    const targetId = position.replace('after:', '')
    const index = result.findIndex((item) => item.id === targetId)
    if (index >= 0) {
      result.splice(index + 1, 0, ...customLinks)
    } else {
      result.push(...customLinks)
    }
  }

  // Sort by order if specified
  result.sort((a, b) => {
    const orderA = a.order ?? 50
    const orderB = b.order ?? 50
    return orderA - orderB
  })

  return result
}

/**
 * Plugin registration function.
 * Called when the plugin is loaded on the client.
 */
export function register(context: {
  config?: NavLinksConfig
}): void {
  if (context.config) {
    setConfig(context.config)
  }
  console.log('[nav-links] Plugin registered')
}

export { translations }
// Export types
export type { NavItem, NavItemsContext, NavLinksConfig }

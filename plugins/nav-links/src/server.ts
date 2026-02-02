/**
 * Nav Links Plugin - Server Entrypoint
 *
 * Server-side hook handler for nav composition.
 * Works with NavSection[] as per the V2 hook system.
 */

import type { NavSection, NavItem as CoreNavItem } from '@saas/plugins-core'
import type { NavLinksConfig } from './types.js'

/**
 * Default configuration.
 */
const defaultConfig: NavLinksConfig = {
  links: [
    {
      id: 'custom-docs',
      label: 'Documentation',
      href: '/docs',
      icon: 'book',
      order: 100,
    },
  ],
  position: 'end',
}

/**
 * Current configuration.
 */
let currentConfig: NavLinksConfig = defaultConfig

/**
 * Set plugin configuration.
 */
export function setConfig(config: Partial<NavLinksConfig>): void {
  currentConfig = {
    ...defaultConfig,
    ...config,
    links: config.links ?? defaultConfig.links,
  }
}

/**
 * Convert plugin NavItem to core NavItem.
 */
function toNavItem(link: NavLinksConfig['links'][0]): CoreNavItem {
  return {
    id: link.id,
    label: link.label,
    href: link.href,
    icon: link.icon,
    order: link.order,
  }
}

/**
 * Nav items filter handler (V2 - works with NavSection[]).
 *
 * This filter receives sections and adds custom links to the main section.
 * For legacy compatibility, it targets the 'core.main' section.
 *
 * @param sections - Current navigation sections
 * @param context - Context including user/tenant info
 * @returns Modified navigation sections
 */
export function navItemsFilter(
  sections: NavSection[],
  _context?: Record<string, unknown>
): NavSection[] {
  const customLinks = currentConfig.links

  // Skip if no custom links
  if (!customLinks || customLinks.length === 0) {
    return sections
  }

  // Clone sections to avoid mutation
  const result = sections.map((section) => ({
    ...section,
    items: [...section.items],
  }))

  // Find or create the main section
  let mainSection = result.find((s) => s.id === 'core.main')
  if (!mainSection) {
    mainSection = {
      id: 'core.main',
      label: 'Main',
      order: 100,
      items: [],
    }
    result.push(mainSection)
  }

  // Add custom links to the main section
  const navItems = customLinks.map(toNavItem)
  const position = currentConfig.position ?? 'end'

  if (position === 'start') {
    mainSection.items.unshift(...navItems)
  } else if (position === 'end') {
    mainSection.items.push(...navItems)
  } else if (position.startsWith('before:')) {
    const targetId = position.replace('before:', '')
    const index = mainSection.items.findIndex((item) => item.id === targetId)
    if (index >= 0) {
      mainSection.items.splice(index, 0, ...navItems)
    } else {
      mainSection.items.push(...navItems)
    }
  } else if (position.startsWith('after:')) {
    const targetId = position.replace('after:', '')
    const index = mainSection.items.findIndex((item) => item.id === targetId)
    if (index >= 0) {
      mainSection.items.splice(index + 1, 0, ...navItems)
    } else {
      mainSection.items.push(...navItems)
    }
  }

  return result
}

/**
 * Plugin registration function.
 */
export function register(context: { config?: NavLinksConfig }): void {
  if (context.config) {
    setConfig(context.config)
  }
  console.log('[nav-links] Server-side plugin registered')
}

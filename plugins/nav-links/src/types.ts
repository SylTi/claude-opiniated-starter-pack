/**
 * Nav Links Plugin Types
 *
 * Type definitions for the nav-links plugin.
 */

/**
 * Navigation item structure.
 */
export interface NavItem {
  id: string
  label: string
  href: string
  icon?: string
  external?: boolean
  order?: number
}

/**
 * Configuration for custom navigation links.
 */
export interface NavLinksConfig {
  /** Custom links to add to navigation */
  links: NavItem[]
  /** Position to insert links: 'start' | 'end' | 'before:id' | 'after:id' */
  position?: 'start' | 'end' | string
}

/**
 * Plugin context for nav items filter.
 */
export interface NavItemsContext {
  /** Current user ID */
  userId?: number
  /** Current tenant ID */
  tenantId?: number
  /** Current route */
  currentRoute?: string
}

/**
 * Navigation Types for Frontend
 *
 * Re-exports types from plugins-core and adds React-specific types.
 */

import type { LucideIcon } from 'lucide-react'

// Re-export all navigation types from plugins-core
export type {
  NavItem,
  NavSection,
  NavModel,
  NavContext,
  NavFilterContext,
  NavArea,
  NavBaselineProvider,
} from '@saas/plugins-core'

export {
  RESERVED_SECTION_IDS,
  MANDATORY_ITEMS,
  DEFAULT_NAV_ORDER,
} from '@saas/plugins-core'

/**
 * React-specific NavItem with icon component.
 */
export interface NavItemWithIcon {
  id: string
  label: string
  href: string
  icon?: LucideIcon
  order?: number
  requiredPermission?: string
  external?: boolean
  badge?: string
  active?: boolean
  onClick?: () => void | Promise<void>
}

/**
 * React-specific NavSection with icon components.
 */
export interface NavSectionWithIcons {
  id: string
  /** Section display label (required per spec) */
  label?: string
  /** @deprecated Use label instead. Kept for backwards compatibility. */
  title?: string
  order?: number
  requiredPermission?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  items: NavItemWithIcon[]
}

/**
 * React-specific NavModel with icon components.
 */
export interface NavModelWithIcons {
  main: NavSectionWithIcons[]
  admin: NavSectionWithIcons[]
  userMenu: NavSectionWithIcons[]
}

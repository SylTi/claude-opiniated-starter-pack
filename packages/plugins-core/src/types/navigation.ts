/**
 * Navigation Types
 *
 * Types for the dynamic navigation system.
 * Navigation is built from sections containing items.
 */

/**
 * Reserved section IDs - these are protected and cannot be replaced.
 * Plugins can only append items to these sections.
 */
export const RESERVED_SECTION_IDS = {
  /** Core account section in user menu */
  'core.account': 'core.account',
  /** Core settings section */
  'core.settings': 'core.settings',
  /** Admin-only sections */
  'core.admin': 'core.admin',
  /** Billing section */
  'core.billing': 'core.billing',
} as const

export type ReservedSectionId = (typeof RESERVED_SECTION_IDS)[keyof typeof RESERVED_SECTION_IDS]

/**
 * Mandatory items that must always be present in the nav model.
 * These are added automatically if missing.
 */
export const MANDATORY_ITEMS = {
  /** Logout item - always present in user menu */
  'core.logout': 'core.logout',
  /** Switch tenant item - shown when user has multiple tenants */
  'core.switchTenant': 'core.switchTenant',
} as const

/**
 * Optional mandatory items that are restored conditionally based on context.
 * - core.profile: restored for authenticated users
 * - core.adminDashboard: restored if user has admin capability
 */
export const OPTIONAL_MANDATORY_ITEMS = {
  /** Profile item - shown for authenticated users */
  'core.profile': 'core.profile',
  /** Admin dashboard item - shown if user has admin capability */
  'core.adminDashboard': 'core.adminDashboard',
} as const

export type OptionalMandatoryItemId =
  (typeof OPTIONAL_MANDATORY_ITEMS)[keyof typeof OPTIONAL_MANDATORY_ITEMS]

export type MandatoryItemId = (typeof MANDATORY_ITEMS)[keyof typeof MANDATORY_ITEMS]

/**
 * Permission requirements for navigation visibility.
 */
export interface NavItemRequires {
  /**
   * Entitlements capability required (fast check).
   * Use this for most nav gating.
   */
  capability?: string

  /**
   * Authorization ability required (expensive check).
   * Use sparingly; prefer capability checks in nav.
   */
  ability?: string
}

/**
 * Navigation item - a single navigable element.
 */
export interface NavItem {
  /** Unique item ID (prefixed with plugin ID for non-core items) */
  id: string

  /** Display label */
  label: string

  /** Navigation target URL or path */
  href: string

  /**
   * Icon identifier (e.g., 'LayoutDashboard', 'Users')
   * Frontend will resolve to actual component
   */
  icon?: string

  /**
   * Sort order (default: 1000).
   * Lower numbers appear first.
   */
  order?: number

  /**
   * Permission requirements to see this item.
   * If undefined, item is always visible.
   */
  requires?: NavItemRequires

  /**
   * @deprecated Use requires.capability instead
   */
  requiredPermission?: string

  /**
   * Whether this item opens in a new tab.
   */
  external?: boolean

  /**
   * Badge text (e.g., "New", "3")
   */
  badge?: string

  /**
   * Whether this item is currently active.
   * Typically computed at render time based on current path.
   */
  active?: boolean

  /**
   * Callback when item is clicked (for non-href items like logout).
   * If defined, href should be '#' or omitted.
   */
  onClick?: string
}

/**
 * Navigation section - groups related items together.
 */
export interface NavSection {
  /** Unique section ID (prefixed with plugin ID for non-core sections) */
  id: string

  /** Section display label (required per spec) */
  label: string

  /**
   * @deprecated Use label instead. Kept for backwards compatibility.
   */
  title?: string

  /**
   * Sort order (default: 1000).
   * Lower numbers appear first.
   */
  order?: number

  /**
   * Permission requirements to see this section.
   * If undefined, section visibility is determined by its items.
   */
  requires?: NavItemRequires

  /**
   * @deprecated Use requires.capability instead
   */
  requiredPermission?: string

  /**
   * Whether this section is collapsible.
   */
  collapsible?: boolean

  /**
   * Whether this section starts collapsed.
   */
  defaultCollapsed?: boolean

  /**
   * Items in this section.
   */
  items: NavItem[]
}

/**
 * Navigation area types.
 */
export type NavArea = 'main' | 'admin' | 'userMenu'

/**
 * Complete navigation model for the application.
 */
export interface NavModel {
  /** Main navigation (header/topbar) */
  main: NavSection[]

  /** Admin sidebar navigation */
  admin: NavSection[]

  /** User menu dropdown items */
  userMenu: NavSection[]
}

/**
 * Ability checker function type.
 * Used for expensive per-item authorization checks.
 * Returns true if the user has the specified ability.
 */
export type AbilityChecker = (ability: string) => boolean | Promise<boolean>

/**
 * Context passed to navigation filters.
 *
 * Per spec: tenantId is nullable because UI includes auth pages, tenant picker,
 * and onboarding. Server endpoints still treat tenant as mandatory.
 */
export interface NavContext {
  // ---- Identity / routing state ----

  /** Current tenant ID (null for guest/no-tenant-selected states) */
  tenantId: string | null

  /** Current user ID */
  userId?: string

  // ---- Fast checks: drive nav visibility (UX). Security enforced server-side. ----

  /** User's entitlements/permissions (fast capability check) */
  entitlements: ReadonlySet<string>

  // ---- Coarse role flags for skeleton-owned decisions ----

  /** Current user role */
  userRole: 'user' | 'admin' | 'guest' | null

  /** Whether current user is a tenant admin */
  isTenantAdmin?: boolean

  // ---- Multi-tenant UX ----

  /** Whether user has multiple tenants */
  hasMultipleTenants: boolean

  // ---- Optional precomputed abilities for expensive checks ----

  /**
   * Pre-computed abilities for nav items (expensive authz checks).
   * Populated by server-side pre-computation to avoid per-item calls.
   * Use sparingly; prefer capability-based nav gating.
   */
  abilities?: ReadonlyMap<string, boolean>

  /**
   * Optional ability checker function for runtime ability checks.
   * Use sparingly as per spec - expensive per-item authz checks.
   * @deprecated Prefer pre-computed abilities map for performance.
   */
  checkAbility?: AbilityChecker

  // ---- Optional subscription context (UX only, not for security) ----

  /** Subscription tier level (0 = free, 1+ = paid) */
  tierLevel: number

  /**
   * Tenant plan ID for UX display.
   * Do not enforce security with this; use entitlements instead.
   */
  tenantPlanId?: string
}

/**
 * Context passed to navigation filter hooks.
 * Extends NavContext with the current nav model being filtered.
 */
export interface NavFilterContext extends NavContext {
  /** The navigation area being filtered */
  area: NavArea

  /** The current nav section/items being filtered */
  current: NavSection[] | NavItem[]
}

/**
 * Baseline navigation provider function.
 * Returns the initial navigation model before hooks are applied.
 */
export type NavBaselineProvider = (context: NavContext) => NavModel | Promise<NavModel>

/**
 * Default order for items/sections without explicit order.
 */
export const DEFAULT_NAV_ORDER = 1000

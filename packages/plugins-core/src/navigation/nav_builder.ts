/**
 * Navigation Builder
 *
 * Builds the final navigation model from baseline and hooks.
 */

import type {
  NavItem,
  NavSection,
  NavModel,
  NavContext,
  NavArea,
} from '../types/navigation.js'
import { DEFAULT_NAV_ORDER, MANDATORY_ITEMS, OPTIONAL_MANDATORY_ITEMS } from '../types/navigation.js'
import type { AppDesign } from '../types/design.js'
import { hookRegistry } from '../registry/hook_registry.js'
import { assertNoIdCollisions, isReservedSectionId } from './nav_validator.js'

/**
 * Sort sections by order (ascending), then by id (ascending) for determinism.
 * Spec requires: (order asc, id asc) to ensure consistent ordering.
 */
export function sortSections(sections: NavSection[]): NavSection[] {
  return [...sections].sort((a, b) => {
    const orderA = a.order ?? DEFAULT_NAV_ORDER
    const orderB = b.order ?? DEFAULT_NAV_ORDER
    return (orderA - orderB) || a.id.localeCompare(b.id)
  })
}

/**
 * Sort items by order (ascending), then by id (ascending) for determinism.
 * Spec requires: (order asc, id asc) to ensure consistent ordering.
 */
export function sortItems(items: NavItem[]): NavItem[] {
  return [...items].sort((a, b) => {
    const orderA = a.order ?? DEFAULT_NAV_ORDER
    const orderB = b.order ?? DEFAULT_NAV_ORDER
    return (orderA - orderB) || a.id.localeCompare(b.id)
  })
}

/**
 * Sort all items within sections.
 */
export function sortSectionItems(sections: NavSection[]): NavSection[] {
  return sections.map((section) => ({
    ...section,
    items: sortItems(section.items),
  }))
}

/**
 * Find or create the core.account section in user menu.
 */
function findOrCreateAccountSection(userMenu: NavSection[]): NavSection {
  let accountSection = userMenu.find((s) => s.id === 'core.account')
  if (!accountSection) {
    accountSection = {
      id: 'core.account',
      label: 'Account',
      order: 9000,
      items: [],
    }
    userMenu.push(accountSection)
  }
  return accountSection
}

/**
 * Check if an item exists in any section.
 */
function hasItemInSections(sections: NavSection[], itemId: string): boolean {
  return sections.some((section) => section.items.some((item) => item.id === itemId))
}

/**
 * Log incident when mandatory items are restored.
 * @param itemId - The item ID that was restored
 * @param quiet - If true, suppress the log (used during validation)
 */
function logMandatoryItemRestored(itemId: string, quiet: boolean = false): void {
  if (!quiet) {
    console.warn(`[nav:incident] Mandatory item "${itemId}" was missing and has been restored.`)
  }
}

/**
 * Options for ensureMandatoryItems.
 */
export interface EnsureMandatoryItemsOptions {
  /** If true, suppress "item restored" logs (used during validation) */
  quiet?: boolean
}

/**
 * Ensure mandatory items are present in user menu.
 * Per spec section 5.2:
 * - core.logout: always present
 * - core.switchTenant: shown when user has multiple tenants
 * - core.profile: restored for authenticated users (optional mandatory)
 * - core.adminDashboard: restored if user has admin capability (optional mandatory)
 */
export function ensureMandatoryItems(
  nav: NavModel,
  context: NavContext,
  options: EnsureMandatoryItemsOptions = {}
): NavModel {
  const { quiet = false } = options
  const userMenu = nav.userMenu.map((section) => ({
    ...section,
    items: [...section.items],
  }))

  // 1. Ensure core.logout exists (always required)
  if (!hasItemInSections(userMenu, MANDATORY_ITEMS['core.logout'])) {
    logMandatoryItemRestored(MANDATORY_ITEMS['core.logout'], quiet)
    const accountSection = findOrCreateAccountSection(userMenu)
    accountSection.items.push({
      id: MANDATORY_ITEMS['core.logout'],
      label: 'Log out',
      href: '#',
      icon: 'LogOut',
      order: 9999,
      onClick: 'logout',
    })
  }

  // 2. Ensure core.switchTenant exists if user has multiple tenants
  if (context.hasMultipleTenants && !hasItemInSections(userMenu, MANDATORY_ITEMS['core.switchTenant'])) {
    logMandatoryItemRestored(MANDATORY_ITEMS['core.switchTenant'], quiet)
    const accountSection = findOrCreateAccountSection(userMenu)
    // Insert before logout
    const logoutIndex = accountSection.items.findIndex(
      (item) => item.id === MANDATORY_ITEMS['core.logout']
    )
    const switchTenantItem: NavItem = {
      id: MANDATORY_ITEMS['core.switchTenant'],
      label: 'Switch Organization',
      href: '#',
      icon: 'Building2',
      order: 8990,
      onClick: 'switchTenant',
    }
    if (logoutIndex >= 0) {
      accountSection.items.splice(logoutIndex, 0, switchTenantItem)
    } else {
      accountSection.items.push(switchTenantItem)
    }
  }

  // 3. Ensure core.profile exists for authenticated users (optional mandatory per spec)
  if (context.userRole && context.userRole !== 'guest') {
    if (!hasItemInSections(userMenu, OPTIONAL_MANDATORY_ITEMS['core.profile'])) {
      logMandatoryItemRestored(OPTIONAL_MANDATORY_ITEMS['core.profile'], quiet)
      const accountSection = findOrCreateAccountSection(userMenu)
      // Insert at the beginning of items
      accountSection.items.unshift({
        id: OPTIONAL_MANDATORY_ITEMS['core.profile'],
        label: 'Profile',
        href: '/profile',
        icon: 'User',
        order: 100,
      })
    }
  }

  // 4. Ensure core.adminDashboard exists if user has admin capability (optional mandatory per spec)
  if (context.userRole === 'admin' || context.entitlements.has('admin')) {
    if (!hasItemInSections(userMenu, OPTIONAL_MANDATORY_ITEMS['core.adminDashboard'])) {
      // Check in admin area too
      const hasInAdmin = hasItemInSections(nav.admin, OPTIONAL_MANDATORY_ITEMS['core.adminDashboard'])
      if (!hasInAdmin) {
        logMandatoryItemRestored(OPTIONAL_MANDATORY_ITEMS['core.adminDashboard'], quiet)
        // Add to user menu for quick access
        const accountSection = findOrCreateAccountSection(userMenu)
        accountSection.items.push({
          id: OPTIONAL_MANDATORY_ITEMS['core.adminDashboard'],
          label: 'Admin Dashboard',
          href: '/admin/dashboard',
          icon: 'Shield',
          order: 8000,
        })
      }
    }
  }

  return {
    ...nav,
    userMenu,
  }
}

/**
 * Check if an item matches capability requirements.
 * Supports both new requires.capability and deprecated requiredPermission.
 */
function itemMatchesCapability(item: NavItem, entitlements: ReadonlySet<string>): boolean {
  // New pattern: requires.capability
  if (item.requires?.capability) {
    return entitlements.has(item.requires.capability)
  }
  // Deprecated pattern: requiredPermission (for backwards compatibility)
  if (item.requiredPermission) {
    return entitlements.has(item.requiredPermission)
  }
  return true
}

/**
 * Check if an item matches ability requirements.
 * Uses pre-computed abilities map for performance (expensive authz checks).
 *
 * SECURITY: Fail-closed - if ability is required but not in the map, hide the item.
 * This prevents unauthorized feature discovery. Routes must still enforce authz.
 */
function itemMatchesAbility(item: NavItem, abilities?: ReadonlyMap<string, boolean>): boolean {
  if (!item.requires?.ability) {
    return true // No ability requirement
  }
  if (!abilities) {
    // No abilities provided - fail closed (hide item) to prevent unauthorized feature discovery
    console.warn(`[nav:permission] Ability check for "${item.requires.ability}" failed - no abilities map provided. Item hidden.`)
    return false
  }
  // If ability not in map, fail closed (hide item)
  return abilities.get(item.requires.ability) ?? false
}

/**
 * Check if a section matches capability requirements.
 * Supports both new requires.capability and deprecated requiredPermission.
 */
function sectionMatchesCapability(section: NavSection, entitlements: ReadonlySet<string>): boolean {
  // New pattern: requires.capability
  if (section.requires?.capability) {
    return entitlements.has(section.requires.capability)
  }
  // Deprecated pattern: requiredPermission (for backwards compatibility)
  if (section.requiredPermission) {
    return entitlements.has(section.requiredPermission)
  }
  return true
}

/**
 * Check if a section matches ability requirements.
 *
 * SECURITY: Fail-closed - if ability is required but not in the map, hide the section.
 */
function sectionMatchesAbility(section: NavSection, abilities?: ReadonlyMap<string, boolean>): boolean {
  if (!section.requires?.ability) {
    return true // No ability requirement
  }
  if (!abilities) {
    // No abilities provided - fail closed (hide section)
    console.warn(`[nav:permission] Section ability check for "${section.requires.ability}" failed - no abilities map provided. Section hidden.`)
    return false
  }
  // If ability not in map, fail closed (hide section)
  return abilities.get(section.requires.ability) ?? false
}

/**
 * Apply permission filtering to navigation model.
 * Checks both capabilities (fast) and abilities (expensive, pre-computed).
 *
 * Per spec section 6:
 * - Use requires.capability for most nav gating (fast)
 * - Use requires.ability sparingly; should be pre-computed
 * - Navigation is UX only; routes must enforce authz server-side
 */
export function applyPermissionFilter(
  nav: NavModel,
  entitlements: ReadonlySet<string>,
  abilities?: ReadonlyMap<string, boolean>
): NavModel {
  const filterSections = (sections: NavSection[]): NavSection[] => {
    return sections
      .filter((section) =>
        sectionMatchesCapability(section, entitlements) &&
        sectionMatchesAbility(section, abilities)
      )
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          itemMatchesCapability(item, entitlements) &&
          itemMatchesAbility(item, abilities)
        ),
      }))
      .filter((section) => section.items.length > 0) // Remove empty sections
  }

  return {
    main: filterSections(nav.main),
    admin: filterSections(nav.admin),
    userMenu: filterSections(nav.userMenu),
  }
}

/**
 * Apply sorting to entire nav model.
 */
export function applySorting(nav: NavModel): NavModel {
  return {
    main: sortSectionItems(sortSections(nav.main)),
    admin: sortSectionItems(sortSections(nav.admin)),
    userMenu: sortSectionItems(sortSections(nav.userMenu)),
  }
}

/**
 * Options for building navigation model.
 */
export interface BuildNavModelOptions {
  /** The design providing baseline navigation */
  design: AppDesign

  /** Navigation context */
  context: NavContext

  /** Whether to skip hooks (for testing) */
  skipHooks?: boolean

  /** Whether to skip permission filtering */
  skipPermissionFilter?: boolean

  /** Whether to skip validation */
  skipValidation?: boolean

  /** Whether to suppress "mandatory item restored" logs (used during validation) */
  quietMode?: boolean
}

/**
 * Log an incident when reserved ID violations are detected.
 */
function logReservedIdViolation(sectionId: string, area: NavArea, action: 'created' | 'removed'): void {
  console.error(
    `[nav:incident] Reserved section "${sectionId}" was ${action} by a plugin hook in area "${area}". ` +
    `Only the main-app plugin can modify reserved sections. ${action === 'created' ? 'Section will be removed.' : 'Section will be restored.'}`
  )
}

/**
 * Log an incident when core item ID violations are detected.
 */
function logCoreItemViolation(itemId: string, sectionId: string, area: NavArea): void {
  console.error(
    `[nav:incident] Core item "${itemId}" was created by a plugin hook in section "${sectionId}" area "${area}". ` +
    `Only the main-app plugin can create core.* items. Item will be removed.`
  )
}

/**
 * Log an incident when mandatory items are removed.
 */
function logMandatoryItemRemovalAttempt(itemId: string, area: NavArea): void {
  console.error(
    `[nav:incident] Mandatory item "${itemId}" was removed by a plugin hook in area "${area}". ` +
    `Mandatory items cannot be removed. Item will be restored.`
  )
}

/**
 * Validate and sanitize sections after hooks are applied.
 * Prevents:
 * - Creation of reserved sections by plugins
 * - Removal of reserved sections (spec §5.1)
 * - Creation of core.* items by plugins
 * - Removal of mandatory items
 */
function validateHookResults(
  originalSections: NavSection[],
  resultSections: NavSection[],
  area: NavArea
): NavSection[] {
  // Collect existing section IDs and item IDs from original
  const originalSectionMap = new Map(originalSections.map(s => [s.id, s]))
  const existingItemIds = new Set<string>()
  for (const section of originalSections) {
    for (const item of section.items) {
      existingItemIds.add(item.id)
    }
  }

  // Collect result section IDs
  const resultSectionIds = new Set(resultSections.map(s => s.id))

  // Check for removed reserved sections - must be restored
  const restoredSections: NavSection[] = []
  for (const originalSection of originalSections) {
    if (isReservedSectionId(originalSection.id) && !resultSectionIds.has(originalSection.id)) {
      logReservedIdViolation(originalSection.id, area, 'removed')
      restoredSections.push(originalSection)
    }
  }

  // Validate result sections
  const validatedSections: NavSection[] = []

  for (const section of resultSections) {
    // Check if this is a new reserved section created by a plugin
    if (isReservedSectionId(section.id) && !originalSectionMap.has(section.id)) {
      logReservedIdViolation(section.id, area, 'created')
      continue // Skip this section entirely
    }

    // Check items for core ID violations
    const validItems = section.items.filter(item => {
      // If this is a new core.* item that didn't exist before
      if (item.id.startsWith('core.') && !existingItemIds.has(item.id)) {
        logCoreItemViolation(item.id, section.id, area)
        return false // Remove this item
      }
      return true
    })

    // Check if reserved section is missing mandatory items
    if (isReservedSectionId(section.id)) {
      const originalSection = originalSectionMap.get(section.id)
      if (originalSection) {
        // Ensure no mandatory items were removed
        const resultItemIds = new Set(validItems.map(i => i.id))
        for (const originalItem of originalSection.items) {
          // Check if this was a core item that got removed
          if (originalItem.id.startsWith('core.') && !resultItemIds.has(originalItem.id)) {
            logMandatoryItemRemovalAttempt(originalItem.id, area)
            validItems.push(originalItem) // Restore the item
          }
        }
      }
    }

    // Only add section if it still has items or was in original
    if (validItems.length > 0 || originalSectionMap.has(section.id)) {
      validatedSections.push({
        ...section,
        items: validItems,
      })
    }
  }

  // Add back any restored reserved sections
  return [...validatedSections, ...restoredSections]
}

/**
 * Apply hooks to a specific nav area.
 * Validates hook results to ensure plugins don't violate reserved ID rules.
 *
 * Applies both V2 hooks (ui:nav:*) and legacy hooks (nav:items) for backward compatibility.
 * Order: V2 hooks first, then legacy hooks, so legacy plugins can modify V2 output.
 */
async function applyHooksToArea(
  sections: NavSection[],
  area: NavArea,
  context: NavContext
): Promise<NavSection[]> {
  // Map area to V2 hook name
  const v2HookMap: Record<NavArea, string> = {
    main: 'ui:nav:main',
    admin: 'ui:nav:admin',
    userMenu: 'ui:user:menu',
  }

  // Map area to legacy hook name (only main and userMenu had legacy equivalents)
  const legacyHookMap: Partial<Record<NavArea, string>> = {
    main: 'nav:items',
    userMenu: 'nav:user-menu',
  }

  const v2HookName = v2HookMap[area]
  const legacyHookName = legacyHookMap[area]

  // Apply V2 filter hook first
  let result = await hookRegistry.applyFilters(v2HookName, sections, {
    area,
    ...context,
  })

  // Apply legacy filter hook for backward compatibility (if exists for this area)
  if (legacyHookName) {
    result = await hookRegistry.applyFilters(legacyHookName, result, {
      area,
      ...context,
    })
  }

  const resultSections = result as NavSection[]

  // Validate hook results - remove any reserved ID violations
  return validateHookResults(sections, resultSections, area)
}

/**
 * Build the complete navigation model.
 *
 * Build order (per spec):
 * baseline → filters → mandatory restore → sort → collision check → permission filter
 *
 * Why this order:
 * - Mandatory restore happens before validation so we never throw on missing skeleton safety items.
 * - Sorting before collision check makes output stable and debugging easier.
 * - Collision check before permission filter catches conflicts even when an item would later be hidden.
 */
export async function buildNavModel(options: BuildNavModelOptions): Promise<NavModel> {
  const { design, context, skipHooks = false, skipPermissionFilter = false, skipValidation = false, quietMode = false } = options

  // 1. Get baseline from design (must be sync per spec)
  let nav = design.navBaseline(context)

  // 2. Apply hooks to each area
  if (!skipHooks) {
    nav = {
      main: await applyHooksToArea(nav.main, 'main', context),
      admin: await applyHooksToArea(nav.admin, 'admin', context),
      userMenu: await applyHooksToArea(nav.userMenu, 'userMenu', context),
    }
  }

  // 3. Ensure mandatory items are present
  nav = ensureMandatoryItems(nav, context, { quiet: quietMode })

  // 4. Apply sorting
  nav = applySorting(nav)

  // 5. Validate - collision check (boot-fatal if collision detected)
  // This runs BEFORE permission filter to catch all conflicts
  if (!skipValidation) {
    assertNoIdCollisions(nav)
  }

  // 6. Apply permission filtering (capabilities + abilities)
  // This is last so collision check sees the full nav
  if (!skipPermissionFilter) {
    nav = applyPermissionFilter(nav, context.entitlements, context.abilities)
  }

  return nav
}

/**
 * Create an empty navigation model.
 */
export function createEmptyNavModel(): NavModel {
  return {
    main: [],
    admin: [],
    userMenu: [],
  }
}

/**
 * Merge two navigation models.
 * Items from the second model are appended to sections from the first.
 *
 * NOTE: This function is immutable - it never modifies the input models.
 * All sections and items are shallow-copied to prevent side effects.
 */
export function mergeNavModels(base: NavModel, additions: NavModel): NavModel {
  const mergeSections = (baseSections: NavSection[], addSections: NavSection[]): NavSection[] => {
    // Deep copy base sections to avoid mutation
    const result: NavSection[] = baseSections.map((s) => ({
      ...s,
      items: [...s.items],
    }))

    for (const addSection of addSections) {
      const existingIndex = result.findIndex((s) => s.id === addSection.id)
      if (existingIndex >= 0) {
        // Create new section object with merged items (immutable)
        result[existingIndex] = {
          ...result[existingIndex],
          items: [...result[existingIndex].items, ...addSection.items],
        }
      } else {
        // Add new section (copy to avoid holding reference)
        result.push({ ...addSection, items: [...addSection.items] })
      }
    }

    return result
  }

  return {
    main: mergeSections(base.main, additions.main),
    admin: mergeSections(base.admin, additions.admin),
    userMenu: mergeSections(base.userMenu, additions.userMenu),
  }
}

/**
 * Navigation Validator
 *
 * Validates navigation sections and items.
 * Ensures no ID collisions and reserved IDs are protected.
 */

import type { NavItem, NavSection, NavModel, ReservedSectionId } from '../types/navigation.js'
import { RESERVED_SECTION_IDS } from '../types/navigation.js'

/**
 * Validation result.
 */
export interface NavValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate a navigation item.
 */
export function validateNavItem(item: NavItem): NavValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!item.id || typeof item.id !== 'string') {
    errors.push('NavItem must have a string id')
  } else if (!item.id.includes('.') && !item.id.startsWith('core.')) {
    warnings.push(`NavItem "${item.id}" should use dot notation (e.g., "pluginId.itemName")`)
  }

  if (!item.label || typeof item.label !== 'string') {
    errors.push(`NavItem "${item.id || '(unknown)'}": label is required`)
  }

  if (!item.href && !item.onClick) {
    errors.push(`NavItem "${item.id || '(unknown)'}": must have either href or onClick`)
  }

  if (item.order !== undefined && typeof item.order !== 'number') {
    errors.push(`NavItem "${item.id || '(unknown)'}": order must be a number`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate a navigation section.
 */
export function validateNavSection(section: NavSection): NavValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!section.id || typeof section.id !== 'string') {
    errors.push('NavSection must have a string id')
  } else if (!section.id.includes('.') && !section.id.startsWith('core.')) {
    warnings.push(`NavSection "${section.id}" should use dot notation (e.g., "pluginId.sectionName")`)
  }

  if (section.order !== undefined && typeof section.order !== 'number') {
    errors.push(`NavSection "${section.id || '(unknown)'}": order must be a number`)
  }

  if (!Array.isArray(section.items)) {
    errors.push(`NavSection "${section.id || '(unknown)'}": items must be an array`)
  } else {
    // Validate all items in the section
    for (const item of section.items) {
      const itemResult = validateNavItem(item)
      errors.push(...itemResult.errors)
      warnings.push(...itemResult.warnings)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Assert no ID collisions in nav model.
 * Throws on duplicate IDs (boot-fatal).
 */
export function assertNoIdCollisions(model: NavModel): void {
  const allIds = new Set<string>()
  const collisions: string[] = []

  const checkId = (id: string, type: string): void => {
    if (allIds.has(id)) {
      collisions.push(`${type} "${id}" is duplicated`)
    }
    allIds.add(id)
  }

  // Check all areas
  const checkSections = (sections: NavSection[], area: string): void => {
    for (const section of sections) {
      checkId(section.id, `Section in ${area}`)
      for (const item of section.items) {
        checkId(item.id, `Item in ${area}`)
      }
    }
  }

  checkSections(model.main, 'main')
  checkSections(model.admin, 'admin')
  checkSections(model.userMenu, 'userMenu')

  if (collisions.length > 0) {
    throw new Error(`Navigation ID collisions detected:\n${collisions.join('\n')}`)
  }
}

/**
 * Check if an ID is a reserved section ID.
 */
export function isReservedSectionId(id: string): id is ReservedSectionId {
  return Object.values(RESERVED_SECTION_IDS).includes(id as ReservedSectionId)
}

/**
 * Validate that plugins don't replace reserved sections.
 * Only appending items to reserved sections is allowed.
 */
export function validateReservedIds(
  sections: NavSection[],
  existingSectionIds: Set<string>,
  pluginId: string
): NavValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const section of sections) {
    // If this is a reserved section ID
    if (isReservedSectionId(section.id)) {
      // Only the core system can create reserved sections
      if (!existingSectionIds.has(section.id) && pluginId !== 'main-app') {
        errors.push(
          `Plugin "${pluginId}" cannot create reserved section "${section.id}". ` +
            `Reserved sections can only be created by the main-app plugin.`
        )
      }
    }

    // Check for items trying to use reserved item IDs
    for (const item of section.items) {
      if (item.id.startsWith('core.') && pluginId !== 'main-app') {
        errors.push(
          `Plugin "${pluginId}" cannot create item with core ID "${item.id}". ` +
            `Core IDs are reserved for the main-app plugin.`
        )
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate an entire navigation model.
 */
export function validateNavModel(model: NavModel): NavValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const validateSections = (sections: NavSection[], area: string): void => {
    if (!Array.isArray(sections)) {
      errors.push(`NavModel.${area} must be an array`)
      return
    }

    for (const section of sections) {
      const result = validateNavSection(section)
      errors.push(...result.errors.map((e) => `[${area}] ${e}`))
      warnings.push(...result.warnings.map((w) => `[${area}] ${w}`))
    }
  }

  validateSections(model.main, 'main')
  validateSections(model.admin, 'admin')
  validateSections(model.userMenu, 'userMenu')

  // Check for ID collisions
  try {
    assertNoIdCollisions(model)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

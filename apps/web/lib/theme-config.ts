/**
 * Theme Configuration
 *
 * Generic theme utilities for the skeleton application.
 * Plugin-specific theming is handled via the design system.
 */

/**
 * Theme mode type.
 */
export type Theme = 'light' | 'dark'

/**
 * Cookie name for storing theme preference.
 */
export const THEME_COOKIE_NAME = 'saas-theme'

/**
 * Default theme when none is set.
 */
export const DEFAULT_THEME: Theme = 'light'

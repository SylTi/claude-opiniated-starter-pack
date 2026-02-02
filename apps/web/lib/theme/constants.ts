/**
 * Theme Token Constants
 *
 * Shared constants for theme token handling.
 * Used by both apply-theme-tokens.ts and get-shell-for-area.tsx.
 */

/**
 * Known theme token names mapped to CSS variable names.
 *
 * This mapping is the single source of truth for converting
 * typed token properties to their CSS variable equivalents.
 */
export const TOKEN_TO_CSS_VAR: Record<string, string> = {
  colorPrimary: '--color-primary',
  colorPrimaryHover: '--color-primary-hover',
  colorSecondary: '--color-secondary',
  colorBackground: '--color-background',
  colorSurface: '--color-surface',
  colorText: '--color-text',
  colorTextMuted: '--color-text-muted',
  colorBorder: '--color-border',
  colorError: '--color-error',
  colorSuccess: '--color-success',
  colorWarning: '--color-warning',
  colorInfo: '--color-info',
  borderRadius: '--border-radius',
  borderRadiusSm: '--border-radius-sm',
  borderRadiusLg: '--border-radius-lg',
  fontFamily: '--font-family',
  fontFamilyHeading: '--font-family-heading',
  fontFamilyMono: '--font-family-mono',
  fontSize: '--font-size',
  fontSizeSm: '--font-size-sm',
  fontSizeLg: '--font-size-lg',
  spacingUnit: '--spacing-unit',
  shadow: '--shadow',
  shadowMd: '--shadow-md',
  shadowLg: '--shadow-lg',
}

/**
 * Convert a token key to its CSS variable name.
 */
export function tokenKeyToCssVar(key: string): string {
  // If key already starts with --, it's a CSS variable
  if (key.startsWith('--')) return key
  // Use the mapping or fall back to camelCase to kebab-case conversion
  return TOKEN_TO_CSS_VAR[key] ?? `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
}

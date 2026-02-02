/**
 * Theme Token Application
 *
 * Applies theme tokens as CSS custom properties.
 */

import type { ThemeTokens } from '@saas/plugins-core'
import { TOKEN_TO_CSS_VAR } from './constants'

/**
 * Apply theme tokens as CSS custom properties on document.documentElement.
 *
 * Per spec §2.1: cssVars is the canonical substrate (required).
 * It's applied first, then typed properties are applied with their mapped CSS variable names.
 */
export function applyThemeTokens(tokens: ThemeTokens): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement

  // 1. Apply cssVars first (canonical substrate per spec §2.1 - required)
  for (const [cssVar, value] of Object.entries(tokens.cssVars)) {
    if (value !== undefined) {
      root.style.setProperty(cssVar, value)
    }
  }

  // 2. Apply typed properties (convenience extensions)
  for (const [key, value] of Object.entries(tokens)) {
    // Skip special fields
    if (key === 'cssVars' || key === 'appName' || key === 'logoUrl') continue
    if (value === undefined) continue

    // Get the CSS variable name
    const cssVar = TOKEN_TO_CSS_VAR[key] ?? `--${key}`

    if (typeof value === 'string') {
      root.style.setProperty(cssVar, value)
    }
  }
}

/**
 * Remove all theme tokens from document.documentElement.
 */
export function clearThemeTokens(): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement

  for (const cssVar of Object.values(TOKEN_TO_CSS_VAR)) {
    root.style.removeProperty(cssVar)
  }
}

/**
 * Get default theme tokens.
 * Includes required cssVars per spec §2.1.
 */
export function getDefaultThemeTokens(): ThemeTokens {
  return {
    // Required cssVars (canonical substrate per spec §2.1)
    cssVars: {
      '--color-primary': '#3b82f6',
      '--color-primary-hover': '#2563eb',
      '--color-secondary': '#64748b',
      '--color-background': '#ffffff',
      '--color-surface': '#f9fafb',
      '--color-text': '#111827',
      '--color-text-muted': '#6b7280',
      '--color-border': '#e5e7eb',
      '--color-error': '#ef4444',
      '--color-success': '#22c55e',
      '--color-warning': '#f59e0b',
      '--color-info': '#3b82f6',
      '--border-radius': '0.5rem',
      '--border-radius-sm': '0.25rem',
      '--border-radius-lg': '0.75rem',
      '--font-family': 'Geist, system-ui, sans-serif',
      '--font-family-heading': 'Geist, system-ui, sans-serif',
      '--font-family-mono': 'Geist Mono, monospace',
      '--font-size': '1rem',
      '--font-size-sm': '0.875rem',
      '--font-size-lg': '1.125rem',
      '--spacing-unit': '0.25rem',
      '--shadow': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    },
    // Typed convenience properties
    colorPrimary: '#3b82f6',
    colorPrimaryHover: '#2563eb',
    colorSecondary: '#64748b',
    colorBackground: '#ffffff',
    colorSurface: '#f9fafb',
    colorText: '#111827',
    colorTextMuted: '#6b7280',
    colorBorder: '#e5e7eb',
    colorError: '#ef4444',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorInfo: '#3b82f6',
    borderRadius: '0.5rem',
    borderRadiusSm: '0.25rem',
    borderRadiusLg: '0.75rem',
    fontFamily: 'Geist, system-ui, sans-serif',
    fontFamilyHeading: 'Geist, system-ui, sans-serif',
    fontFamilyMono: 'Geist Mono, monospace',
    fontSize: '1rem',
    fontSizeSm: '0.875rem',
    fontSizeLg: '1.125rem',
    spacingUnit: '0.25rem',
    shadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  }
}

/**
 * Design Types
 *
 * Types for the design system that allows a main-app plugin
 * to own global theme and layout.
 */

import type { NavContext, NavModel } from './navigation.js'

/**
 * Theme tokens that can be customized.
 * These map to CSS custom properties.
 *
 * Per spec §2.1: cssVars is the canonical substrate (REQUIRED).
 * Typed properties (colorPrimary, borderRadius, etc.) are optional
 * conveniences that MUST map to cssVars when used.
 */
export interface ThemeTokens {
  /**
   * Raw CSS variables (REQUIRED canonical substrate per spec §2.1).
   * Keys should be CSS custom property names like '--brand', '--background'.
   */
  cssVars: Record<string, string>

  /** Application name (e.g., 'MyProduct') */
  appName?: string
  /** Logo URL (e.g., '/logo.svg') */
  logoUrl?: string

  // ---- Typed convenience properties (optional extensions) ----
  // These MUST map to cssVars when used. They provide better DX/type safety.

  /** Primary brand color */
  colorPrimary?: string
  /** Primary color on hover */
  colorPrimaryHover?: string
  /** Secondary/accent color */
  colorSecondary?: string
  /** Background color */
  colorBackground?: string
  /** Surface/card background */
  colorSurface?: string
  /** Text color */
  colorText?: string
  /** Muted text color */
  colorTextMuted?: string
  /** Border color */
  colorBorder?: string
  /** Error/danger color */
  colorError?: string
  /** Success color */
  colorSuccess?: string
  /** Warning color */
  colorWarning?: string
  /** Info color */
  colorInfo?: string

  /** Border radius (e.g., '0.5rem') */
  borderRadius?: string
  /** Border radius small */
  borderRadiusSm?: string
  /** Border radius large */
  borderRadiusLg?: string

  /** Font family for body text */
  fontFamily?: string
  /** Font family for headings */
  fontFamilyHeading?: string
  /** Font family for monospace/code */
  fontFamilyMono?: string

  /** Base font size */
  fontSize?: string
  /** Small font size */
  fontSizeSm?: string
  /** Large font size */
  fontSizeLg?: string

  /** Spacing unit (e.g., '0.25rem') */
  spacingUnit?: string

  /** Shadow for elevated elements */
  shadow?: string
  /** Shadow medium */
  shadowMd?: string
  /** Shadow large */
  shadowLg?: string

  // Note: For additional custom tokens, use cssVars.
  // The index signature was removed because it conflicts with cssVars type.
}

/**
 * Shell area types.
 */
export type ShellArea = 'app' | 'admin' | 'auth' | 'landing'

/**
 * Props passed to shell components.
 */
export interface ShellProps {
  /** Navigation model */
  nav: NavModel

  /** Navigation context */
  navContext: NavContext

  /** Current area */
  area: ShellArea

  /** Child content to render */
  children: unknown // React.ReactNode on frontend

  /** Current pathname for active state */
  pathname?: string
}

/**
 * Shell component type (will be React component on frontend).
 */
export type ShellComponent = (props: ShellProps) => unknown

/**
 * Shell override configuration.
 */
export interface ShellOverride {
  /** The area this shell is for */
  area: ShellArea

  /** The shell component */
  Shell: ShellComponent

  /**
   * Whether this shell should wrap the default or replace it.
   * Default is 'replace'.
   */
  mode?: 'replace' | 'wrap'
}

/**
 * Partial theme tokens for area overrides.
 * Unlike ThemeTokens, cssVars is optional here since area overrides
 * only need to specify what they want to change.
 */
export interface PartialThemeTokens extends Omit<ThemeTokens, 'cssVars'> {
  /** Optional CSS variables to override */
  cssVars?: Record<string, string>
}

/**
 * Theme and shell override for an area.
 */
export interface AreaOverride {
  /** Optional theme tokens for this area (partial override) */
  tokens?: PartialThemeTokens

  /** Optional shell override for this area */
  shell?: {
    Shell: ShellComponent
  }
}

/**
 * App Design interface.
 * Implemented by the main-app plugin to provide global design.
 */
export interface AppDesign {
  /** Unique design ID (matches plugin ID) */
  designId: string

  /** Display name for the design */
  displayName: string

  /**
   * Get theme tokens for the product area.
   * Must be pure (no I/O, no fetch).
   * These are applied as CSS custom properties.
   */
  appTokens(): ThemeTokens

  /**
   * Main app shell component (REQUIRED per spec §2.1).
   * Used for the product area (always used).
   * May be a Client Component.
   */
  AppShell: ShellComponent

  /**
   * Get baseline navigation model.
   * Must be pure (no I/O, no fetch, no async).
   * This is the starting point before hooks are applied.
   */
  navBaseline(context: NavContext): NavModel

  /**
   * Optional override for skeleton admin area.
   * If missing or crashing, skeleton uses its default admin theme/shell.
   */
  adminOverride?: AreaOverride

  /**
   * Optional override for skeleton auth pages (login/register).
   * Same fallback semantics.
   */
  authOverride?: AreaOverride

  /**
   * Shell overrides for different areas (alternative to specific overrides).
   * If not provided, default shells are used.
   * @deprecated Use AppShell, adminOverride, authOverride instead.
   */
  shells?: ShellOverride[]

  /**
   * Called when design is registered.
   * Use for any initialization.
   */
  onRegister?(): void | Promise<void>
}

/**
 * Type guard for AppDesign.
 * Validates all required fields per spec §2.1.
 */
export function isAppDesign(obj: unknown): obj is AppDesign {
  if (!obj || typeof obj !== 'object') return false
  const design = obj as Record<string, unknown>
  return (
    typeof design.designId === 'string' &&
    typeof design.displayName === 'string' &&
    typeof design.appTokens === 'function' &&
    typeof design.navBaseline === 'function' &&
    typeof design.AppShell === 'function'
  )
}

/**
 * Validate that ThemeTokens has required cssVars.
 */
export function validateThemeTokens(tokens: ThemeTokens): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!tokens.cssVars || typeof tokens.cssVars !== 'object') {
    errors.push('ThemeTokens.cssVars is required (per spec §2.1)')
  } else if (Object.keys(tokens.cssVars).length === 0) {
    errors.push('ThemeTokens.cssVars must contain at least one CSS variable')
  }

  return { valid: errors.length === 0, errors }
}

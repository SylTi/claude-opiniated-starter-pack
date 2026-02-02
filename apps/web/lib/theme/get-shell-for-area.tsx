'use client'

/**
 * Shell Resolution for Areas
 *
 * Gets the appropriate shell component for a given area.
 * Implements fallback behavior: if design override crashes, use default.
 *
 * IMPORTANT: Uses React Error Boundary to catch render-time crashes,
 * not just synchronous errors during JSX creation.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react'
import type { AppDesign, ShellArea, NavContext, ShellProps } from '@saas/plugins-core'
import type { NavModelWithIcons } from '@/lib/nav/types'
import { tokenKeyToCssVar } from './constants'

/**
 * UI incident types for structured logging.
 */
type UIIncidentType = 'shell_crash' | 'theme_error' | 'nav_mandatory_restored' | 'nav_invalid_model'

/**
 * UI incident structure for audit logging.
 */
interface UIIncident {
  type: UIIncidentType
  area?: ShellArea
  message: string
  error?: unknown
  timestamp: string
}

/**
 * Props for shell resolution.
 */
export interface GetShellOptions {
  /** The area to get shell for */
  area: ShellArea

  /** The design providing shell overrides */
  design: AppDesign | null

  /** Default shell component to use as fallback */
  DefaultShell: React.ComponentType<{
    nav: NavModelWithIcons
    navContext: NavContext
    children: ReactNode
    pathname?: string
  }>

  /** Navigation model */
  nav: NavModelWithIcons

  /** Navigation context */
  navContext: NavContext

  /** Child content */
  children: ReactNode

  /** Current pathname */
  pathname?: string
}

/**
 * Log a UI incident with structured data.
 * Per spec section 7.2: Log incidents for override crashes, missing mandatory items, invalid nav.
 *
 * @param incident - The incident to log
 */
function logUIIncident(incident: UIIncident): void {
  const logData = {
    ...incident,
    // Include stack trace if error is an Error object
    stack: incident.error instanceof Error ? incident.error.stack : undefined,
  }

  // Structured log for potential log aggregator pickup
  console.error('[ui:incident]', JSON.stringify(logData))

  // TODO: In production, emit to backend audit endpoint:
  // fetch('/api/v1/audit/ui-incident', { method: 'POST', body: JSON.stringify(logData) })
}

/**
 * Log an incident when shell override fails.
 */
function logShellIncident(area: ShellArea, error: unknown): void {
  logUIIncident({
    type: 'shell_crash',
    area,
    message: `Shell override failed for area "${area}"`,
    error,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Props for ShellErrorBoundary.
 */
interface ShellErrorBoundaryProps {
  /** Area for logging */
  area: ShellArea
  /** Current pathname for reset detection */
  pathname?: string
  /** Fallback shell to render on error */
  fallback: ReactNode
  /** Children to try rendering */
  children: ReactNode
}

/**
 * State for ShellErrorBoundary.
 */
interface ShellErrorBoundaryState {
  hasError: boolean
}

/**
 * Error Boundary for shell components.
 *
 * Catches render-time errors from shell components (not just synchronous errors
 * during JSX creation). This is required because try/catch around JSX doesn't
 * catch errors that occur during React's render phase.
 *
 * When a shell crashes:
 * 1. Logs structured incident for monitoring
 * 2. Falls back to default shell
 * 3. App remains functional
 *
 * Resets error state when area or pathname changes to allow recovery after navigation.
 */
class ShellErrorBoundary extends Component<ShellErrorBoundaryProps, ShellErrorBoundaryState> {
  constructor(props: ShellErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ShellErrorBoundaryState {
    return { hasError: true }
  }

  componentDidUpdate(prevProps: ShellErrorBoundaryProps): void {
    // Reset error state when area or pathname changes - allows recovery after navigation
    // This handles both cross-area navigation and within-area route changes
    const areaChanged = prevProps.area !== this.props.area
    const pathnameChanged = prevProps.pathname !== this.props.pathname

    if (this.state.hasError && (areaChanged || pathnameChanged)) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the shell crash incident
    logShellIncident(this.props.area, error)

    // Log additional React error info for debugging
    console.error('[ShellErrorBoundary] Component stack:', errorInfo.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render fallback shell
      return this.props.fallback
    }

    return this.props.children
  }
}

/**
 * Get the shell component for a given area.
 * Falls back to DefaultShell if design doesn't provide one or if an error occurs.
 *
 * Fallback behavior per spec:
 * - If override exists but crashes (render-time), Error Boundary catches and uses default
 * - If override is missing, use default
 * - No silent failures - all errors are logged
 *
 * IMPORTANT: Design shells are wrapped in ShellErrorBoundary to catch render-time
 * errors, not just synchronous errors during JSX creation.
 */
export function getShellForArea(options: GetShellOptions): ReactNode {
  const { area, design, DefaultShell, nav, navContext, children, pathname } = options

  // Convert nav to ShellProps format
  const shellProps: Omit<ShellProps, 'area'> & { area: ShellArea } = {
    nav: nav as unknown as ShellProps['nav'],
    navContext,
    area,
    children,
    pathname,
  }

  // Default shell fallback - used when design shell is missing or crashes
  const defaultShellElement = (
    <DefaultShell nav={nav} navContext={navContext} pathname={pathname}>
      {children}
    </DefaultShell>
  )

  try {
    // If no design, use default shell (no error boundary needed)
    if (!design) {
      return defaultShellElement
    }

    // Check for area-specific shell from design
    // All design shells are wrapped in ShellErrorBoundary for render-time crash protection
    if (area === 'app') {
      // For app area, use AppShell if available
      if (design.AppShell) {
        const AppShell = design.AppShell as React.ComponentType<ShellProps>
        return (
          <ShellErrorBoundary area={area} pathname={pathname} fallback={defaultShellElement}>
            <AppShell {...shellProps}>{children}</AppShell>
          </ShellErrorBoundary>
        )
      }
    }

    if (area === 'admin' && design.adminOverride?.shell?.Shell) {
      const AdminShell = design.adminOverride.shell.Shell as React.ComponentType<ShellProps>
      return (
        <ShellErrorBoundary area={area} pathname={pathname} fallback={defaultShellElement}>
          <AdminShell {...shellProps}>{children}</AdminShell>
        </ShellErrorBoundary>
      )
    }

    if (area === 'auth' && design.authOverride?.shell?.Shell) {
      const AuthShell = design.authOverride.shell.Shell as React.ComponentType<ShellProps>
      return (
        <ShellErrorBoundary area={area} pathname={pathname} fallback={defaultShellElement}>
          <AuthShell {...shellProps}>{children}</AuthShell>
        </ShellErrorBoundary>
      )
    }

    // Check deprecated shells array for backwards compatibility
    if (design.shells) {
      const shellOverride = design.shells.find((s) => s.area === area)
      if (shellOverride) {
        const Shell = shellOverride.Shell as React.ComponentType<ShellProps>
        return (
          <ShellErrorBoundary area={area} pathname={pathname} fallback={defaultShellElement}>
            <Shell {...shellProps}>{children}</Shell>
          </ShellErrorBoundary>
        )
      }
    }

    // Use default shell (no error boundary needed for default)
    return defaultShellElement
  } catch (error) {
    // This catches synchronous errors during JSX creation
    // (Error Boundary catches render-time errors)
    logShellIncident(area, error)
    return defaultShellElement
  }
}

/**
 * Get theme tokens for a specific area.
 * Applies area-specific token overrides if available.
 * Returns tokens with proper CSS variable names (--prefix).
 *
 * Per spec §2.1: cssVars is the canonical substrate (required), applied first.
 * Typed properties are then layered on top.
 */
export function getTokensForArea(
  design: AppDesign | null,
  area: ShellArea
): Record<string, string> | null {
  if (!design) return null

  try {
    // Start with base app tokens
    const baseTokens = design.appTokens()
    const tokens: Record<string, string> = {}

    // 1. Apply cssVars first (canonical substrate per spec §2.1 - required)
    // These already have -- prefix
    for (const [key, value] of Object.entries(baseTokens.cssVars)) {
      if (value !== undefined) {
        tokens[key] = value
      }
    }

    // 2. Apply typed properties from base tokens (converted to CSS var names)
    for (const [key, value] of Object.entries(baseTokens)) {
      if (key === 'cssVars' || key === 'appName' || key === 'logoUrl') continue
      if (typeof value === 'string') {
        const cssVar = tokenKeyToCssVar(key)
        tokens[cssVar] = value
      }
    }

    // 3. Apply area-specific overrides (cssVars first, then typed)
    const areaOverride =
      area === 'admin' ? design.adminOverride?.tokens :
      area === 'auth' ? design.authOverride?.tokens :
      undefined

    if (areaOverride) {
      // Apply area cssVars first if present (already have -- prefix)
      if (areaOverride.cssVars) {
        for (const [key, value] of Object.entries(areaOverride.cssVars)) {
          if (value !== undefined) {
            tokens[key] = value
          }
        }
      }

      // Apply area typed properties (converted to CSS var names)
      for (const [key, value] of Object.entries(areaOverride)) {
        if (key === 'cssVars') continue
        if (typeof value === 'string') {
          const cssVar = tokenKeyToCssVar(key)
          tokens[cssVar] = value
        }
      }
    }

    return tokens
  } catch (error) {
    console.error(`[getTokensForArea] Error getting tokens for "${area}":`, error)
    return null
  }
}

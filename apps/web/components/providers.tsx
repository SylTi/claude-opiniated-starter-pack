'use client'

import type { ReactNode, ComponentType } from 'react'
import type { UserDTO } from '@saas/shared'
import { AuthProvider } from '@/contexts/auth-context'
import { DesignProvider } from '@/contexts/design-context'
import { NavigationProvider } from '@/contexts/navigation-context'
import { FrameworkProvider } from '@/contexts/framework-context'
import { ShellWrapper } from '@/components/shells/shell-wrapper'
import { Header } from '@/components/header'
import { clientDesign } from '@saas/config/main-app/client'
import { type Theme, DEFAULT_THEME } from '@/lib/theme-config'

/**
 * Type for plugin's AppProviders component.
 * The design type uses `unknown` for React.ReactNode to stay framework-agnostic,
 * but we know it's actually a React component in this context.
 */
type PluginAppProvidersComponent = ComponentType<{ children: ReactNode }>

/**
 * Props for Providers component.
 */
interface ProvidersProps {
  /** Page content to be wrapped by ShellWrapper */
  children: ReactNode
  initialHasUserInfoCookie?: boolean
  initialUserRole?: UserDTO['role'] | null
  /**
   * Server-side safe mode status.
   * Passed from layout.tsx which checks SAFE_MODE env var.
   * When true, design overrides are disabled for safety.
   */
  serverSafeMode?: boolean
  /**
   * Initial theme from cookie.
   * Passed from layout.tsx to avoid hydration mismatch.
   */
  initialTheme?: Theme
}

/**
 * Combined providers wrapper component.
 * Wraps children with all necessary context providers.
 *
 * Provider hierarchy (per spec §2.6):
 * 1. FrameworkProvider (skeleton) - Next.js primitives
 * 2. AppProviders (plugin, optional) - Plugin's app-level providers
 * 3. AuthProvider (skeleton) - Authentication state
 * 4. DesignProvider (skeleton) - Theme tokens
 * 5. NavigationProvider (skeleton) - Navigation model
 * 6. AppShell (plugin via ShellWrapper) - Content area shell
 *
 * Layout structure:
 * - Header: Outside ShellWrapper but inside NavigationProvider (needs nav context)
 * - ShellWrapper: Only wraps page content, applies area-specific layouts
 *
 * Safe mode:
 * - serverSafeMode comes from server's SAFE_MODE env var check
 * - When enabled, AppProviders is skipped and design overrides are disabled
 * - Ensures app remains accessible if AppProviders breaks
 */
export function Providers({
  children,
  initialHasUserInfoCookie = false,
  initialUserRole = null,
  serverSafeMode,
  initialTheme = DEFAULT_THEME,
}: ProvidersProps): React.ReactElement {
  // Get plugin's AppProviders if available (cast from unknown to proper React type)
  const PluginAppProviders = !serverSafeMode && clientDesign.AppProviders
    ? (clientDesign.AppProviders as PluginAppProvidersComponent)
    : undefined

  // Build the core provider tree
  const coreProviders = (
    <AuthProvider
      initialHasUserInfoCookie={initialHasUserInfoCookie}
      initialUserRole={initialUserRole}
    >
      <DesignProvider design={clientDesign} serverSafeMode={serverSafeMode}>
        <NavigationProvider>
          {/* Header needs NavigationContext but must be OUTSIDE ShellWrapper */}
          <Header />
          {/* Only page content goes through ShellWrapper for area-specific layouts */}
          <ShellWrapper>
            {children}
          </ShellWrapper>
        </NavigationProvider>
      </DesignProvider>
    </AuthProvider>
  )

  return (
    <FrameworkProvider>
      {PluginAppProviders ? (
        <PluginAppProviders>
          {coreProviders}
        </PluginAppProviders>
      ) : (
        coreProviders
      )}
    </FrameworkProvider>
  )
}

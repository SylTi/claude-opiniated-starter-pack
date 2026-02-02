'use client'

import type { ReactNode } from 'react'
import type { UserDTO } from '@saas/shared'
import { AuthProvider } from '@/contexts/auth-context'
import { DesignProvider } from '@/contexts/design-context'
import { NavigationProvider } from '@/contexts/navigation-context'
import { ShellWrapper } from '@/components/shells/shell-wrapper'
import { Header } from '@/components/header'
import { clientDesign } from '@plugins/main-app/client'

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
}

/**
 * Combined providers wrapper component.
 * Wraps children with all necessary context providers.
 *
 * Layout structure:
 * - Header: Outside ShellWrapper but inside NavigationProvider (needs nav context)
 * - ShellWrapper: Only wraps page content, applies area-specific layouts
 *
 * This prevents auth shell from centering the header, and admin shell
 * from adding sidebar around the header.
 *
 * Uses the main-app plugin's clientDesign which includes:
 * - Theme tokens (with cssVars as canonical substrate)
 * - Navigation baseline
 * - AppShell component
 *
 * Safe mode:
 * - serverSafeMode comes from server's SAFE_MODE env var check
 * - When enabled, design overrides are disabled client-side too
 * - Ensures consistent behavior between server and client
 */
export function Providers({
  children,
  initialHasUserInfoCookie = false,
  initialUserRole = null,
  serverSafeMode,
}: ProvidersProps): React.ReactElement {
  return (
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
}

import type { ReactNode } from 'react'

/**
 * Auth layout component.
 *
 * NOTE: Shell rendering is handled by ShellWrapper in the root providers.
 * This layout passes children through - the actual auth shell structure
 * comes from the design system (DefaultAuthShell or design.authOverride.shell).
 */
export default function AuthLayout({ children }: { children: ReactNode }): React.ReactElement {
  // Shell structure is provided by ShellWrapper via the design system
  return <>{children}</>
}

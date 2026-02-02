/**
 * Main App Client Module
 *
 * Client-side exports for the main-app plugin.
 * This is used by the frontend to access design components.
 */

export { design } from '../design'
export { MainAppShell } from './components/AppShell'

// Re-export the client design with AppShell attached
import { design as baseDesign } from '../design'
import { MainAppShell } from './components/AppShell'
import type { AppDesign } from '@saas/plugins-core'

/**
 * Client-side design with AppShell component.
 * The AppShell is only available on the client side (React component).
 */
export const clientDesign: AppDesign = {
  ...baseDesign,
  AppShell: MainAppShell as AppDesign['AppShell'],
}

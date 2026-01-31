/**
 * Notes Plugin - Client Entrypoint
 *
 * Client-side hooks and UI components for the notes plugin.
 */

import type { NoteDTO } from './types.js'

/**
 * Dashboard widget configuration.
 */
export interface NotesWidgetConfig {
  maxNotes?: number
  showPreview?: boolean
}

/**
 * Default configuration.
 */
const defaultConfig: NotesWidgetConfig = {
  maxNotes: 5,
  showPreview: true,
}

let currentConfig = defaultConfig

/**
 * Set plugin configuration.
 */
export function setConfig(config: Partial<NotesWidgetConfig>): void {
  currentConfig = { ...defaultConfig, ...config }
}

/**
 * Dashboard widgets filter.
 * Adds a "Recent Notes" widget to the dashboard.
 */
export function dashboardWidgetsFilter(
  widgets: Array<{ id: string; type: string; title: string }>,
  context?: { tenantId?: number }
): Array<{ id: string; type: string; title: string }> {
  // Add notes widget
  return [
    ...widgets,
    {
      id: 'notes-recent',
      type: 'notes',
      title: 'Recent Notes',
    },
  ]
}

/**
 * Plugin registration function.
 */
export function register(context: { config?: NotesWidgetConfig }): void {
  if (context.config) {
    setConfig(context.config)
  }
  console.log('[notes] Client plugin registered')
}

export type { NoteDTO }

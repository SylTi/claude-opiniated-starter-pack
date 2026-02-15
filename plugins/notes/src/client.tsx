/**
 * Notes Plugin - Client Entrypoint
 *
 * Client-side hooks and UI components for the notes plugin.
 * Default export provides the full plugin UI with path-based routing.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { NoteDTO } from './types'
import { notesText, translations, useNotesI18n } from './translations'
import { notesApi, type PluginStatusDTO } from './client/api'
import { NotesListPage } from './client/pages/notes-list-page'
import { NoteNewPage } from './client/pages/note-new-page'
import { NoteEditPage } from './client/pages/note-edit-page'
import { usePluginAuth } from '@saas/plugins-core/framework'
import { Button } from '@saas/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@saas/ui/card'
import { toast } from 'sonner'
import { FileText, Loader2, AlertCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Dashboard widget configuration (unchanged)
// ---------------------------------------------------------------------------

export interface NotesWidgetConfig {
  maxNotes?: number
  showPreview?: boolean
}

const defaultConfig: NotesWidgetConfig = {
  maxNotes: 5,
  showPreview: true,
}

let currentConfig = defaultConfig

export function setConfig(config: Partial<NotesWidgetConfig>): void {
  currentConfig = { ...defaultConfig, ...config }
}

export function dashboardWidgetsFilter(
  widgets: Array<{ id: string; type: string; title: string }>,
  context?: { tenantId?: number }
): Array<{ id: string; type: string; title: string }> {
  return [
    ...widgets,
    {
      id: 'notes-recent',
      type: 'notes',
      title: notesText('widget.recentNotes'),
    },
  ]
}

// ---------------------------------------------------------------------------
// Plugin App (default export) — path-based routing
// ---------------------------------------------------------------------------

export default function NotesPluginApp({ path }: { path: string }): React.ReactElement {
  const { t } = useNotesI18n()
  const { user, isLoading: authLoading } = usePluginAuth()
  const [pluginStatus, setPluginStatus] = useState<PluginStatusDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEnabling, setIsEnabling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState(path)

  const userId = user?.id
  const isAuthenticated = !!userId

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      window.location.assign('/login')
      return
    }

    const checkPluginStatus = async (): Promise<void> => {
      try {
        const status = await notesApi.getPluginStatus()
        setPluginStatus(status)
        setError(null)
      } catch {
        setError(t('ui.layout.statusError'))
      } finally {
        setIsLoading(false)
      }
    }

    checkPluginStatus()
  }, [isAuthenticated, authLoading, t])

  const handleEnablePlugin = async (): Promise<void> => {
    setIsEnabling(true)
    try {
      await notesApi.enablePlugin()
      const status = await notesApi.getPluginStatus()
      setPluginStatus(status)
      toast.success(t('ui.layout.enabledToast'))
    } catch {
      toast.error(t('ui.layout.enableErrorToast'))
    } finally {
      setIsEnabling(false)
    }
  }

  const handleNavigate = useCallback((nextPath: string): void => {
    const fullUrl = `/apps/notes${nextPath === '/' ? '' : nextPath}`
    window.history.pushState({}, '', fullUrl)
    setCurrentPath(nextPath)
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    function onPopState(): void {
      const segments = window.location.pathname.replace('/apps/notes', '') || '/'
      setCurrentPath(segments)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return <></>
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>{t('ui.layout.pluginErrorTitle')}</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.assign('/dashboard')} variant="outline">
              {t('ui.layout.backToDashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!pluginStatus?.enabled) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>{t('ui.layout.pluginTitle')}</CardTitle>
            </div>
            <CardDescription>
              {t('ui.layout.pluginDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('ui.layout.notEnabledDescription')}
            </p>
            <Button
              onClick={handleEnablePlugin}
              disabled={isEnabling}
              data-testid="enable-plugin-button"
            >
              {isEnabling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('ui.layout.enabling')}
                </>
              ) : (
                t('ui.layout.enablePlugin')
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Route based on currentPath
  const renderPage = (): React.ReactElement => {
    if (currentPath === '/new' || currentPath.startsWith('/new/')) {
      return <NoteNewPage onNavigate={handleNavigate} />
    }

    // Match /:id (numeric)
    const idMatch = currentPath.match(/^\/(\d+)$/)
    if (idMatch) {
      return <NoteEditPage noteId={Number(idMatch[1])} onNavigate={handleNavigate} />
    }

    return <NotesListPage onNavigate={handleNavigate} />
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        {renderPage()}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

export function register(context: { config?: NotesWidgetConfig }): void {
  if (context.config) {
    setConfig(context.config)
  }
  console.log('[notes] Client plugin registered')
}

export { translations }
export type { NoteDTO }

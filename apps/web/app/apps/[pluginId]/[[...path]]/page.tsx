/**
 * Plugin UI Host Route
 *
 * Catch-all route for hosting plugin UIs at /apps/[pluginId]/[[...path]].
 * This allows plugins to define their own routes under their namespace.
 *
 * Per spec section 5.1: Core provides one catch-all that loads plugin "app module"
 * from the static loader map and renders plugin pages.
 *
 * Current plugin format:
 * - Plugins export functions (register, filters) not React components
 * - Tier B plugins have server routes at /api/v1/apps/:pluginId/*
 * - This UI host is for future plugin-provided UI modules
 *
 * To add UI to a plugin:
 * 1. Export a default React component from the client entrypoint
 * 2. Component receives { path: string } prop for routing
 */

import { notFound } from 'next/navigation'
import { loadClientPluginManifest, hasClientEntrypoint, clientPluginLoaders } from '@saas/config/plugins/client'
import { registerPluginTranslations, type PluginTranslations } from '@saas/plugins-core'
import Link from 'next/link'
import { Suspense } from 'react'
import { getServerI18n } from '@/lib/i18n/server'

interface PluginPageProps {
  params: Promise<{
    pluginId: string
    path?: string[]
  }>
}

/**
 * Check if safe mode is enabled.
 * Safe mode disables all non-core plugins per spec section 7.1.
 */
function isSafeMode(): boolean {
  return process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true'
}

/**
 * Result of loading a plugin module.
 * Either success with a component, or error details.
 */
type PluginLoadResult =
  | { status: 'success'; component: React.ComponentType<{ path: string }> }
  | { status: 'success-matcher'; matchPage: (pathname: string) => PageMatch | null }
  | { status: 'no-component' }
  | { status: 'error'; errorId: string }

interface PageMatch {
  component: React.ComponentType<{ params: Record<string, string> }>
  params: Record<string, string>
}

/**
 * Attempt to load a plugin module and extract its component.
 * Performs async loading outside of JSX construction.
 */
async function loadPluginModule(pluginId: string): Promise<PluginLoadResult> {
  const loader = clientPluginLoaders[pluginId]
  if (!loader) {
    return { status: 'error', errorId: `err_no_loader_${pluginId}` }
  }

  try {
    const pluginModule = await loader()
    const translations = (pluginModule as { translations?: unknown }).translations
    if (translations && typeof translations === 'object') {
      registerPluginTranslations(pluginId, translations as PluginTranslations)
    }

    // Look for default export (plugin app component)
    const PluginApp = (pluginModule as { default?: React.ComponentType<{ path: string }> }).default

    if (PluginApp && typeof PluginApp === 'function') {
      return { status: 'success', component: PluginApp }
    }

    // Page registry / dispatcher contract (main-app plugins)
    const matchPage = (pluginModule as { matchPage?: (pathname: string) => PageMatch | null }).matchPage
    if (matchPage && typeof matchPage === 'function') {
      return { status: 'success-matcher', matchPage }
    }

    return { status: 'no-component' }
  } catch (error) {
    // Generate traceable error ID
    const errorId = `err_${crypto.randomUUID().slice(0, 12)}`

    // Log full error details server-side with error ID for traceability
    console.error(`[PluginPage] Failed to load plugin "${pluginId}" [${errorId}]:`, error)

    return { status: 'error', errorId }
  }
}

/**
 * Plugin host page.
 * Renders the appropriate plugin UI based on pluginId and path.
 *
 * Uses the static loader map from @saas/config per spec section 4.1.
 */
export default async function PluginPage({ params }: PluginPageProps): Promise<React.ReactNode> {
  const { pluginId, path = [] } = await params
  const { t } = await getServerI18n('skeleton')

  // Safe mode: disable all plugin UIs
  if (isSafeMode()) {
    return (
      <div className="container mx-auto py-8">
        <div className="rounded-lg border bg-destructive/10 p-6">
          <h1 className="text-2xl font-semibold mb-4">{t('plugin.safeModeTitle')}</h1>
          <p className="text-muted-foreground">
            {t('plugin.safeModeMessage')}
          </p>
        </div>
      </div>
    )
  }

  // Load plugin manifest from the static registry
  const manifest = await loadClientPluginManifest(pluginId)
  if (!manifest) {
    notFound()
  }

  // Tier A/B/C and main-app plugins can provide client UI modules.
  if (
    manifest.tier !== 'A' &&
    manifest.tier !== 'B' &&
    manifest.tier !== 'C' &&
    manifest.tier !== 'main-app'
  ) {
    notFound()
  }

  const fullPath = path.length > 0 ? `/${path.join('/')}` : '/'

  // Check if plugin has a client entrypoint with UI
  if (!hasClientEntrypoint(pluginId)) {
    // Plugin exists but doesn't have client-side UI
    return (
      <div className="container mx-auto py-8">
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-2xl font-semibold mb-4">
            {manifest.displayName || manifest.pluginId}
          </h1>
          <p className="text-muted-foreground mb-4">
            {t('plugin.noUiMessage')}
          </p>
          {(manifest.tier === 'B' || manifest.tier === 'C') && (
            <p className="text-sm text-muted-foreground">
              {t('plugin.noUiExtended')}
            </p>
          )}
          <div className="mt-6">
            <Link href="/dashboard" className="text-primary hover:underline">
              ← {t('plugin.backToDashboard')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Load plugin module (async work done outside JSX construction)
  const loadResult = await loadPluginModule(pluginId)

  // Render based on load result
  if (loadResult.status === 'success') {
    const PluginApp = loadResult.component
    return <PluginApp path={fullPath} />
  }

  if (loadResult.status === 'success-matcher') {
    const pageMatch = loadResult.matchPage(fullPath)
    if (!pageMatch) {
      notFound()
    }

    const MatchedPage = pageMatch.component
    return (
      <Suspense fallback={<div className="container mx-auto py-8">{t('plugin.loading')}</div>}>
        <MatchedPage params={pageMatch.params} />
      </Suspense>
    )
  }

  if (loadResult.status === 'no-component') {
    // Plugin loaded but doesn't export a UI component
    // This is expected for current plugins - they export hooks/filters, not UI
    return (
      <div className="container mx-auto py-8">
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-2xl font-semibold mb-4">
            {manifest.displayName || manifest.pluginId}
          </h1>
          <p className="text-muted-foreground mb-4">
            {t('plugin.version', { version: manifest.version })}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {t('plugin.integratedMessage')}
          </p>
          <div className="mt-6">
            <Link href="/dashboard" className="text-primary hover:underline">
              ← {t('plugin.backToDashboard')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Error case - SECURITY: Don't expose runtime error details to end users
  // Only show a generic message - details are in server logs with error ID
  return (
    <div className="container mx-auto py-8">
      <div className="rounded-lg border bg-destructive/10 p-6">
        <h1 className="text-2xl font-semibold mb-4">{t('plugin.errorTitle')}</h1>
        <p className="text-muted-foreground">
          {t('plugin.errorMessage')}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {t('plugin.errorId', { id: loadResult.errorId })}
        </p>
      </div>
    </div>
  )
}

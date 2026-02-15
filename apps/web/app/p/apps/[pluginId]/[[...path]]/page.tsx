/**
 * Public Plugin Host Route
 *
 * Catch-all route for hosting public plugin UIs at /p/apps/[pluginId]/[[...path]].
 * Similar to the authenticated host at /apps/[pluginId]/[[...path]], but skips auth.
 * Uses /p/apps/ prefix to differentiate from other public pages.
 *
 * Loads plugin module, looks for `publicPage` export (component receiving `{ path: string }`).
 */

import { notFound } from 'next/navigation'
import { loadClientPluginManifest, hasClientEntrypoint, clientPluginLoaders } from '@saas/config/plugins/client'
import { registerPluginTranslations, type PluginTranslations } from '@saas/plugins-core'
import { Suspense } from 'react'
import { getServerI18n } from '@/lib/i18n/server'

interface PublicPluginPageProps {
  params: Promise<{
    pluginId: string
    path?: string[]
  }>
}

/**
 * Check if safe mode is enabled.
 */
function isSafeMode(): boolean {
  return process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true'
}

/**
 * Result of loading a public plugin module.
 */
type PublicPluginLoadResult =
  | { status: 'success'; component: React.ComponentType<{ path: string }> }
  | { status: 'no-component' }
  | { status: 'error'; errorId: string }

/**
 * Attempt to load a plugin module and extract its publicPage component.
 */
async function loadPublicPluginModule(pluginId: string): Promise<PublicPluginLoadResult> {
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

    // Look for publicPage export
    const PublicPage = (pluginModule as { publicPage?: React.ComponentType<{ path: string }> }).publicPage

    if (PublicPage && typeof PublicPage === 'function') {
      return { status: 'success', component: PublicPage }
    }

    return { status: 'no-component' }
  } catch (error) {
    const errorId = `err_${crypto.randomUUID().slice(0, 12)}`
    console.error(`[PublicPluginPage] Failed to load plugin "${pluginId}" [${errorId}]:`, error)
    return { status: 'error', errorId }
  }
}

/**
 * Public plugin host page.
 * Renders the publicPage export of a plugin without requiring authentication.
 */
export default async function PublicPluginPage({ params }: PublicPluginPageProps): Promise<React.ReactNode> {
  const { pluginId, path = [] } = await params
  const { t } = await getServerI18n('skeleton')

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

  const manifest = await loadClientPluginManifest(pluginId)
  if (!manifest) {
    notFound()
  }

  if (!hasClientEntrypoint(pluginId)) {
    notFound()
  }

  const fullPath = path.length > 0 ? `/${path.join('/')}` : '/'
  const loadResult = await loadPublicPluginModule(pluginId)

  if (loadResult.status === 'success') {
    const PublicApp = loadResult.component
    return (
      <Suspense fallback={<div className="container mx-auto py-8">{t('plugin.loading')}</div>}>
        <PublicApp path={fullPath} />
      </Suspense>
    )
  }

  if (loadResult.status === 'no-component') {
    notFound()
  }

  // Error case
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

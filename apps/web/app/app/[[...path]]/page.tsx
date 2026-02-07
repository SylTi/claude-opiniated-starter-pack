/**
 * Main App Dispatcher Route
 *
 * Hosts the configured main-app plugin at /app/*.
 * This matches main-app plugin expectations (e.g. notarium pages use /app paths).
 */

import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getMainAppPluginId, loadClientPluginManifest, hasClientEntrypoint, clientPluginLoaders } from '@saas/config/plugins/client'
import { verifyUserFromApi } from '@/lib/server/auth'

interface MainAppDispatcherPageProps {
  params: Promise<{
    path?: string[]
  }>
}

interface PageMatch {
  component: React.ComponentType<{ params: Record<string, string> }>
  params: Record<string, string>
}

function isSafeMode(): boolean {
  return process.env.SAFE_MODE === '1' || process.env.SAFE_MODE === 'true'
}

export default async function MainAppDispatcherPage({
  params,
}: MainAppDispatcherPageProps): Promise<React.ReactNode> {
  if (isSafeMode()) {
    notFound()
  }

  const { path = [] } = await params
  const callbackPath = path.length > 0 ? `/app/${path.join('/')}` : '/app'
  const currentUser = await verifyUserFromApi()
  if (!currentUser) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`)
  }

  const pluginId = getMainAppPluginId()
  const fullPath = path.length > 0 ? `/${path.join('/')}` : '/'

  const manifest = await loadClientPluginManifest(pluginId)
  if (!manifest) {
    notFound()
  }

  if (!hasClientEntrypoint(pluginId)) {
    notFound()
  }

  const loader = clientPluginLoaders[pluginId]
  if (!loader) {
    notFound()
  }

  const pluginModule = await loader()

  const PluginApp = (pluginModule as { default?: React.ComponentType<{ path: string }> }).default
  if (PluginApp && typeof PluginApp === 'function') {
    return <PluginApp path={fullPath} />
  }

  const matchPage = (pluginModule as { matchPage?: (pathname: string) => PageMatch | null }).matchPage
  if (matchPage && typeof matchPage === 'function') {
    const pageMatch = matchPage(fullPath)
    if (!pageMatch) {
      notFound()
    }

    const MatchedPage = pageMatch.component
    return (
      <Suspense fallback={<div className="container mx-auto py-8">Loading...</div>}>
        <MatchedPage params={pageMatch.params} />
      </Suspense>
    )
  }

  notFound()
}

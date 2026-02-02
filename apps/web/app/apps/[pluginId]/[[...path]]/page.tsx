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
import Link from 'next/link'

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
  | { status: 'no-component' }
  | { status: 'error'; errorId: string }

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

    // Look for default export (plugin app component)
    const PluginApp = (pluginModule as { default?: React.ComponentType<{ path: string }> }).default

    if (PluginApp && typeof PluginApp === 'function') {
      return { status: 'success', component: PluginApp }
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

  // Safe mode: disable all plugin UIs
  if (isSafeMode()) {
    return (
      <div className="container mx-auto py-8">
        <div className="rounded-lg border bg-destructive/10 p-6">
          <h1 className="text-2xl font-semibold mb-4">Safe Mode Active</h1>
          <p className="text-muted-foreground">
            Plugin UIs are disabled in safe mode. Contact your administrator.
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

  // Only Tier A and B plugins can have UI
  if (manifest.tier !== 'A' && manifest.tier !== 'B') {
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
            This plugin does not provide a standalone UI.
          </p>
          {manifest.tier === 'B' && (
            <p className="text-sm text-muted-foreground">
              Tier B plugins typically extend the app via API routes and hooks
              rather than standalone pages.
            </p>
          )}
          <div className="mt-6">
            <Link href="/dashboard" className="text-primary hover:underline">
              ← Back to Dashboard
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
            Version {manifest.version}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            This plugin provides hooks and filters but does not have a standalone UI.
            Its functionality is integrated into other parts of the application.
          </p>
          <div className="mt-6">
            <Link href="/dashboard" className="text-primary hover:underline">
              ← Back to Dashboard
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
        <h1 className="text-2xl font-semibold mb-4">Plugin Error</h1>
        <p className="text-muted-foreground">
          Failed to load plugin. Please try again later or contact support if the issue persists.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Error ID: {loadResult.errorId}
        </p>
      </div>
    </div>
  )
}

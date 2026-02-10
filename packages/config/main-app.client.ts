/**
 * Main App Design Loader (Client)
 *
 * Resolves the configured main-app plugin client design at runtime.
 * Supports modules exporting either `clientDesign` or `design`.
 */

import { isAppDesign, type AppDesign } from '@saas/plugins-core'
import { getMainAppPluginId } from './plugins.config.js'
import { clientPluginLoaders } from './plugins.client.js'

type MainAppClientModule = {
  clientDesign?: unknown
  design?: unknown
}

let cachedClientDesignPromise: Promise<AppDesign> | null = null

async function resolveMainAppClientDesign(): Promise<AppDesign> {
  const pluginId = getMainAppPluginId()
  const loader = clientPluginLoaders[pluginId]

  if (!loader) {
    throw new Error(`No client loader configured for main-app plugin "${pluginId}"`)
  }

  const module = (await loader()) as MainAppClientModule

  if (isAppDesign(module.clientDesign)) {
    return module.clientDesign
  }

  if (isAppDesign(module.design)) {
    return module.design
  }

  throw new Error(
    `Main-app plugin "${pluginId}" must export a valid "clientDesign" or "design" object`
  )
}

export async function loadMainAppClientDesign(): Promise<AppDesign> {
  if (!cachedClientDesignPromise) {
    cachedClientDesignPromise = resolveMainAppClientDesign()
  }
  return cachedClientDesignPromise
}

export function resetMainAppClientDesignCacheForTests(): void {
  cachedClientDesignPromise = null
}

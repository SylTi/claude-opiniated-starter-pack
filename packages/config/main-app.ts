/**
 * Main App Design Loader (Server)
 *
 * Resolves the configured main-app plugin design at runtime.
 * This avoids hardcoding a specific package such as @plugins/main-app.
 */

import { isAppDesign, type AppDesign } from '@saas/plugins-core'
import { getMainAppPluginId } from './plugins.config.js'
import { serverPluginLoaders } from './plugins.server.js'

type MainAppServerModule = {
  design?: unknown
}

let cachedDesignPromise: Promise<AppDesign> | null = null

async function resolveMainAppDesign(): Promise<AppDesign> {
  const pluginId = getMainAppPluginId()
  const loader = serverPluginLoaders[pluginId]

  if (!loader) {
    throw new Error(`No server loader configured for main-app plugin "${pluginId}"`)
  }

  const module = (await loader()) as MainAppServerModule
  if (!isAppDesign(module.design)) {
    throw new Error(`Main-app plugin "${pluginId}" does not export a valid "design" object`)
  }

  return module.design
}

export async function loadMainAppDesign(): Promise<AppDesign> {
  if (!cachedDesignPromise) {
    cachedDesignPromise = resolveMainAppDesign()
  }
  return cachedDesignPromise
}

export function resetMainAppDesignCacheForTests(): void {
  cachedDesignPromise = null
}

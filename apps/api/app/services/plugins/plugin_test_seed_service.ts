import { pathToFileURL } from 'node:url'
import type { PluginTestSeederInfo } from '@saas/config/plugins/migrations'

export type PluginTestSeedContext = {
  pluginId: string
}

type PluginTestSeederHandler = (context: PluginTestSeedContext) => Promise<void> | void

type PluginTestSeederModule = {
  seedTestData?: PluginTestSeederHandler
  default?: PluginTestSeederHandler
}

type SeedLogger = {
  warn: (message: string) => void
}

export type PluginTestSeedResult = {
  executed: number
  skipped: number
}

function getSeederHandler(mod: PluginTestSeederModule): PluginTestSeederHandler | null {
  if (typeof mod.seedTestData === 'function') {
    return mod.seedTestData
  }

  if (typeof mod.default === 'function') {
    return mod.default
  }

  return null
}

/**
 * Execute optional plugin test seeders found in plugin folders.
 *
 * Contract:
 * - Preferred export: `seedTestData(context)`
 * - Fallback export: `default(context)`
 */
export async function runPluginTestSeeders(
  seeders: PluginTestSeederInfo[],
  logger: SeedLogger
): Promise<PluginTestSeedResult> {
  let executed = 0
  let skipped = 0

  for (const seeder of seeders) {
    const moduleUrl = pathToFileURL(seeder.seederFilePath).href
    const mod = (await import(moduleUrl)) as PluginTestSeederModule
    const handler = getSeederHandler(mod)

    if (!handler) {
      logger.warn(
        `[PluginTestSeeder] Skipping "${seeder.pluginId}" - no seedTestData/default export at ${seeder.seederFilePath}`
      )
      skipped += 1
      continue
    }

    await handler({ pluginId: seeder.pluginId })
    executed += 1
  }

  return { executed, skipped }
}

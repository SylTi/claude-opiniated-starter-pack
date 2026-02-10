import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from '@japa/runner'
import type { PluginTestSeederInfo } from '@saas/config/plugins/migrations'
import { runPluginTestSeeders } from '#services/plugins/plugin_test_seed_service'

type GlobalSeedCalls = typeof globalThis & {
  __pluginTestSeedCalls?: string[]
}

async function createTempSeederFile(
  fileName: string,
  contents: string
): Promise<{
  dir: string
  filePath: string
}> {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-seeder-'))
  const filePath = join(dir, fileName)
  await writeFile(filePath, contents, 'utf-8')
  return { dir, filePath }
}

test.group('PluginTestSeedService', () => {
  test('executes named seedTestData export', async ({ assert }) => {
    const globalObject = globalThis as GlobalSeedCalls
    globalObject.__pluginTestSeedCalls = []

    const { dir, filePath } = await createTempSeederFile(
      'named.mjs',
      `
export async function seedTestData(context) {
  const current = globalThis.__pluginTestSeedCalls ?? []
  globalThis.__pluginTestSeedCalls = [...current, context.pluginId]
}
`
    )

    try {
      const seeders: PluginTestSeederInfo[] = [
        {
          pluginId: 'notes',
          packageName: '@plugins/notes',
          seederFilePath: filePath,
        },
      ]

      const warnings: string[] = []
      const result = await runPluginTestSeeders(seeders, {
        warn: (message) => warnings.push(message),
      })

      assert.deepEqual(globalObject.__pluginTestSeedCalls, ['notes'])
      assert.deepEqual(result, { executed: 1, skipped: 0 })
      assert.lengthOf(warnings, 0)
    } finally {
      delete globalObject.__pluginTestSeedCalls
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('falls back to default export and skips missing handlers', async ({ assert }) => {
    const globalObject = globalThis as GlobalSeedCalls
    globalObject.__pluginTestSeedCalls = []

    const seededModule = await createTempSeederFile(
      'default.mjs',
      `
export default async function seed(context) {
  const current = globalThis.__pluginTestSeedCalls ?? []
  globalThis.__pluginTestSeedCalls = [...current, context.pluginId]
}
`
    )

    const skippedModule = await createTempSeederFile(
      'invalid.mjs',
      `
export const notASeeder = true
`
    )

    try {
      const seeders: PluginTestSeederInfo[] = [
        {
          pluginId: 'files',
          packageName: '@plugins/files',
          seederFilePath: seededModule.filePath,
        },
        {
          pluginId: 'wiki',
          packageName: '@plugins/wiki',
          seederFilePath: skippedModule.filePath,
        },
      ]

      const warnings: string[] = []
      const result = await runPluginTestSeeders(seeders, {
        warn: (message) => warnings.push(message),
      })

      assert.deepEqual(globalObject.__pluginTestSeedCalls, ['files'])
      assert.deepEqual(result, { executed: 1, skipped: 1 })
      assert.lengthOf(warnings, 1)
      assert.include(warnings[0], 'wiki')
    } finally {
      delete globalObject.__pluginTestSeedCalls
      await rm(seededModule.dir, { recursive: true, force: true })
      await rm(skippedModule.dir, { recursive: true, force: true })
    }
  })

  test('propagates errors thrown by plugin seeder', async ({ assert }) => {
    const failingModule = await createTempSeederFile(
      'failing.mjs',
      `
export async function seedTestData() {
  throw new Error('plugin seeder failed')
}
`
    )

    try {
      const seeders: PluginTestSeederInfo[] = [
        {
          pluginId: 'calendar',
          packageName: '@plugins/calendar',
          seederFilePath: failingModule.filePath,
        },
      ]

      try {
        await runPluginTestSeeders(seeders, { warn: () => {} })
        assert.fail('Expected runPluginTestSeeders to throw')
      } catch (error) {
        assert.include((error as Error).message, 'plugin seeder failed')
      }
    } finally {
      await rm(failingModule.dir, { recursive: true, force: true })
    }
  })
})

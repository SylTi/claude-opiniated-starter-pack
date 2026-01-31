import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import PluginSchemaChecker from '#services/plugins/plugin_schema_checker'
import PluginDbState from '#models/plugin_db_state'
import { PluginSchemaMismatchError } from '#exceptions/plugin_errors'
import type { PluginManifest } from '@saas/plugins-core'

function createTestManifest(pluginId: string, schemaVersion: number | undefined): PluginManifest {
  return {
    pluginId,
    packageName: `@plugins/${pluginId}`,
    version: '1.0.0',
    tier: 'B',
    requestedCapabilities: [],
    migrations: schemaVersion ? { dir: './migrations', schemaVersion } : undefined,
  }
}

test.group('PluginSchemaChecker - checkCompatibility', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('passes when DB version matches expected version', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    // Set up DB state
    await PluginDbState.create({
      pluginId: 'matching-plugin',
      schemaVersion: 3,
    })

    const manifests: PluginManifest[] = [createTestManifest('matching-plugin', 3)]

    // Should not throw
    await assert.doesNotReject(async () => {
      await checker.checkCompatibility(manifests)
    })
  })

  test('passes when DB version is higher than expected', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    // DB is ahead (maybe from a rollback)
    await PluginDbState.create({
      pluginId: 'ahead-plugin',
      schemaVersion: 5,
    })

    const manifests: PluginManifest[] = [
      createTestManifest('ahead-plugin', 3), // Expected 3, have 5
    ]

    // Should not throw - DB is ahead which is fine
    await assert.doesNotReject(async () => {
      await checker.checkCompatibility(manifests)
    })
  })

  test('throws PluginSchemaMismatchError when DB version is behind', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    // DB is behind
    await PluginDbState.create({
      pluginId: 'behind-plugin',
      schemaVersion: 1,
    })

    const manifests: PluginManifest[] = [
      createTestManifest('behind-plugin', 3), // Expected 3, have 1
    ]

    try {
      await checker.checkCompatibility(manifests)
      assert.fail('Expected PluginSchemaMismatchError to be thrown')
    } catch (error) {
      assert.instanceOf(error, PluginSchemaMismatchError)
      if (error instanceof PluginSchemaMismatchError) {
        assert.equal(error.pluginId, 'behind-plugin')
        assert.equal(error.expectedVersion, 3)
        assert.equal(error.actualVersion, 1)
        assert.include(error.message, 'behind-plugin')
        assert.include(error.message, 'migration')
      }
    }
  })

  test('throws when plugin has no DB record', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    // No DB record for this plugin (schema version defaults to 0)
    const manifests: PluginManifest[] = [
      createTestManifest('new-plugin', 2), // Expected 2, have 0
    ]

    try {
      await checker.checkCompatibility(manifests)
      assert.fail('Expected PluginSchemaMismatchError to be thrown')
    } catch (error) {
      assert.instanceOf(error, PluginSchemaMismatchError)
      if (error instanceof PluginSchemaMismatchError) {
        assert.equal(error.actualVersion, 0)
        assert.equal(error.expectedVersion, 2)
      }
    }
  })

  test('skips plugins without migrations config', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    // Plugin without migrations (Tier A plugin)
    const manifests: PluginManifest[] = [createTestManifest('no-db-plugin', undefined)]

    // Should not throw - plugin has no schema to check
    await assert.doesNotReject(async () => {
      await checker.checkCompatibility(manifests)
    })
  })

  test('checks multiple plugins', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    await PluginDbState.create({ pluginId: 'plugin-a', schemaVersion: 2 })
    await PluginDbState.create({ pluginId: 'plugin-b', schemaVersion: 1 })
    await PluginDbState.create({ pluginId: 'plugin-c', schemaVersion: 3 })

    const manifests: PluginManifest[] = [
      createTestManifest('plugin-a', 2), // OK
      createTestManifest('plugin-b', 1), // OK
      createTestManifest('plugin-c', 3), // OK
    ]

    await assert.doesNotReject(async () => {
      await checker.checkCompatibility(manifests)
    })
  })

  test('combines multiple mismatches into one error', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    await PluginDbState.create({ pluginId: 'plugin-a', schemaVersion: 2 })
    await PluginDbState.create({ pluginId: 'plugin-b', schemaVersion: 1 }) // Behind!
    // plugin-c has no record (schemaVersion = 0)

    const manifests: PluginManifest[] = [
      createTestManifest('plugin-a', 2), // OK
      createTestManifest('plugin-b', 5), // Expected 5, have 1
      createTestManifest('plugin-c', 3), // Expected 3, have 0
    ]

    try {
      await checker.checkCompatibility(manifests)
      assert.fail('Expected PluginSchemaMismatchError to be thrown')
    } catch (error) {
      assert.instanceOf(error, PluginSchemaMismatchError)
      if (error instanceof PluginSchemaMismatchError) {
        // Should contain both plugin IDs
        assert.include(error.pluginId, 'plugin-b')
        assert.include(error.pluginId, 'plugin-c')
        assert.include(error.message, 'Multiple')
      }
    }
  })
})

test.group('PluginSchemaChecker - checkPlugin', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('returns valid result when versions match', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    await PluginDbState.create({
      pluginId: 'test-plugin',
      schemaVersion: 7,
    })

    const result = await checker.checkPlugin(createTestManifest('test-plugin', 7))

    assert.isTrue(result.valid)
    assert.equal(result.expectedVersion, 7)
    assert.equal(result.actualVersion, 7)
    assert.isUndefined(result.error)
  })

  test('returns invalid result with error when behind', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    await PluginDbState.create({
      pluginId: 'behind-plugin',
      schemaVersion: 2,
    })

    const result = await checker.checkPlugin(createTestManifest('behind-plugin', 5))

    assert.isFalse(result.valid)
    assert.equal(result.expectedVersion, 5)
    assert.equal(result.actualVersion, 2)
    assert.instanceOf(result.error, PluginSchemaMismatchError)
  })

  test('returns valid for plugin without migrations', async ({ assert }) => {
    const checker = new PluginSchemaChecker()

    const result = await checker.checkPlugin(createTestManifest('no-db', undefined))

    assert.isTrue(result.valid)
    assert.equal(result.expectedVersion, 0)
    assert.equal(result.actualVersion, 0)
  })
})

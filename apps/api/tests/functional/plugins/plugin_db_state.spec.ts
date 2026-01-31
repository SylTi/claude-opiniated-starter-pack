import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import PluginDbState from '#models/plugin_db_state'
import db from '@adonisjs/lucid/services/db'
import { setPluginSchemaVersion } from '#services/plugins/schema_version_helper'

test.group('PluginDbState Model - CRUD', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('creates plugin db state record', async ({ assert }) => {
    const state = await PluginDbState.create({
      pluginId: 'test-plugin',
      schemaVersion: 1,
      installedPluginVersion: '1.0.0',
      lastMigrationName: '001_initial',
    })

    assert.equal(state.pluginId, 'test-plugin')
    assert.equal(state.schemaVersion, 1)
    assert.equal(state.installedPluginVersion, '1.0.0')
    assert.equal(state.lastMigrationName, '001_initial')
    assert.instanceOf(state.updatedAt, Date)
  })

  test('finds plugin by pluginId', async ({ assert }) => {
    await PluginDbState.create({
      pluginId: 'find-me',
      schemaVersion: 5,
    })

    const found = await PluginDbState.find('find-me')

    assert.isNotNull(found)
    assert.equal(found?.pluginId, 'find-me')
    assert.equal(found?.schemaVersion, 5)
  })

  test('updates schema version', async ({ assert }) => {
    const state = await PluginDbState.create({
      pluginId: 'update-me',
      schemaVersion: 1,
    })

    state.schemaVersion = 2
    state.lastMigrationName = '002_add_column'
    await state.save()

    const updated = await PluginDbState.find('update-me')
    assert.equal(updated?.schemaVersion, 2)
    assert.equal(updated?.lastMigrationName, '002_add_column')
  })

  test('getSchemaVersion returns current version', async ({ assert }) => {
    await PluginDbState.create({
      pluginId: 'version-check',
      schemaVersion: 3,
    })

    const version = await PluginDbState.getSchemaVersion('version-check')
    assert.equal(version, 3)
  })

  test('getSchemaVersion returns 0 for unknown plugin', async ({ assert }) => {
    const version = await PluginDbState.getSchemaVersion('unknown-plugin')
    assert.equal(version, 0)
  })
})

test.group('setPluginSchemaVersion Helper', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('creates new record if plugin not exists', async ({ assert }) => {
    await setPluginSchemaVersion('new-plugin', 1, db)

    const state = await PluginDbState.find('new-plugin')
    assert.isNotNull(state)
    assert.equal(state?.schemaVersion, 1)
  })

  test('updates existing record on conflict', async ({ assert }) => {
    // Create initial record
    await PluginDbState.create({
      pluginId: 'existing-plugin',
      schemaVersion: 1,
    })

    // Update via helper
    await setPluginSchemaVersion('existing-plugin', 3, db)

    const state = await PluginDbState.find('existing-plugin')
    assert.equal(state?.schemaVersion, 3)
  })

  test('bumps version incrementally', async ({ assert }) => {
    await setPluginSchemaVersion('incremental', 1, db)
    await setPluginSchemaVersion('incremental', 2, db)
    await setPluginSchemaVersion('incremental', 3, db)

    const state = await PluginDbState.find('incremental')
    assert.equal(state?.schemaVersion, 3)
  })
})

test.group('PluginDbState - No RLS (Global Table)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('plugin_db_state is accessible without tenant context', async ({ assert }) => {
    // This table should NOT have RLS since it's global
    await PluginDbState.create({
      pluginId: 'global-plugin',
      schemaVersion: 1,
    })

    // Should be accessible without setting tenant context
    const found = await PluginDbState.find('global-plugin')
    assert.isNotNull(found)
    assert.equal(found?.pluginId, 'global-plugin')
  })

  test('schema versions are shared across all tenants', async ({ assert }) => {
    // Create a plugin db state
    await PluginDbState.create({
      pluginId: 'shared-schema',
      schemaVersion: 5,
    })

    // Check version as different "tenants" (contexts) - should see the same value
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)
    const version1 = await PluginDbState.getSchemaVersion('shared-schema')

    await db.rawQuery(`SELECT set_config('app.tenant_id', '2', false)`)
    const version2 = await PluginDbState.getSchemaVersion('shared-schema')

    assert.equal(version1, 5)
    assert.equal(version2, 5)
  })
})

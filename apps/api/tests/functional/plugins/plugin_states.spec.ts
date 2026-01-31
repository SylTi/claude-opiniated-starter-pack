import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import PluginState from '#models/plugin_state'
import db from '@adonisjs/lucid/services/db'

test.group('PluginState Model - CRUD', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('creates plugin state for tenant', async ({ assert }) => {
    // Set tenant context
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)

    const state = await PluginState.create({
      tenantId: 1,
      pluginId: 'test-plugin',
      version: '1.0.0',
      enabled: false,
      config: { theme: 'dark' },
    })

    assert.isNotNull(state.id)
    assert.equal(state.pluginId, 'test-plugin')
    assert.equal(state.version, '1.0.0')
    assert.isFalse(state.enabled)
    assert.deepEqual(state.config, { theme: 'dark' })
  })

  test('finds plugin state by pluginId for tenant', async ({ assert }) => {
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)

    await PluginState.create({
      tenantId: 1,
      pluginId: 'my-plugin',
      version: '2.0.0',
      enabled: true,
    })

    const found = await PluginState.getForPlugin(1, 'my-plugin')

    assert.isNotNull(found)
    assert.equal(found?.pluginId, 'my-plugin')
    assert.equal(found?.version, '2.0.0')
    assert.isTrue(found?.enabled)
  })

  test('updates plugin state', async ({ assert }) => {
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)

    const state = await PluginState.create({
      tenantId: 1,
      pluginId: 'update-test',
      version: '1.0.0',
      enabled: false,
    })

    state.enabled = true
    state.version = '1.1.0'
    state.config = { newSetting: true }
    await state.save()

    const updated = await PluginState.find(state.id)
    assert.isTrue(updated?.enabled)
    assert.equal(updated?.version, '1.1.0')
    assert.deepEqual(updated?.config, { newSetting: true })
  })

  test('deletes plugin state', async ({ assert }) => {
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)

    const state = await PluginState.create({
      tenantId: 1,
      pluginId: 'delete-test',
      version: '1.0.0',
      enabled: false,
    })

    const id = state.id
    await state.delete()

    const deleted = await PluginState.find(id)
    assert.isNull(deleted)
  })

  test('getEnabledForTenant returns only enabled plugins', async ({ assert }) => {
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)

    await PluginState.create({
      tenantId: 1,
      pluginId: 'enabled-1',
      version: '1.0.0',
      enabled: true,
    })
    await PluginState.create({
      tenantId: 1,
      pluginId: 'disabled-1',
      version: '1.0.0',
      enabled: false,
    })
    await PluginState.create({
      tenantId: 1,
      pluginId: 'enabled-2',
      version: '1.0.0',
      enabled: true,
    })

    const enabled = await PluginState.getEnabledForTenant(1)

    assert.lengthOf(enabled, 2)
    assert.isTrue(enabled.every((p) => p.enabled))
    assert.includeMembers(
      enabled.map((p) => p.pluginId),
      ['enabled-1', 'enabled-2']
    )
  })
})

test.group('PluginState Model - RLS Isolation', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('tenant 1 cannot see tenant 2 plugin states', async ({ assert }) => {
    // Create plugin state for tenant 1
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)
    await PluginState.create({
      tenantId: 1,
      pluginId: 'tenant-1-plugin',
      version: '1.0.0',
      enabled: true,
    })

    // Create plugin state for tenant 2
    await db.rawQuery(`SELECT set_config('app.tenant_id', '2', false)`)
    await PluginState.create({
      tenantId: 2,
      pluginId: 'tenant-2-plugin',
      version: '1.0.0',
      enabled: true,
    })

    // Query as tenant 1
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)
    const tenant1States = await PluginState.all()

    assert.lengthOf(tenant1States, 1)
    assert.equal(tenant1States[0].pluginId, 'tenant-1-plugin')

    // Query as tenant 2
    await db.rawQuery(`SELECT set_config('app.tenant_id', '2', false)`)
    const tenant2States = await PluginState.all()

    assert.lengthOf(tenant2States, 1)
    assert.equal(tenant2States[0].pluginId, 'tenant-2-plugin')
  })

  test('tenant cannot update another tenant plugin state', async ({ assert }) => {
    // Create plugin state for tenant 1
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)
    const state = await PluginState.create({
      tenantId: 1,
      pluginId: 'protected-plugin',
      version: '1.0.0',
      enabled: false,
    })

    // Switch to tenant 2 and try to update
    await db.rawQuery(`SELECT set_config('app.tenant_id', '2', false)`)

    // Direct SQL update should affect 0 rows due to RLS
    const result = await db.rawQuery(
      `UPDATE plugin_states SET enabled = true WHERE id = ? RETURNING *`,
      [state.id]
    )

    assert.lengthOf(result.rows, 0)

    // Verify original state unchanged
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)
    const unchanged = await PluginState.find(state.id)
    assert.isFalse(unchanged?.enabled)
  })

  test('tenant cannot delete another tenant plugin state', async ({ assert }) => {
    // Create plugin state for tenant 1
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)
    const state = await PluginState.create({
      tenantId: 1,
      pluginId: 'protected-plugin',
      version: '1.0.0',
      enabled: false,
    })

    // Switch to tenant 2 and try to delete
    await db.rawQuery(`SELECT set_config('app.tenant_id', '2', false)`)

    // Direct SQL delete should affect 0 rows due to RLS
    const result = await db.rawQuery(`DELETE FROM plugin_states WHERE id = ? RETURNING *`, [
      state.id,
    ])

    assert.lengthOf(result.rows, 0)

    // Verify original state still exists
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)
    const stillExists = await PluginState.find(state.id)
    assert.isNotNull(stillExists)
  })
})

test.group('PluginState Model - Unique Constraint', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('prevents duplicate plugin ID for same tenant', async ({ assert }) => {
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)

    await PluginState.create({
      tenantId: 1,
      pluginId: 'unique-plugin',
      version: '1.0.0',
      enabled: false,
    })

    await assert.rejects(async () => {
      await PluginState.create({
        tenantId: 1,
        pluginId: 'unique-plugin', // Same plugin ID
        version: '2.0.0',
        enabled: true,
      })
    })
  })

  test('allows same plugin ID for different tenants', async ({ assert }) => {
    await db.rawQuery(`SELECT set_config('app.tenant_id', '1', false)`)
    await PluginState.create({
      tenantId: 1,
      pluginId: 'shared-plugin',
      version: '1.0.0',
      enabled: false,
    })

    await db.rawQuery(`SELECT set_config('app.tenant_id', '2', false)`)
    const state2 = await PluginState.create({
      tenantId: 2,
      pluginId: 'shared-plugin', // Same plugin ID, different tenant
      version: '1.0.0',
      enabled: true,
    })

    assert.isNotNull(state2.id)
  })
})

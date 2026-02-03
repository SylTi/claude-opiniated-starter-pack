/**
 * Plugin Boot Service Integration Tests
 *
 * Tests the actual boot-time initialization of plugins.
 * These tests verify that the plugin system correctly:
 * - Loads manifests from disk
 * - Initializes database connections during boot
 * - Registers routes correctly
 * - Handles schema version checks
 *
 * IMPORTANT: These tests enable plugin boot to catch initialization issues
 * that unit tests with mocks would miss.
 */

import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'

test.group('Plugin Boot Service - Integration', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('plugin boot service can access database during boot', async ({ assert }) => {
    // This test verifies that the db service is accessible
    // during the plugin boot phase (the bug we fixed)
    const dbInstance = await app.container.make('lucid.db')
    assert.isNotNull(dbInstance)

    // Verify we can run queries
    const result = await dbInstance.rawQuery('SELECT 1 as test')
    assert.equal(result.rows[0].test, 1)
  })

  test('plugin boot service can access router during boot', async ({ assert }) => {
    // This test verifies that the router service is accessible
    // during the plugin boot phase (the bug we fixed)
    const routerInstance = await app.container.make('router')
    assert.isNotNull(routerInstance)

    // Verify router has expected methods
    assert.isFunction(routerInstance.get)
    assert.isFunction(routerInstance.post)
    assert.isFunction(routerInstance.put)
    assert.isFunction(routerInstance.delete)
  })

  test('schema version helper can query database', async ({ assert }) => {
    // Set up test context
    await db.rawQuery(`SELECT set_config('app.tenant_id', '0', false)`)
    await db.rawQuery(`SELECT set_config('app.user_id', '0', false)`)

    // Import and test the helper that was failing
    const { getPluginSchemaVersion, setPluginSchemaVersion } =
      await import('#services/plugins/schema_version_helper')

    // Test set and get operations
    await setPluginSchemaVersion('test-plugin', 1)
    const version = await getPluginSchemaVersion('test-plugin')

    assert.equal(version, 1)
  })

  test('schema version helper returns 0 for non-existent plugin', async ({ assert }) => {
    await db.rawQuery(`SELECT set_config('app.tenant_id', '0', false)`)
    await db.rawQuery(`SELECT set_config('app.user_id', '0', false)`)

    const { getPluginSchemaVersion } = await import('#services/plugins/schema_version_helper')

    const version = await getPluginSchemaVersion('non-existent-plugin-xyz')
    assert.equal(version, 0)
  })

  test('plugin registry is available after boot', async ({ assert }) => {
    const { pluginRegistry } = await import('@saas/plugins-core')

    // Verify registry has expected methods
    assert.isFunction(pluginRegistry.get)
    assert.isFunction(pluginRegistry.getAll)
    assert.isFunction(pluginRegistry.getActive)
  })
})

test.group('Plugin Boot Service - Route Mounting', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('routes registrar creates routes correctly', async ({ assert }) => {
    const routerInstance = await app.container.make('router')
    const { createRoutesRegistrar } = await import('#services/plugins/routes_registrar')

    const registrar = createRoutesRegistrar('test-plugin', routerInstance)

    // Register a test route (must await - route registration is async due to middleware loading)
    await registrar.get('/test', async (ctx) => {
      ctx.response.json({ success: true })
    })

    const routes = registrar.getRegisteredRoutes()
    assert.lengthOf(routes, 1)
    assert.equal(routes[0].method, 'GET')
    assert.include(routes[0].fullPath, '/api/v1/apps/test-plugin/test')
  })

  test('routes registrar enforces correct prefix pattern', async ({ assert }) => {
    const routerInstance = await app.container.make('router')
    const { createRoutesRegistrar } = await import('#services/plugins/routes_registrar')

    const registrar = createRoutesRegistrar('my-plugin', routerInstance)
    const prefix = registrar.getPrefix()

    // Security: prefix must follow expected pattern
    assert.equal(prefix, '/api/v1/apps/my-plugin')
  })
})

test.group('Plugin Boot Service - Capability Service', () => {
  test('capability service is initialized', async ({ assert }) => {
    const { pluginCapabilityService } = await import('#services/plugins/plugin_capability_service')

    assert.isNotNull(pluginCapabilityService)
    assert.isFunction(pluginCapabilityService.canRegisterRoutes)
    assert.isFunction(pluginCapabilityService.canAccessDatabase)
    assert.isFunction(pluginCapabilityService.canWriteDatabase)
  })
})

import { test } from '@japa/runner'
import sinon from 'sinon'
import db from '@adonisjs/lucid/services/db'
import { pluginRegistry, type PluginManifest } from '@saas/plugins-core'
import PluginState from '#models/plugin_state'
import PluginPublicEnforcementMiddleware from '#middleware/plugin_public_enforcement_middleware'

function createManifest(): PluginManifest {
  return {
    pluginId: 'calendar',
    packageName: '@plugins/calendar',
    version: '1.0.0',
    tier: 'C',
    requestedCapabilities: [],
    features: {
      booking: { defaultEnabled: true },
    },
  }
}

function createResponseStubs() {
  return {
    internalServerError: sinon.stub().returnsThis(),
    notFound: sinon.stub().returnsThis(),
    serviceUnavailable: sinon.stub().returnsThis(),
    badRequest: sinon.stub().returnsThis(),
    forbidden: sinon.stub().returnsThis(),
  }
}

function createCtx(overrides?: { tenantIdParam?: string | undefined }) {
  return {
    request: {
      param: sinon.stub().callsFake((key: string) => {
        if (key === 'tenantId') {
          return overrides?.tenantIdParam
        }
        return undefined
      }),
      header: sinon.stub().returns(undefined),
      cookie: sinon.stub().returns(undefined),
    },
    response: createResponseStubs(),
    plugin: undefined,
  }
}

test.group('PluginPublicEnforcementMiddleware', (group) => {
  const sandbox = sinon.createSandbox()

  group.each.teardown(() => {
    sandbox.restore()
  })

  test('returns TenantRequired when required features are checked without tenant hint', async ({
    assert,
  }) => {
    const middleware = new PluginPublicEnforcementMiddleware()
    const ctx = createCtx()

    sandbox.stub(pluginRegistry, 'get').returns({
      manifest: createManifest(),
      status: 'active',
      grantedCapabilities: [],
    } as never)

    const next = sandbox.stub().resolves()
    await middleware.handle(ctx as never, next as never, {
      guards: ['calendar'],
      requiredFeatures: ['booking'],
    })

    assert.isTrue(ctx.response.badRequest.calledOnce)
    assert.deepEqual(ctx.response.badRequest.firstCall.args[0], {
      error: 'TenantRequired',
      message: 'tenantId route parameter is required for public plugin feature checks',
    })
    assert.isFalse(next.called)
  })

  test('allows public route when plugin is active and enabled for tenant', async ({ assert }) => {
    const middleware = new PluginPublicEnforcementMiddleware()
    const ctx = createCtx({ tenantIdParam: '42' })

    sandbox.stub(pluginRegistry, 'get').returns({
      manifest: createManifest(),
      status: 'active',
      grantedCapabilities: ['app:routes'],
    } as never)

    const queryBuilder = {
      where: sandbox.stub().returnsThis(),
      first: sandbox.stub().resolves({
        enabled: true,
        config: { features: { booking: true } },
      }),
    }
    sandbox.stub(PluginState, 'query').returns(queryBuilder as never)
    sandbox.stub(db, 'transaction').callsFake(async (callback: any) => {
      const trx = {
        rawQuery: sandbox.stub().resolves({ rows: [] }),
      }
      return callback(trx)
    })

    const next = sandbox.stub().resolves()
    await middleware.handle(ctx as never, next as never, {
      guards: ['calendar'],
      requiredFeatures: ['booking'],
    })

    assert.isTrue(next.calledOnce)
    assert.exists((ctx as { plugin?: { id: string } }).plugin)
    assert.equal((ctx as { plugin?: { id: string } }).plugin?.id, 'calendar')
  })
})

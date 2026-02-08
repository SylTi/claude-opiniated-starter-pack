import { test } from '@japa/runner'
import sinon from 'sinon'
import { pluginRegistry, type PluginManifest } from '@saas/plugins-core'
import PluginEnforcementMiddleware from '#middleware/plugin_enforcement_middleware'
import PluginState from '#models/plugin_state'

function createManifest(): PluginManifest {
  return {
    pluginId: 'collab',
    packageName: '@plugins/collab',
    version: '1.0.0',
    tier: 'C',
    requestedCapabilities: [],
    features: {
      comments: { defaultEnabled: true },
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

function createCtx(config: Record<string, unknown> | null) {
  return {
    tenant: { id: 7 },
    tenantDb: { id: 'trx' },
    response: createResponseStubs(),
    plugin: undefined,
    pluginState: {
      enabled: true,
      config,
    },
  }
}

function stubPluginStateQuery(
  sandbox: sinon.SinonSandbox,
  pluginState: { enabled: boolean; config: Record<string, unknown> | null }
): void {
  const queryBuilder = {
    where: sandbox.stub().returnsThis(),
    first: sandbox.stub().resolves(pluginState),
  }
  sandbox.stub(PluginState, 'query').returns(queryBuilder as never)
}

test.group('PluginEnforcementMiddleware feature gates', (group) => {
  const sandbox = sinon.createSandbox()

  group.each.teardown(() => {
    sandbox.restore()
  })

  test('returns 403 E_FEATURE_DISABLED when required feature is disabled', async ({ assert }) => {
    const middleware = new PluginEnforcementMiddleware()
    const ctx = createCtx({
      features: {
        comments: false,
      },
    })

    sandbox.stub(pluginRegistry, 'get').returns({
      manifest: createManifest(),
      status: 'active',
      grantedCapabilities: [],
    } as never)
    stubPluginStateQuery(sandbox, ctx.pluginState)

    const next = sandbox.stub().resolves()

    await middleware.handle(ctx as never, next as never, {
      guards: ['collab'],
      requiredFeatures: ['comments'],
    })

    assert.isTrue(ctx.response.forbidden.calledOnce)
    assert.deepEqual(ctx.response.forbidden.firstCall.args[0], {
      error: 'E_FEATURE_DISABLED',
      message: 'Feature comments is disabled for this tenant',
    })
    assert.isFalse(next.called)
  })

  test('allows request when required feature is enabled', async ({ assert }) => {
    const middleware = new PluginEnforcementMiddleware()
    const ctx = createCtx(null)

    sandbox.stub(pluginRegistry, 'get').returns({
      manifest: createManifest(),
      status: 'active',
      grantedCapabilities: ['app:routes'],
    } as never)
    stubPluginStateQuery(sandbox, ctx.pluginState)

    const next = sandbox.stub().resolves()

    await middleware.handle(ctx as never, next as never, {
      guards: ['collab'],
      requiredFeatures: ['comments'],
    })

    assert.isTrue(next.calledOnce)
    assert.exists((ctx as { plugin?: { id: string } }).plugin)
    assert.equal((ctx as { plugin?: { id: string } }).plugin?.id, 'collab')
  })
})

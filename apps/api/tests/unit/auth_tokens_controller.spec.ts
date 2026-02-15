import { test } from '@japa/runner'
import sinon from 'sinon'
import AuthTokensController from '#controllers/auth_tokens_controller'
import {
  authTokenService,
  AuthTokenPolicyViolationError,
} from '#services/auth_tokens/auth_token_service'
import { serverPluginManifests } from '@saas/config/plugins/server'
import type { ManifestLoader } from '@saas/config/plugins/server'
import type { PluginManifest } from '@saas/plugins-core'
import Tenant from '#models/tenant'
import { tenantQuotaService } from '#services/tenant_quota_service'

test.group('AuthTokensController', (group) => {
  const sandbox = sinon.createSandbox()
  const manifest: PluginManifest = {
    pluginId: 'notarium',
    packageName: '@plugins/notarium',
    version: '1.0.0',
    tier: 'main-app',
    requestedCapabilities: [],
    authTokens: {
      kinds: [
        {
          id: 'integration',
          title: 'MCP tokens',
          scopes: [{ id: 'mcp:read', label: 'Read' }],
        },
        {
          id: 'browser_ext',
          title: 'Browser extension tokens',
          scopes: [{ id: 'browser:clip_bookmark', label: 'Create bookmarks' }],
        },
      ],
    },
  }

  let originalManifestLoader: ManifestLoader | undefined

  group.each.setup(() => {
    // ESM exports are read-only, so we inject the test manifest into the
    // mutable serverPluginManifests record that loadPluginManifest reads from.
    originalManifestLoader = serverPluginManifests['notarium']
    serverPluginManifests['notarium'] = async () => manifest
  })

  group.each.teardown(() => {
    sandbox.restore()
    if (originalManifestLoader !== undefined) {
      serverPluginManifests['notarium'] = originalManifestLoader
    } else {
      delete serverPluginManifests['notarium']
    }
  })

  function createMockContext(options?: {
    inputs?: Record<string, unknown>
    body?: Record<string, unknown>
    params?: Record<string, string>
    role?: string
  }) {
    const inputs = options?.inputs ?? {}
    const body = options?.body ?? {}
    const role = options?.role ?? 'member'
    return {
      request: {
        input: sandbox.stub().callsFake((key: string) => inputs[key]),
        validateUsing: sandbox.stub().resolves(body),
        ip: sandbox.stub().returns('127.0.0.1'),
        header: sandbox.stub().returns(null),
      },
      auth: {
        user: {
          id: 42,
        },
      },
      tenant: {
        id: 7,
        membership: {
          role,
        },
      },
      params: options?.params ?? {},
      response: {
        json: sandbox.stub().returnsThis(),
        created: sandbox.stub().returnsThis(),
        badRequest: sandbox.stub().returnsThis(),
        notFound: sandbox.stub().returnsThis(),
        forbidden: sandbox.stub().returnsThis(),
      },
    }
  }

  function stubQuotaChecksPass(): void {
    sandbox.stub(Tenant, 'find').resolves({ id: 7 } as Tenant)
    sandbox.stub(tenantQuotaService, 'getSnapshot').resolves({
      members: { limit: null, used: 1, remaining: null, exceeded: false },
      pendingInvitations: { limit: null, used: 0, remaining: null, exceeded: false },
      authTokensPerTenant: { limit: 10, used: 0, remaining: 10, exceeded: false },
      authTokensPerUser: { limit: 10, used: 0, remaining: 10, exceeded: false },
    })
  }

  test('index returns 400 when pluginId is missing', async ({ assert }) => {
    const ctx = createMockContext()
    const controller = new AuthTokensController()

    await controller.index(ctx as never)

    assert.isTrue(ctx.response.badRequest.calledOnce)
    assert.equal(
      ctx.response.badRequest.firstCall.args[0].message,
      'pluginId query parameter is required'
    )
  })

  test('index lists tokens for tenant and plugin', async ({ assert }) => {
    const listStub = sandbox.stub(authTokenService, 'listTokens').resolves([
      {
        id: 'token-1',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:read'],
        metadata: null,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
    ])

    const ctx = createMockContext({
      inputs: { pluginId: 'notarium', kind: 'integration' },
    })
    const controller = new AuthTokensController()

    await controller.index(ctx as never)

    assert.isTrue(
      listStub.calledWith({
        tenantId: 7,
        pluginId: 'notarium',
        kind: 'integration',
        userId: 42,
        actorUserId: 42,
      })
    )
    assert.isTrue(ctx.response.json.calledOnce)
    assert.lengthOf(ctx.response.json.firstCall.args[0].data, 1)
  })

  test('store creates token for current tenant and user', async ({ assert }) => {
    const createdPayload = {
      token: {
        id: 'token-1',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:read'],
        metadata: null,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
      tokenValue: 'secret-token',
    }
    const createStub = sandbox.stub(authTokenService, 'createToken').resolves(createdPayload)

    const ctx = createMockContext({
      body: {
        pluginId: 'notarium',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:read'],
      },
    })
    stubQuotaChecksPass()
    const controller = new AuthTokensController()

    await controller.store(ctx as never)

    assert.isTrue(
      createStub.calledWith({
        tenantId: 7,
        userId: 42,
        actorUserId: 42,
        pluginId: 'notarium',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:read'],
        expiresAt: null,
        requestIp: '127.0.0.1',
        requestUserAgent: null,
      })
    )
    assert.isTrue(ctx.response.created.calledOnce)
    assert.equal(ctx.response.created.firstCall.args[0].data.tokenValue, 'secret-token')
  })

  test('store rejects scopes outside allowlist', async ({ assert }) => {
    const createStub = sandbox.stub(authTokenService, 'createToken').resolves({
      token: {
        id: 'token-1',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:read'],
        metadata: null,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
      tokenValue: 'secret-token',
    })

    const ctx = createMockContext({
      body: {
        pluginId: 'notarium',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:unknown'],
      },
    })
    stubQuotaChecksPass()
    const controller = new AuthTokensController()

    await controller.store(ctx as never)

    assert.isTrue(ctx.response.badRequest.calledOnce)
    assert.isTrue(createStub.notCalled)
  })

  test('store returns 400 when tenant auth token quota is reached', async ({ assert }) => {
    const createStub = sandbox.stub(authTokenService, 'createToken').resolves({
      token: {
        id: 'token-1',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:read'],
        metadata: null,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
      tokenValue: 'secret-token',
    })

    sandbox.stub(Tenant, 'find').resolves({ id: 7 } as Tenant)
    sandbox.stub(tenantQuotaService, 'getSnapshot').resolves({
      members: { limit: null, used: 1, remaining: null, exceeded: false },
      pendingInvitations: { limit: null, used: 0, remaining: null, exceeded: false },
      authTokensPerTenant: { limit: 1, used: 1, remaining: 0, exceeded: false },
      authTokensPerUser: { limit: 10, used: 0, remaining: 10, exceeded: false },
    })

    const ctx = createMockContext({
      body: {
        pluginId: 'notarium',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:read'],
      },
    })
    const controller = new AuthTokensController()

    await controller.store(ctx as never)

    assert.isTrue(ctx.response.badRequest.calledOnce)
    assert.equal(ctx.response.badRequest.firstCall.args[0].error, 'LimitReached')
    assert.isTrue(createStub.notCalled)
  })

  test('store returns 400 on invalid expiration date', async ({ assert }) => {
    sandbox
      .stub(authTokenService, 'createToken')
      .rejects(new Error('Invalid expiration date format. Use ISO 8601 format.'))

    const ctx = createMockContext({
      body: {
        pluginId: 'notarium',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:read'],
        expiresAt: 'bad-date',
      },
    })
    stubQuotaChecksPass()
    const controller = new AuthTokensController()

    await controller.store(ctx as never)

    assert.isTrue(ctx.response.badRequest.calledOnce)
  })

  test('store returns 403 when policy blocks issuance', async ({ assert }) => {
    sandbox
      .stub(authTokenService, 'createToken')
      .rejects(
        new AuthTokenPolicyViolationError(
          'admin_only_issuance',
          'Only tenant admins can issue auth tokens under current policy'
        )
      )

    const ctx = createMockContext({
      body: {
        pluginId: 'notarium',
        kind: 'integration',
        name: 'Claude',
        scopes: ['mcp:read'],
      },
    })
    stubQuotaChecksPass()
    const controller = new AuthTokensController()

    await controller.store(ctx as never)

    assert.isTrue(ctx.response.forbidden.calledOnce)
    assert.equal(ctx.response.forbidden.firstCall.args[0].error, 'PolicyViolation')
  })

  test('destroy returns 404 when token does not exist', async ({ assert }) => {
    sandbox.stub(authTokenService, 'revokeToken').resolves(false)
    const ctx = createMockContext({
      inputs: { pluginId: 'notarium', kind: 'integration' },
      params: { id: 'token-1' },
    })
    const controller = new AuthTokensController()

    await controller.destroy(ctx as never)

    assert.isTrue(ctx.response.notFound.calledOnce)
    assert.equal(ctx.response.notFound.firstCall.args[0].message, 'Token not found')
  })

  test('index rejects unknown token kind', async ({ assert }) => {
    const ctx = createMockContext({
      inputs: { pluginId: 'notarium', kind: 'unknown' },
    })
    const controller = new AuthTokensController()

    await controller.index(ctx as never)

    assert.isTrue(ctx.response.badRequest.calledOnce)
    assert.equal(ctx.response.badRequest.firstCall.args[0].message, 'Unknown token kind "unknown"')
  })

  test('destroy revokes token and returns success payload', async ({ assert }) => {
    const revokeStub = sandbox.stub(authTokenService, 'revokeToken').resolves(true)
    const ctx = createMockContext({
      inputs: { pluginId: 'notarium', kind: 'browser_ext' },
      params: { id: 'token-2' },
    })
    const controller = new AuthTokensController()

    await controller.destroy(ctx as never)

    assert.isTrue(
      revokeStub.calledWith({
        tenantId: 7,
        pluginId: 'notarium',
        tokenId: 'token-2',
        kind: 'browser_ext',
        userId: 42,
        actorUserId: 42,
      })
    )
    assert.isTrue(ctx.response.json.calledOnce)
    assert.equal(ctx.response.json.firstCall.args[0].data.id, 'token-2')
  })
})

import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Tenant from '#models/tenant'
import AuthTokenService from '#services/auth_tokens/auth_token_service'
import { systemOps } from '#services/system_operation_service'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

async function createTenantUser(): Promise<{ user: User; tenant: Tenant }> {
  const id = uniqueId()
  const user = await User.create({
    email: `token-${id}@example.com`,
    password: 'password123',
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
  })

  const tenant = await systemOps.withSystemContext(async (trx) => {
    return Tenant.create(
      {
        name: `Tenant ${id}`,
        slug: `tenant-${id}`,
        type: 'personal',
        ownerId: user.id,
        balance: 0,
        balanceCurrency: 'usd',
      },
      { client: trx }
    )
  })

  user.currentTenantId = tenant.id
  await user.save()

  return { user, tenant }
}

test.group('AuthTokenService', (group) => {
  const service = new AuthTokenService()

  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('createToken stores hash and returns plaintext once', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()

    const result = await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Primary MCP',
      scopes: ['mcp:read'],
    })

    assert.equal(result.token.name, 'Primary MCP')
    assert.equal(result.token.kind, 'integration')
    assert.equal(result.token.scopes[0], 'mcp:read')
    assert.equal(result.tokenValue.length, 64)

    const row = await db
      .connection('postgres')
      .from('auth_tokens')
      .where('id', result.token.id)
      .first()
    assert.exists(row)
    assert.notEqual(row.token_hash, result.tokenValue)
    assert.equal(row.token_hash, service.hashToken(result.tokenValue))
  })

  test('listTokens filters by plugin and kind', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()

    await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Integration',
      scopes: ['mcp:read'],
    })
    await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      pluginId: 'notarium',
      kind: 'browser_ext',
      name: 'Browser',
      scopes: ['browser:read'],
    })
    await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      pluginId: 'another-plugin',
      kind: 'integration',
      name: 'Other Plugin',
      scopes: ['read'],
    })

    const tokens = await service.listTokens({
      tenantId: tenant.id,
      pluginId: 'notarium',
      kind: 'integration',
    })

    assert.lengthOf(tokens, 1)
    assert.equal(tokens[0].name, 'Integration')
    assert.equal(tokens[0].kind, 'integration')
  })

  test('listTokens filters by userId when provided', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()
    const otherUser = await User.create({
      email: `other-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'User token',
      scopes: ['mcp:read'],
    })
    await service.createToken({
      tenantId: tenant.id,
      userId: otherUser.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Other token',
      scopes: ['mcp:read'],
    })

    const tokens = await service.listTokens({
      tenantId: tenant.id,
      pluginId: 'notarium',
      userId: user.id,
    })

    assert.lengthOf(tokens, 1)
    assert.equal(tokens[0].name, 'User token')
  })

  test('revokeToken removes token only for matching plugin and tenant', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()

    const created = await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'To revoke',
      scopes: ['mcp:read'],
    })

    const wrongPlugin = await service.revokeToken({
      tenantId: tenant.id,
      pluginId: 'other',
      tokenId: created.token.id,
      kind: 'integration',
    })
    assert.isFalse(wrongPlugin)

    const revoked = await service.revokeToken({
      tenantId: tenant.id,
      pluginId: 'notarium',
      tokenId: created.token.id,
      kind: 'integration',
    })
    assert.isTrue(revoked)
  })

  test('revokeToken respects userId filter', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()
    const otherUser = await User.create({
      email: `other-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    const created = await service.createToken({
      tenantId: tenant.id,
      userId: otherUser.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Other user token',
      scopes: ['mcp:read'],
    })

    const revoked = await service.revokeToken({
      tenantId: tenant.id,
      pluginId: 'notarium',
      tokenId: created.token.id,
      kind: 'integration',
      userId: user.id,
    })

    assert.isFalse(revoked)
  })

  test('validateToken returns valid result and enforces required scopes', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()

    const created = await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Validator',
      scopes: ['mcp:read', 'mcp:bookmark_write'],
    })

    const valid = await service.validateToken({
      pluginId: 'notarium',
      kind: 'integration',
      tokenValue: created.tokenValue,
      requiredScopes: ['mcp:read'],
    })

    assert.isTrue(valid.valid)
    if (valid.valid) {
      assert.equal(valid.tenantId, tenant.id)
      assert.equal(valid.userId, user.id)
    }

    const invalidScope = await service.validateToken({
      pluginId: 'notarium',
      kind: 'integration',
      tokenValue: created.tokenValue,
      requiredScopes: ['mcp:meeting_note_draft_write'],
    })
    assert.isFalse(invalidScope.valid)
  })

  test('validateToken rejects expired tokens', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()

    const created = await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Expired',
      scopes: ['mcp:read'],
      expiresAt: new Date(Date.now() - 3600_000).toISOString(),
    })

    const result = await service.validateToken({
      pluginId: 'notarium',
      kind: 'integration',
      tokenValue: created.tokenValue,
    })

    assert.isFalse(result.valid)
    if (!result.valid) {
      assert.equal(result.error, 'Token has expired')
    }
  })
})

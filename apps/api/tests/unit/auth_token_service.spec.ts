import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import AuthTokenService, {
  AuthTokenPolicyViolationError,
} from '#services/auth_tokens/auth_token_service'
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

  await systemOps.withSystemContext(async (trx) => {
    await TenantMembership.create(
      {
        tenantId: tenant.id,
        userId: user.id,
        role: 'owner',
      },
      { client: trx }
    )
  })

  return { user, tenant }
}

async function createTenantMember(tenantId: number): Promise<User> {
  const user = await User.create({
    email: `member-${uniqueId()}@example.com`,
    password: 'password123',
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
  })

  await systemOps.withSystemContext(async (trx) => {
    await TenantMembership.create(
      {
        tenantId,
        userId: user.id,
        role: 'member',
      },
      { client: trx }
    )
  })

  return user
}

async function addTenantMember(
  tenantId: number,
  userId: number,
  role: 'owner' | 'admin' | 'member' = 'member'
): Promise<void> {
  await systemOps.withSystemContext(async (trx) => {
    await TenantMembership.create(
      {
        tenantId,
        userId,
        role,
      },
      { client: trx }
    )
  })
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
      actorUserId: user.id,
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

  test('createToken enforces tenant auth token quota overrides', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()

    await systemOps.withSystemContext(async (trx) => {
      const managedTenant = await Tenant.findOrFail(tenant.id, { client: trx })
      managedTenant.quotaOverrides = {
        maxAuthTokensPerTenant: 1,
        maxAuthTokensPerUser: 1,
      }
      managedTenant.useTransaction(trx)
      await managedTenant.save()
    })

    await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      actorUserId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'First token',
      scopes: ['mcp:read'],
    })

    try {
      await service.createToken({
        tenantId: tenant.id,
        userId: user.id,
        actorUserId: user.id,
        pluginId: 'notarium',
        kind: 'integration',
        name: 'Second token',
        scopes: ['mcp:read'],
      })
      assert.fail('Expected createToken to fail when tenant auth token quota is reached')
    } catch (error) {
      assert.instanceOf(error, AuthTokenPolicyViolationError)
      assert.equal((error as AuthTokenPolicyViolationError).rule, 'tenant_auth_token_quota')
    }
  })

  test('listTokens filters by plugin and kind', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()

    await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      actorUserId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Integration',
      scopes: ['mcp:read'],
    })
    await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      actorUserId: user.id,
      pluginId: 'notarium',
      kind: 'browser_ext',
      name: 'Browser',
      scopes: ['browser:read'],
    })
    await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      actorUserId: user.id,
      pluginId: 'another-plugin',
      kind: 'integration',
      name: 'Other Plugin',
      scopes: ['read'],
    })

    const tokens = await service.listTokens({
      tenantId: tenant.id,
      pluginId: 'notarium',
      kind: 'integration',
      actorUserId: user.id,
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
    await addTenantMember(tenant.id, otherUser.id)

    await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      actorUserId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'User token',
      scopes: ['mcp:read'],
    })
    await service.createToken({
      tenantId: tenant.id,
      userId: otherUser.id,
      actorUserId: otherUser.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Other token',
      scopes: ['mcp:read'],
    })

    const tokens = await service.listTokens({
      tenantId: tenant.id,
      pluginId: 'notarium',
      userId: user.id,
      actorUserId: user.id,
    })

    assert.lengthOf(tokens, 1)
    assert.equal(tokens[0].name, 'User token')
  })

  test('listTokens rejects non-admin actor querying another user', async ({ assert }) => {
    const { user: owner, tenant } = await createTenantUser()
    const member = await createTenantMember(tenant.id)

    await service.createToken({
      tenantId: tenant.id,
      userId: owner.id,
      actorUserId: owner.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Owner token',
      scopes: ['mcp:read'],
    })

    await assert.rejects(
      () =>
        service.listTokens({
          tenantId: tenant.id,
          pluginId: 'notarium',
          userId: owner.id,
          actorUserId: member.id,
        }),
      'Forbidden: cannot manage auth tokens for another user'
    )
  })

  test('listTokens rejects non-admin actor querying all users', async ({ assert }) => {
    const { tenant } = await createTenantUser()
    const member = await createTenantMember(tenant.id)

    await assert.rejects(
      () =>
        service.listTokens({
          tenantId: tenant.id,
          pluginId: 'notarium',
          actorUserId: member.id,
        }),
      'Forbidden: cannot manage auth tokens for another user'
    )
  })

  test('revokeToken removes token only for matching plugin and tenant', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()

    const created = await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      actorUserId: user.id,
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
      actorUserId: user.id,
    })
    assert.isFalse(wrongPlugin)

    const revoked = await service.revokeToken({
      tenantId: tenant.id,
      pluginId: 'notarium',
      tokenId: created.token.id,
      kind: 'integration',
      actorUserId: user.id,
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
    await addTenantMember(tenant.id, otherUser.id)

    const created = await service.createToken({
      tenantId: tenant.id,
      userId: otherUser.id,
      actorUserId: otherUser.id,
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
      actorUserId: user.id,
    })

    assert.isFalse(revoked)
  })

  test('revokeToken rejects non-admin actor revoking another user token', async ({ assert }) => {
    const { user: owner, tenant } = await createTenantUser()
    const member = await createTenantMember(tenant.id)

    const created = await service.createToken({
      tenantId: tenant.id,
      userId: owner.id,
      actorUserId: owner.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Owner token',
      scopes: ['mcp:read'],
    })

    await assert.rejects(
      () =>
        service.revokeToken({
          tenantId: tenant.id,
          pluginId: 'notarium',
          tokenId: created.token.id,
          kind: 'integration',
          userId: owner.id,
          actorUserId: member.id,
        }),
      'Forbidden: cannot manage auth tokens for another user'
    )
  })

  test('validateToken returns valid result and enforces required scopes', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()

    const created = await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      actorUserId: user.id,
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
      actorUserId: user.id,
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

  test('validateToken rejects token when expected tenant does not match', async ({ assert }) => {
    const { user, tenant } = await createTenantUser()
    const { tenant: otherTenant } = await createTenantUser()

    const created = await service.createToken({
      tenantId: tenant.id,
      userId: user.id,
      actorUserId: user.id,
      pluginId: 'notarium',
      kind: 'integration',
      name: 'Tenant-bound',
      scopes: ['mcp:read'],
    })

    const result = await service.validateToken({
      pluginId: 'notarium',
      kind: 'integration',
      tokenValue: created.tokenValue,
      expectedTenantId: otherTenant.id,
    })

    assert.isFalse(result.valid)
    if (!result.valid) {
      assert.equal(result.error, 'Token not found')
    }
  })

  test('createToken rejects non-member token owner', async ({ assert }) => {
    const { user: owner, tenant } = await createTenantUser()
    const outsider = await User.create({
      email: `outsider-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await assert.rejects(
      () =>
        service.createToken({
          tenantId: tenant.id,
          userId: outsider.id,
          actorUserId: owner.id,
          pluginId: 'notarium',
          kind: 'integration',
          name: 'Outsider token',
          scopes: ['mcp:read'],
        }),
      'Token owner must be an active tenant member'
    )
  })
})

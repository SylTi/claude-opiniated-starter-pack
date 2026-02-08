import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Tenant from '#models/tenant'
import PluginPermissionGrantService from '#services/plugins/plugin_permission_grant_service'
import { systemOps } from '#services/system_operation_service'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

async function createTenantOwner(): Promise<{ owner: User; tenant: Tenant }> {
  const id = uniqueId()
  const owner = await User.create({
    email: `grants-owner-${id}@example.com`,
    password: 'password123',
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
  })

  const tenant = await systemOps.withSystemContext(async (trx) => {
    return Tenant.create(
      {
        name: `Grants Tenant ${id}`,
        slug: `grants-tenant-${id}`,
        type: 'personal',
        ownerId: owner.id,
        balance: 0,
        balanceCurrency: 'usd',
      },
      { client: trx }
    )
  })

  owner.currentTenantId = tenant.id
  await owner.save()

  return { owner, tenant }
}

test.group('PluginPermissionGrantService', (group) => {
  const service = new PluginPermissionGrantService()

  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('upsertGrant persists and hasGrant returns true', async ({ assert }) => {
    const { owner, tenant } = await createTenantOwner()
    const targetUser = await User.create({
      email: `grants-target-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        await service.upsertGrant(
          {
            tenantId: tenant.id,
            pluginId: 'collab',
            userId: targetUser.id,
            ability: 'collab.share.read',
            resourceType: 'note',
            resourceId: 42,
            grantedBy: owner.id,
          },
          trx
        )

        const hasGrant = await service.hasGrant(
          {
            tenantId: tenant.id,
            pluginId: 'collab',
            userId: targetUser.id,
            ability: 'collab.share.read',
            resourceType: 'note',
            resourceId: 42,
          },
          trx
        )
        assert.isTrue(hasGrant)
      },
      owner.id
    )

    const row = await db
      .connection('postgres')
      .from('plugin_permission_grants')
      .where('tenant_id', tenant.id)
      .where('plugin_id', 'collab')
      .where('user_id', targetUser.id)
      .first()

    assert.exists(row)
    assert.equal(row.resource_id, '42')
    assert.equal(row.granted_by, owner.id)
  })

  test('upsertGrant is idempotent for same scope and updates granted_by', async ({ assert }) => {
    const { owner, tenant } = await createTenantOwner()
    const targetUser = await User.create({
      email: `grants-target-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })
    const secondGranter = await User.create({
      email: `grants-granter-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const input = {
          tenantId: tenant.id,
          pluginId: 'collab',
          userId: targetUser.id,
          ability: 'collab.share.read',
          resourceType: 'note',
          resourceId: 'abc-123',
        }

        await service.upsertGrant(
          {
            ...input,
            grantedBy: owner.id,
          },
          trx
        )
        await service.upsertGrant(
          {
            ...input,
            grantedBy: secondGranter.id,
          },
          trx
        )
      },
      owner.id
    )

    const rows = await db
      .connection('postgres')
      .from('plugin_permission_grants')
      .where('tenant_id', tenant.id)
      .where('plugin_id', 'collab')
      .where('user_id', targetUser.id)
      .where('ability', 'collab.share.read')
      .where('resource_type', 'note')
      .where('resource_id', 'abc-123')

    assert.lengthOf(rows, 1)
    assert.equal(rows[0].granted_by, secondGranter.id)
  })

  test('revokeGrant removes existing grant and returns false when missing', async ({ assert }) => {
    const { owner, tenant } = await createTenantOwner()
    const targetUser = await User.create({
      email: `grants-target-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const scope = {
          tenantId: tenant.id,
          pluginId: 'collab',
          userId: targetUser.id,
          ability: 'collab.share.read',
          resourceType: 'note',
          resourceId: 99,
        }

        await service.upsertGrant(
          {
            ...scope,
            grantedBy: owner.id,
          },
          trx
        )

        const removed = await service.revokeGrant(scope, trx)
        assert.isTrue(removed)

        const hasGrant = await service.hasGrant(scope, trx)
        assert.isFalse(hasGrant)

        const removedAgain = await service.revokeGrant(scope, trx)
        assert.isFalse(removedAgain)
      },
      owner.id
    )
  })
})

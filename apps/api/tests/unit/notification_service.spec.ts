import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import NotificationService from '#services/notifications/notification_service'
import { systemOps } from '#services/system_operation_service'
import { truncateAllTables } from '../bootstrap.js'

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

async function createTenantMember(): Promise<{ user: User; tenant: Tenant }> {
  const id = uniqueId()
  const user = await User.create({
    email: `notif-${id}@example.com`,
    password: 'password123',
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
  })

  const tenant = await systemOps.withSystemContext(async (trx) => {
    return Tenant.create(
      {
        name: `Notif Tenant ${id}`,
        slug: `notif-tenant-${id}`,
        type: 'personal',
        ownerId: user.id,
        balance: 0,
        balanceCurrency: 'usd',
      },
      { client: trx }
    )
  })

  await TenantMembership.create({
    userId: user.id,
    tenantId: tenant.id,
    role: 'owner',
  })

  user.currentTenantId = tenant.id
  await user.save()

  return { user, tenant }
}

test.group('NotificationService', (group) => {
  const service = new NotificationService()

  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('send creates a tenant-scoped notification row', async ({ assert }) => {
    const { user, tenant } = await createTenantMember()

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        await service.send(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            pluginId: 'collab',
            type: 'collab.mention',
            title: 'Mentioned in a comment',
            body: 'You were mentioned',
            url: '/apps/collab/comments/12',
            meta: { commentId: 12 },
          },
          trx
        )
      },
      user.id
    )

    const row = await db
      .connection('postgres')
      .from('notifications')
      .where('tenant_id', tenant.id)
      .first()
    assert.exists(row)
    assert.equal(row.recipient_id, user.id)
    assert.equal(row.plugin_id, 'collab')
    assert.equal(row.type, 'collab.mention')
    assert.equal(row.title, 'Mentioned in a comment')
  })

  test('sendBatch creates multiple notification rows', async ({ assert }) => {
    const { user, tenant } = await createTenantMember()

    const otherUser = await User.create({
      email: `notif-other-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await TenantMembership.create({
      userId: otherUser.id,
      tenantId: tenant.id,
      role: 'member',
    })

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        await service.sendBatch(
          [
            {
              tenantId: tenant.id,
              recipientId: user.id,
              pluginId: 'collab',
              type: 'collab.comment',
              title: 'New comment',
            },
            {
              tenantId: tenant.id,
              recipientId: otherUser.id,
              pluginId: 'collab',
              type: 'collab.mention',
              title: 'New mention',
              meta: { noteId: 9 },
            },
          ],
          trx
        )
      },
      user.id
    )

    const rows = await db.connection('postgres').from('notifications').where('tenant_id', tenant.id)
    assert.lengthOf(rows, 2)
  })

  test('listForRecipient returns only recipient notifications with filters', async ({ assert }) => {
    const { user, tenant } = await createTenantMember()

    const otherUser = await User.create({
      email: `notif-list-other-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await TenantMembership.create({
      userId: otherUser.id,
      tenantId: tenant.id,
      role: 'member',
    })

    let firstId = 0
    let secondId = 0
    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const first = await service.send(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'First',
          },
          trx
        )
        firstId = first.id

        const second = await service.send(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            pluginId: 'collab',
            type: 'collab.mention',
            title: 'Second',
          },
          trx
        )
        secondId = second.id

        const third = await service.send(
          {
            tenantId: tenant.id,
            recipientId: otherUser.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Other user',
          },
          trx
        )
        third.readAt = third.createdAt
        await third.save()
      },
      user.id
    )

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const results = await service.listForRecipient(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            unreadOnly: true,
            beforeId: secondId + 1,
            limit: 10,
          },
          trx
        )

        assert.lengthOf(results, 2)
        assert.equal(results[0].id, secondId)
        assert.equal(results[1].id, firstId)
      },
      user.id
    )
  })

  test('findForRecipient and markAsRead enforce recipient scope', async ({ assert }) => {
    const { user, tenant } = await createTenantMember()

    const otherUser = await User.create({
      email: `notif-scope-other-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await TenantMembership.create({
      userId: otherUser.id,
      tenantId: tenant.id,
      role: 'member',
    })

    let notificationId = 0
    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const notification = await service.send(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            pluginId: 'collab',
            type: 'collab.mention',
            title: 'Scope test',
          },
          trx
        )
        notificationId = notification.id
      },
      user.id
    )

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const deniedLookup = await service.findForRecipient(
          notificationId,
          {
            tenantId: tenant.id,
            recipientId: otherUser.id,
          },
          trx
        )
        assert.isNull(deniedLookup)

        const updated = await service.markAsRead(
          notificationId,
          {
            tenantId: tenant.id,
            recipientId: user.id,
          },
          trx
        )
        assert.exists(updated)
        assert.exists(updated!.readAt)
      },
      user.id
    )
  })

  test('countUnreadForRecipient returns unread count for scoped recipient', async ({ assert }) => {
    const { user, tenant } = await createTenantMember()
    const otherUser = await User.create({
      email: `notif-count-other-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await TenantMembership.create({
      userId: otherUser.id,
      tenantId: tenant.id,
      role: 'member',
    })

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        await service.send(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            type: 'collab.comment',
            title: 'Unread A',
          },
          trx
        )
        const read = await service.send(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            type: 'collab.comment',
            title: 'Read B',
          },
          trx
        )
        read.readAt = read.createdAt
        await read.save()

        await service.send(
          {
            tenantId: tenant.id,
            recipientId: otherUser.id,
            type: 'collab.comment',
            title: 'Other recipient',
          },
          trx
        )
      },
      user.id
    )

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const unreadCount = await service.countUnreadForRecipient(
          {
            tenantId: tenant.id,
            recipientId: user.id,
          },
          trx
        )
        assert.equal(unreadCount, 1)
      },
      user.id
    )
  })

  test('markAllAsRead marks only unread notifications for recipient and returns count', async ({
    assert,
  }) => {
    const { user, tenant } = await createTenantMember()
    const otherUser = await User.create({
      email: `notif-markall-other-${uniqueId()}@example.com`,
      password: 'password123',
      role: 'user',
      emailVerified: true,
      mfaEnabled: false,
    })

    await TenantMembership.create({
      userId: otherUser.id,
      tenantId: tenant.id,
      role: 'member',
    })

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        await service.send(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            type: 'collab.comment',
            title: 'Unread 1',
          },
          trx
        )
        await service.send(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            type: 'collab.comment',
            title: 'Unread 2',
          },
          trx
        )
        const alreadyRead = await service.send(
          {
            tenantId: tenant.id,
            recipientId: user.id,
            type: 'collab.comment',
            title: 'Already read',
          },
          trx
        )
        alreadyRead.readAt = alreadyRead.createdAt
        await alreadyRead.save()

        await service.send(
          {
            tenantId: tenant.id,
            recipientId: otherUser.id,
            type: 'collab.comment',
            title: 'Other recipient unread',
          },
          trx
        )
      },
      user.id
    )

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const updatedCount = await service.markAllAsRead(
          {
            tenantId: tenant.id,
            recipientId: user.id,
          },
          trx
        )
        assert.equal(updatedCount, 2)

        const unreadCount = await service.countUnreadForRecipient(
          {
            tenantId: tenant.id,
            recipientId: user.id,
          },
          trx
        )
        assert.equal(unreadCount, 0)

        const otherUnreadCount = await service.countUnreadForRecipient(
          {
            tenantId: tenant.id,
            recipientId: otherUser.id,
          },
          trx
        )
        assert.equal(otherUnreadCount, 1)
      },
      user.id
    )
  })
})

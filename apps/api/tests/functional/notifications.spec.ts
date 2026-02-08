import { test } from '@japa/runner'
import request from 'supertest'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Tenant from '#models/tenant'
import TenantMembership from '#models/tenant_membership'
import { TENANT_ROLES } from '#constants/roles'
import { notificationService } from '#services/notifications/notification_service'
import { systemOps } from '#services/system_operation_service'
import { truncateAllTables } from '../bootstrap.js'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

async function createUser(email: string, password = 'password123'): Promise<User> {
  return User.create({
    email,
    password,
    role: 'user',
    emailVerified: true,
    mfaEnabled: false,
  })
}

async function loginAndGetCookie(email: string, password: string): Promise<string[]> {
  const response = await request(BASE_URL)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .set('Accept', 'application/json')

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`)
  }

  const cookies = response.headers['set-cookie']
  return Array.isArray(cookies) ? cookies : []
}

async function createTenantWithOwner(owner: User): Promise<Tenant> {
  const tenant = await Tenant.create({
    name: `Notify Team ${uniqueId()}`,
    slug: `notify-team-${uniqueId()}`,
    type: 'team',
    ownerId: owner.id,
  })

  await TenantMembership.create({
    userId: owner.id,
    tenantId: tenant.id,
    role: TENANT_ROLES.OWNER,
  })

  owner.currentTenantId = tenant.id
  await owner.save()

  return tenant
}

test.group('Notifications API', (group) => {
  group.each.setup(async () => {
    await truncateAllTables()
  })

  test('notifications list requires authentication', async () => {
    await request(BASE_URL).get('/api/v1/notifications').expect(401)
  })

  test('list returns only the current user notifications in the tenant', async ({ assert }) => {
    const owner = await createUser(`owner-${uniqueId()}@example.com`)
    const member = await createUser(`member-${uniqueId()}@example.com`)
    const tenant = await createTenantWithOwner(owner)

    await TenantMembership.create({
      userId: member.id,
      tenantId: tenant.id,
      role: TENANT_ROLES.MEMBER,
    })

    const cookies = await loginAndGetCookie(owner.email, 'password123')

    let ownerNotificationId = 0
    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const ownerNotification = await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: owner.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Comment for owner',
          },
          trx
        )
        ownerNotificationId = ownerNotification.id

        await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: member.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Comment for member',
          },
          trx
        )
      },
      owner.id
    )

    const response = await request(BASE_URL)
      .get('/api/v1/notifications')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .expect(200)

    assert.lengthOf(response.body.data, 1)
    assert.equal(response.body.data[0].id, ownerNotificationId)
    assert.equal(response.body.data[0].recipientId, owner.id)
  })

  test('show returns 404 for another recipient notification', async () => {
    const owner = await createUser(`owner-show-${uniqueId()}@example.com`)
    const member = await createUser(`member-show-${uniqueId()}@example.com`)
    const tenant = await createTenantWithOwner(owner)

    await TenantMembership.create({
      userId: member.id,
      tenantId: tenant.id,
      role: TENANT_ROLES.MEMBER,
    })

    const cookies = await loginAndGetCookie(owner.email, 'password123')

    let memberNotificationId = 0
    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const memberNotification = await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: member.id,
            pluginId: 'collab',
            type: 'collab.mention',
            title: 'Mention for member',
          },
          trx
        )
        memberNotificationId = memberNotification.id
      },
      owner.id
    )

    await request(BASE_URL)
      .get(`/api/v1/notifications/${memberNotificationId}`)
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .expect(404)
  })

  test('mark read sets read_at for the notification', async ({ assert }) => {
    const owner = await createUser(`owner-read-${uniqueId()}@example.com`)
    const tenant = await createTenantWithOwner(owner)
    const cookies = await loginAndGetCookie(owner.email, 'password123')

    let notificationId = 0
    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        const notification = await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: owner.id,
            pluginId: 'collab',
            type: 'collab.mention',
            title: 'Mention for owner',
          },
          trx
        )
        notificationId = notification.id
      },
      owner.id
    )

    const response = await request(BASE_URL)
      .post(`/api/v1/notifications/${notificationId}/read`)
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .expect(200)

    assert.equal(response.body.message, 'Notification marked as read')
    assert.isString(response.body.data.readAt)

    const row = await db
      .connection('postgres')
      .from('notifications')
      .where('id', notificationId)
      .first()
    assert.exists(row?.read_at)
  })

  test('unread-count returns unread notifications count for current user', async ({ assert }) => {
    const owner = await createUser(`owner-count-${uniqueId()}@example.com`)
    const member = await createUser(`member-count-${uniqueId()}@example.com`)
    const tenant = await createTenantWithOwner(owner)
    const cookies = await loginAndGetCookie(owner.email, 'password123')

    await TenantMembership.create({
      userId: member.id,
      tenantId: tenant.id,
      role: TENANT_ROLES.MEMBER,
    })

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: owner.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Unread 1',
          },
          trx
        )
        await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: owner.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Unread 2',
          },
          trx
        )
        const read = await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: owner.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Read',
          },
          trx
        )
        read.readAt = read.createdAt
        await read.save()

        await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: member.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Other user unread',
          },
          trx
        )
      },
      owner.id
    )

    const response = await request(BASE_URL)
      .get('/api/v1/notifications/unread-count')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .expect(200)

    assert.equal(response.body.data.unreadCount, 2)
  })

  test('read-all marks only current user unread notifications', async ({ assert }) => {
    const owner = await createUser(`owner-readall-${uniqueId()}@example.com`)
    const member = await createUser(`member-readall-${uniqueId()}@example.com`)
    const tenant = await createTenantWithOwner(owner)
    const cookies = await loginAndGetCookie(owner.email, 'password123')

    await TenantMembership.create({
      userId: member.id,
      tenantId: tenant.id,
      role: TENANT_ROLES.MEMBER,
    })

    await systemOps.withTenantContext(
      tenant.id,
      async (trx) => {
        await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: owner.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Unread 1',
          },
          trx
        )
        await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: owner.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Unread 2',
          },
          trx
        )
        const alreadyRead = await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: owner.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Already read',
          },
          trx
        )
        alreadyRead.readAt = alreadyRead.createdAt
        await alreadyRead.save()

        await notificationService.send(
          {
            tenantId: tenant.id,
            recipientId: member.id,
            pluginId: 'collab',
            type: 'collab.comment',
            title: 'Other user unread',
          },
          trx
        )
      },
      owner.id
    )

    const response = await request(BASE_URL)
      .post('/api/v1/notifications/read-all')
      .set('Cookie', cookies)
      .set('X-Tenant-ID', String(tenant.id))
      .expect(200)

    assert.equal(response.body.data.updatedCount, 2)
    assert.equal(response.body.message, 'Notifications marked as read')

    const ownerUnreadRows = await db
      .connection('postgres')
      .from('notifications')
      .where('tenant_id', tenant.id)
      .where('recipient_id', owner.id)
      .whereNull('read_at')
    assert.lengthOf(ownerUnreadRows, 0)

    const memberUnreadRows = await db
      .connection('postgres')
      .from('notifications')
      .where('tenant_id', tenant.id)
      .where('recipient_id', member.id)
      .whereNull('read_at')
    assert.lengthOf(memberUnreadRows, 1)
  })
})

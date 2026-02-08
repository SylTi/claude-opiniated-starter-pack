import { test } from '@japa/runner'
import sinon from 'sinon'
import { DateTime } from 'luxon'
import NotificationsController from '#controllers/notifications_controller'
import { notificationService } from '#services/notifications/notification_service'

function buildNotification(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    id: 11,
    tenantId: 7,
    recipientId: 42,
    pluginId: 'collab',
    type: 'collab.comment',
    title: 'New comment',
    body: 'A comment was posted',
    url: '/apps/collab/comments/11',
    meta: { commentId: 11 },
    readAt: null,
    createdAt: DateTime.fromISO('2026-01-01T12:00:00.000Z'),
    updatedAt: DateTime.fromISO('2026-01-01T12:00:00.000Z'),
    ...overrides,
  }
}

function createMockContext(options?: {
  inputs?: Record<string, unknown>
  params?: Record<string, string>
  userId?: number | null
  tenantId?: number | null
}) {
  const inputs = options?.inputs ?? {}
  const tenantDb = { id: 'tenant-trx' }

  return {
    request: {
      input: sinon.stub().callsFake((key: string) => inputs[key]),
    },
    params: options?.params ?? {},
    auth: {
      user: options?.userId === null ? null : { id: options?.userId ?? 42 },
    },
    tenant:
      options?.tenantId === null
        ? undefined
        : {
            id: options?.tenantId ?? 7,
            membership: {
              id: 1,
              tenantId: options?.tenantId ?? 7,
              userId: options?.userId ?? 42,
              role: 'owner',
            },
          },
    tenantDb,
    response: {
      json: sinon.stub().returnsThis(),
      badRequest: sinon.stub().returnsThis(),
      unauthorized: sinon.stub().returnsThis(),
      forbidden: sinon.stub().returnsThis(),
      notFound: sinon.stub().returnsThis(),
    },
  }
}

test.group('NotificationsController', (group) => {
  const sandbox = sinon.createSandbox()

  group.each.teardown(() => {
    sandbox.restore()
  })

  test('index returns 400 for invalid limit', async ({ assert }) => {
    const controller = new NotificationsController()
    const ctx = createMockContext({ inputs: { limit: '1000' } })

    await controller.index(ctx as never)

    assert.isTrue(ctx.response.badRequest.calledOnce)
    assert.equal(
      ctx.response.badRequest.firstCall.args[0].message,
      'limit must be an integer between 1 and 100'
    )
  })

  test('index lists recipient notifications with parsed filters', async ({ assert }) => {
    const controller = new NotificationsController()
    const notification = buildNotification()

    const listStub = sandbox
      .stub(notificationService, 'listForRecipient')
      .resolves([notification] as never)

    const ctx = createMockContext({
      inputs: {
        unreadOnly: 'true',
        limit: '25',
        beforeId: '90',
      },
    })

    await controller.index(ctx as never)

    assert.isTrue(
      listStub.calledWith(
        {
          tenantId: 7,
          recipientId: 42,
          unreadOnly: true,
          limit: 25,
          beforeId: 90,
        },
        sinon.match.object
      )
    )
    assert.isTrue(ctx.response.json.calledOnce)
    assert.lengthOf(ctx.response.json.firstCall.args[0].data, 1)
  })

  test('show returns 404 when notification is missing', async ({ assert }) => {
    const controller = new NotificationsController()
    sandbox.stub(notificationService, 'findForRecipient').resolves(null)

    const ctx = createMockContext({ params: { id: '55' } })
    await controller.show(ctx as never)

    assert.isTrue(ctx.response.notFound.calledOnce)
    assert.equal(ctx.response.notFound.firstCall.args[0].message, 'Notification not found')
  })

  test('show returns notification payload when found', async ({ assert }) => {
    const controller = new NotificationsController()
    const notification = buildNotification({ id: 22 })
    sandbox.stub(notificationService, 'findForRecipient').resolves(notification as never)

    const ctx = createMockContext({ params: { id: '22' } })
    await controller.show(ctx as never)

    assert.isTrue(ctx.response.json.calledOnce)
    assert.equal(ctx.response.json.firstCall.args[0].data.id, 22)
  })

  test('markRead marks and returns notification', async ({ assert }) => {
    const controller = new NotificationsController()
    const notification = buildNotification({
      readAt: DateTime.fromISO('2026-01-03T12:00:00.000Z'),
      id: 33,
    })
    const markStub = sandbox.stub(notificationService, 'markAsRead').resolves(notification as never)

    const ctx = createMockContext({ params: { id: '33' } })
    await controller.markRead(ctx as never)

    assert.isTrue(
      markStub.calledWith(
        33,
        {
          tenantId: 7,
          recipientId: 42,
        },
        sinon.match.object
      )
    )
    assert.isTrue(ctx.response.json.calledOnce)
    assert.equal(ctx.response.json.firstCall.args[0].message, 'Notification marked as read')
  })

  test('markAllRead returns updated count', async ({ assert }) => {
    const controller = new NotificationsController()
    const markAllStub = sandbox.stub(notificationService, 'markAllAsRead').resolves(4)
    const ctx = createMockContext()

    await controller.markAllRead(ctx as never)

    assert.isTrue(
      markAllStub.calledWith(
        {
          tenantId: 7,
          recipientId: 42,
        },
        sinon.match.object
      )
    )
    assert.isTrue(ctx.response.json.calledOnce)
    assert.equal(ctx.response.json.firstCall.args[0].data.updatedCount, 4)
  })

  test('unreadCount returns unread count payload', async ({ assert }) => {
    const controller = new NotificationsController()
    const countStub = sandbox.stub(notificationService, 'countUnreadForRecipient').resolves(9)
    const ctx = createMockContext()

    await controller.unreadCount(ctx as never)

    assert.isTrue(
      countStub.calledWith(
        {
          tenantId: 7,
          recipientId: 42,
        },
        sinon.match.object
      )
    )
    assert.isTrue(ctx.response.json.calledOnce)
    assert.equal(ctx.response.json.firstCall.args[0].data.unreadCount, 9)
  })
})

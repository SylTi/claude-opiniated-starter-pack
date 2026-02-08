import type { HttpContext } from '@adonisjs/core/http'
import type Notification from '#models/notification'
import { notificationService } from '#services/notifications/notification_service'

function parsePositiveInteger(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }
  return parsed
}

function parseBooleanQuery(value: unknown): boolean | null {
  if (value === undefined) {
    return false
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') {
    return true
  }
  if (normalized === 'false' || normalized === '0') {
    return false
  }
  return null
}

function serializeNotification(notification: Notification): Record<string, unknown> {
  return {
    id: notification.id,
    tenantId: notification.tenantId,
    recipientId: notification.recipientId,
    pluginId: notification.pluginId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    meta: notification.meta,
    readAt: notification.readAt?.toISO() ?? null,
    createdAt: notification.createdAt.toISO(),
    updatedAt: notification.updatedAt?.toISO() ?? null,
  }
}

/**
 * Core notifications API (tenant-scoped).
 */
export default class NotificationsController {
  /**
   * GET /api/v1/notifications
   */
  async index({ request, response, auth, tenant, tenantDb }: HttpContext): Promise<void> {
    const user = auth.user
    if (!user) {
      return response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    if (!tenant) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Tenant membership required',
      })
    }

    const unreadOnly = parseBooleanQuery(request.input('unreadOnly'))
    if (unreadOnly === null) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'unreadOnly must be a boolean',
      })
    }

    const limitInput = request.input('limit')
    const limit = limitInput === undefined ? 50 : parsePositiveInteger(limitInput)
    if (limit === null || limit > 100) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'limit must be an integer between 1 and 100',
      })
    }

    const beforeIdInput = request.input('beforeId')
    let beforeId: number | undefined
    if (beforeIdInput !== undefined) {
      const parsedBeforeId = parsePositiveInteger(beforeIdInput)
      if (parsedBeforeId === null) {
        return response.badRequest({
          error: 'ValidationError',
          message: 'beforeId must be a positive integer',
        })
      }
      beforeId = parsedBeforeId
    }

    const notifications = await notificationService.listForRecipient(
      {
        tenantId: tenant.id,
        recipientId: user.id,
        unreadOnly,
        limit,
        beforeId,
      },
      tenantDb
    )

    response.json({
      data: notifications.map(serializeNotification),
    })
  }

  /**
   * GET /api/v1/notifications/:id
   */
  async show({ params, response, auth, tenant, tenantDb }: HttpContext): Promise<void> {
    const user = auth.user
    if (!user) {
      return response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    if (!tenant) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Tenant membership required',
      })
    }

    const notificationId = parsePositiveInteger(params.id)
    if (notificationId === null) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Notification id must be a positive integer',
      })
    }

    const notification = await notificationService.findForRecipient(
      notificationId,
      {
        tenantId: tenant.id,
        recipientId: user.id,
      },
      tenantDb
    )

    if (!notification) {
      return response.notFound({
        error: 'NotFound',
        message: 'Notification not found',
      })
    }

    response.json({
      data: serializeNotification(notification),
    })
  }

  /**
   * POST /api/v1/notifications/:id/read
   */
  async markRead({ params, response, auth, tenant, tenantDb }: HttpContext): Promise<void> {
    const user = auth.user
    if (!user) {
      return response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    if (!tenant) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Tenant membership required',
      })
    }

    const notificationId = parsePositiveInteger(params.id)
    if (notificationId === null) {
      return response.badRequest({
        error: 'ValidationError',
        message: 'Notification id must be a positive integer',
      })
    }

    const notification = await notificationService.markAsRead(
      notificationId,
      {
        tenantId: tenant.id,
        recipientId: user.id,
      },
      tenantDb
    )

    if (!notification) {
      return response.notFound({
        error: 'NotFound',
        message: 'Notification not found',
      })
    }

    response.json({
      data: serializeNotification(notification),
      message: 'Notification marked as read',
    })
  }

  /**
   * POST /api/v1/notifications/read-all
   */
  async markAllRead({ response, auth, tenant, tenantDb }: HttpContext): Promise<void> {
    const user = auth.user
    if (!user) {
      return response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    if (!tenant) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Tenant membership required',
      })
    }

    const updatedCount = await notificationService.markAllAsRead(
      {
        tenantId: tenant.id,
        recipientId: user.id,
      },
      tenantDb
    )

    response.json({
      data: { updatedCount },
      message: 'Notifications marked as read',
    })
  }

  /**
   * GET /api/v1/notifications/unread-count
   */
  async unreadCount({ response, auth, tenant, tenantDb }: HttpContext): Promise<void> {
    const user = auth.user
    if (!user) {
      return response.unauthorized({
        error: 'Unauthorized',
        message: 'Authentication required',
      })
    }

    if (!tenant) {
      return response.forbidden({
        error: 'Forbidden',
        message: 'Tenant membership required',
      })
    }

    const unreadCount = await notificationService.countUnreadForRecipient(
      {
        tenantId: tenant.id,
        recipientId: user.id,
      },
      tenantDb
    )

    response.json({
      data: { unreadCount },
    })
  }
}

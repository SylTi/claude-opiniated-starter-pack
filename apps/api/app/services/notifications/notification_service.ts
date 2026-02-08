import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import Notification from '#models/notification'

export type CoreNotificationPayload = {
  tenantId: number
  recipientId: number
  type: string
  title: string
  body?: string
  url?: string
  meta?: Record<string, unknown>
  pluginId?: string | null
}

export type ListRecipientNotificationsOptions = {
  tenantId: number
  recipientId: number
  unreadOnly?: boolean
  limit?: number
  beforeId?: number
}

export type NotificationLookupScope = {
  tenantId: number
  recipientId: number
}

export default class NotificationService {
  async send(
    payload: CoreNotificationPayload,
    client: TransactionClientContract
  ): Promise<Notification> {
    return Notification.create(
      {
        tenantId: payload.tenantId,
        recipientId: payload.recipientId,
        pluginId: payload.pluginId ?? null,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        url: payload.url ?? null,
        meta: payload.meta ?? null,
        readAt: null,
      },
      { client }
    )
  }

  async sendBatch(
    payloads: CoreNotificationPayload[],
    client: TransactionClientContract
  ): Promise<void> {
    for (const payload of payloads) {
      await this.send(payload, client)
    }
  }

  async listForRecipient(
    options: ListRecipientNotificationsOptions,
    client?: TransactionClientContract
  ): Promise<Notification[]> {
    const limit = options.limit ?? 50

    const query = client ? Notification.query({ client }) : Notification.query()
    query
      .where('tenantId', options.tenantId)
      .where('recipientId', options.recipientId)
      .orderBy('id', 'desc')
      .limit(limit)

    if (options.unreadOnly) {
      query.whereNull('readAt')
    }

    if (options.beforeId !== undefined) {
      query.where('id', '<', options.beforeId)
    }

    return query
  }

  async findForRecipient(
    notificationId: number,
    scope: NotificationLookupScope,
    client?: TransactionClientContract
  ): Promise<Notification | null> {
    const query = client ? Notification.query({ client }) : Notification.query()
    return query
      .where('id', notificationId)
      .where('tenantId', scope.tenantId)
      .where('recipientId', scope.recipientId)
      .first()
  }

  async markAsRead(
    notificationId: number,
    scope: NotificationLookupScope,
    client?: TransactionClientContract
  ): Promise<Notification | null> {
    const notification = await this.findForRecipient(notificationId, scope, client)
    if (!notification) {
      return null
    }

    if (!notification.readAt) {
      notification.readAt = DateTime.utc()
      if (client) {
        notification.useTransaction(client)
      }
      await notification.save()
    }

    return notification
  }

  async countUnreadForRecipient(
    scope: NotificationLookupScope,
    client?: TransactionClientContract
  ): Promise<number> {
    const query = client ? Notification.query({ client }) : Notification.query()
    const result = await query
      .where('tenantId', scope.tenantId)
      .where('recipientId', scope.recipientId)
      .whereNull('readAt')
      .count('* as total')

    return Number(result[0]?.$extras?.total ?? 0)
  }

  async markAllAsRead(
    scope: NotificationLookupScope,
    client?: TransactionClientContract
  ): Promise<number> {
    const query = client ? Notification.query({ client }) : Notification.query()
    const unreadNotifications = await query
      .where('tenantId', scope.tenantId)
      .where('recipientId', scope.recipientId)
      .whereNull('readAt')

    if (unreadNotifications.length === 0) {
      return 0
    }

    const now = DateTime.utc()
    for (const notification of unreadNotifications) {
      notification.readAt = now
      if (client) {
        notification.useTransaction(client)
      }
      await notification.save()
    }

    return unreadNotifications.length
  }
}

export const notificationService = new NotificationService()

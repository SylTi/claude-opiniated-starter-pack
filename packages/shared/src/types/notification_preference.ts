export type NotificationPreferenceDTO = {
  id: number
  tenantId: number
  userId: number
  notificationType: string
  channel: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type NotificationTypeInfo = {
  type: string
  label: string
  description: string
  channels: string[]
}

export type BatchPreferenceInput = {
  notificationType: string
  channel: string
  enabled: boolean
}

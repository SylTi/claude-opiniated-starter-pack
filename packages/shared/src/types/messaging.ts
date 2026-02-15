export type MessagingConversationDTO = {
  id: number
  tenantId: number
  type: 'direct' | 'group'
  name: string | null
  createdByUserId: number
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

export type MessagingParticipantDTO = {
  id: number
  tenantId: number
  conversationId: number
  userId: number
  role: 'admin' | 'member'
  lastReadMessageId: number | null
  joinedAt: string
}

export type MessagingMessageDTO = {
  id: number
  tenantId: number
  conversationId: number
  senderId: number
  content: string
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
}

export type ConversationWithDetailsDTO = MessagingConversationDTO & {
  participants: Array<
    MessagingParticipantDTO & {
      fullName: string
      email: string
      avatarUrl: string | null
    }
  >
  lastMessage: {
    id: number
    senderId: number
    content: string
    createdAt: string
  } | null
  unreadCount: number
}

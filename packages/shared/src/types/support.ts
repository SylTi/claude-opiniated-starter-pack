// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_SOURCES = ['direct', 'chatbot_escalation'] as const
export type TicketSource = (typeof TICKET_SOURCES)[number]

export const COMMENT_VISIBILITIES = ['public', 'internal'] as const
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number]

export const SLA_STATUSES = ['on_track', 'at_risk', 'breached'] as const
export type SlaStatus = (typeof SLA_STATUSES)[number]

/**
 * Allowed status transitions for the ticket workflow.
 *
 * open → in_progress
 * in_progress → waiting_on_customer, resolved, open
 * waiting_on_customer → in_progress, resolved, open
 * resolved → open (reopen), closed
 * closed → open (reopen)
 */
export const ALLOWED_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ['in_progress'],
  in_progress: ['waiting_on_customer', 'resolved', 'open'],
  waiting_on_customer: ['in_progress', 'resolved', 'open'],
  resolved: ['open', 'closed'],
  closed: ['open'],
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface SupportTicketDTO {
  id: number
  tenantId: number
  ticketNumber: number
  subject: string
  description: string
  categorySlug: string
  status: TicketStatus
  priority: TicketPriority
  createdByUserId: number | null
  createdByUserName?: string
  assignedToUserId: number | null
  assignedToUserName?: string
  source: TicketSource
  sourceConversationId: number | null
  firstResponseAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  slaResponseTargetHours: number | null
  slaResolutionTargetHours: number | null
  slaStatus?: SlaStatus
  csatRating: number | null
  csatComment: string | null
  csatSubmittedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SupportTicketListItemDTO {
  id: number
  tenantId: number
  ticketNumber: number
  subject: string
  categorySlug: string
  status: TicketStatus
  priority: TicketPriority
  createdByUserId: number | null
  createdByUserName?: string
  assignedToUserId: number | null
  assignedToUserName?: string
  source: TicketSource
  slaStatus?: SlaStatus
  tenantName?: string
  createdAt: string
  updatedAt: string
}

export interface SupportCommentDTO {
  id: number
  ticketId: number
  authorId: number | null
  authorName?: string
  content: string
  visibility: CommentVisibility
  isSystem: boolean
  createdAt: string
}

export interface SupportActivityLogDTO {
  id: number
  ticketId: number
  actorId: number | null
  actorName?: string
  action: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export interface SupportCategoryDTO {
  slug: string
  label: string
  description: string
  isActive: boolean
  sortOrder: number
  isBypass: boolean
}

export interface SupportSlaPriorityTargets {
  low: number
  normal: number
  high: number
  urgent: number
}

export interface SupportSlaProfile {
  responseTime: SupportSlaPriorityTargets
  resolutionTime: SupportSlaPriorityTargets
}

export interface SupportConfigDTO {
  categories: SupportCategoryDTO[]
  bypassCategories: string[]
  slaProfiles: Record<string, SupportSlaProfile>
  defaultProfile: string
  autoCloseAfterDays: number
}

export interface SupportModeDTO {
  chatbotAvailable: boolean
  bypassCategories: string[]
  categories: SupportCategoryDTO[]
}

export interface SupportStatsDTO {
  openCount: number
  unassignedCount: number
  slaCompliancePercent: number | null
  avgResponseTimeHours: number | null
  avgCsatScore: number | null
}

export interface SupportCsatDTO {
  rating: 1 | 2 | 3 | 4 | 5
  comment?: string
}

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

export const SUPPORT_ABILITIES = {
  ticketCreate: 'support.ticket.create',
  ticketRead: 'support.ticket.read',
  ticketComment: 'support.ticket.comment',
  adminRead: 'support.admin.read',
  adminManage: 'support.admin.manage',
} as const

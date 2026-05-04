import type { WebSocket } from 'ws'

export interface Attachment {
  url: string
  name: string
  size: number
  type: string
}

export interface TinfinSocket extends WebSocket {
  orgId?: string
  visitorId?: string
  conversationId?: string
  isAlive?: boolean
  isAgent?: boolean
  agentId?: string
  awaitingHandoffConfirm?: boolean
  pendingActionLogId?: string
  identityReset?: boolean
}

export type ConversationStatus = 'bot' | 'pending' | 'open' | 'resolved' | 'closed'

export interface VisitorConversationSummary {
  id: string
  status: ConversationStatus
  startedAt: string
  resolvedAt: string | null
  contactName: string | null
  contactEmail: string | null
  lastMessage: string
  lastMessageAt: string
}

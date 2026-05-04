export interface RealtimeAttachment {
  name: string
  url: string
  type: string
  size: number
}

export type RealtimeConversationStatus = 'bot' | 'pending' | 'open' | 'resolved' | 'closed'

export type ConversationQueueState =
  | 'bot'
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'waiting_customer'
  | 'resolved'

export interface RealtimeTimelineItem {
  id: string
  kind: 'note' | 'event'
  eventType: string
  title: string
  body?: string | null
  actorUserId?: string | null
  actorName?: string | null
  actorEmail?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface RealtimeConversationSnapshot {
  id: string
  org_id: string
  contact_id: string | null
  status: RealtimeConversationStatus
  channel: string
  assigned_to: string | null
  started_at: string
  queue_state?: ConversationQueueState | null
  queue_entered_at?: string | null
  resolved_at?: string | null
  first_response_due_at?: string | null
  next_response_due_at?: string | null
  resolution_due_at?: string | null
  first_response_at?: string | null
  last_customer_message_at?: string | null
  last_agent_reply_at?: string | null
  routing_assigned_at?: string | null
  ai_context?: Record<string, unknown> | null
  backlog_minutes?: number | null
  backlog_state?: string | null
  sla_target_at?: string | null
  sla_state?: string | null
  sla_remaining_seconds?: number | null
  sla_stage?: string | null
  sla_is_live?: boolean | null
  contacts?: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
  latest_message_content?: string | null
  latest_message_at?: string | null
  latest_email_subject?: string | null
  latest_email_at?: string | null
  assigned_agent_name?: string | null
  assigned_agent_email?: string | null
}

export interface RealtimeAiSource {
  title?: string | null
  url?: string | null
  similarity?: number | null
  sourceType?: string | null
  pinned?: boolean
}

export type AgentRealtimeEvent =
  | {
      type: 'conversation:new'
      conversationId: string
      channel?: string | null
      conversation?: RealtimeConversationSnapshot | null
      createdAt?: string
    }
  | {
      type: 'conversation:status_changed'
      conversationId: string
      status?: RealtimeConversationStatus
      assignedTo?: string | null
      queueState?: ConversationQueueState | null
      actorUserId?: string | null
      reason?: string | null
      createdAt?: string
    }
  | {
      type: 'visitor:message'
      conversationId: string
      channel?: string | null
      visitorId?: string | null
      content?: string
      attachments?: RealtimeAttachment[]
      createdAt?: string
    }
  | {
      type: 'agent:message'
      conversationId: string
      channel?: string | null
      agentId?: string | null
      content?: string
      attachments?: RealtimeAttachment[]
      clientNonce?: string | null
      createdAt?: string
    }
  | {
      type: 'ai:response'
      conversationId: string
      channel?: string | null
      content?: string
      confidence?: number
      sources?: RealtimeAiSource[]
      answerType?: string
      tokensUsed?: number
      handoff?: boolean
      requiresConfirmation?: boolean
      actionLog?: Record<string, unknown> | null
      createdAt?: string
    }
  | {
      type: 'typing:start' | 'typing:stop'
      conversationId?: string | null
      source?: 'ai' | 'visitor' | 'agent' | string
      visitorId?: string | null
      createdAt?: string
    }
  | {
      type: 'agent:replying'
      conversationId: string
      agentId?: string | null
      isReplying: boolean
      createdAt?: string
    }
  | {
      type: 'handoff:requested'
      conversationId: string
      visitorId?: string | null
      assignedTo?: string | null
      createdAt?: string
    }
  | {
      type: 'approval:requested'
      conversationId?: string | null
      logId?: string | null
      actionName?: string | null
      createdAt?: string
    }
  | {
      type: 'approval:resolved'
      conversationId?: string | null
      logId?: string | null
      status?: string
      message?: string
      createdAt?: string
    }
  | {
      type: 'contact:updated'
      conversationId?: string | null
      contact?: Record<string, unknown> | null
      createdAt?: string
    }
  | {
      type: 'timeline:updated'
      conversationId: string
      eventType?: string | null
      timelineItem?: RealtimeTimelineItem | null
      createdAt?: string
    }
  | {
      type: 'conversation:resolved'
      conversationId: string
      content?: string
      createdAt?: string
    }
  | {
      type: 'message:sent' | 'takeover:success' | 'connected' | 'pong' | 'error'
      conversationId?: string | null
      message?: string
      [key: string]: unknown
    }

export type AgentRealtimeOutboundEvent =
  | {
      type: 'agent:message'
      conversationId: string
      content?: string
      attachments?: RealtimeAttachment[]
      clientNonce?: string
    }
  | {
      type: 'agent:takeover' | 'agent:release' | 'agent:resolve'
      conversationId: string
    }
  | {
      type: 'agent:replying'
      conversationId: string
      isReplying: boolean
    }
  | {
      type: 'action:approve' | 'action:reject'
      logId: string
    }
  | {
      type: 'ping'
    }

export function isAgentRealtimeEvent(value: unknown): value is AgentRealtimeEvent {
  return Boolean(value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string')
}

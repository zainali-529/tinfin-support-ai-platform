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

export type AgentRealtimeEvent =
  | {
      type: 'conversation:new'
      conversationId: string
      channel?: string | null
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
      visitorId?: string | null
      content?: string
      attachments?: RealtimeAttachment[]
      createdAt?: string
    }
  | {
      type: 'agent:message'
      conversationId: string
      agentId?: string | null
      content?: string
      attachments?: RealtimeAttachment[]
      clientNonce?: string | null
      createdAt?: string
    }
  | {
      type: 'ai:response'
      conversationId: string
      content?: string
      confidence?: number
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

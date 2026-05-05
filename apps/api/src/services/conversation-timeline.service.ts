import { emitAgentRealtimeEvent } from './realtime-events.service'
import type { RealtimeTimelineItem } from '@workspace/types'

type SupabaseLike = {
  from: (table: string) => any
}

export type ConversationTimelineEventType =
  | 'internal_note'
  | 'internal_note_edited'
  | 'internal_note_deleted'
  | 'assignment_changed'
  | 'status_changed'
  | 'sla_changed'
  | 'sla_met'
  | 'sla_breached'
  | 'ai_takeover'
  | 'ai_released'
  | 'action_executed'
  | 'contact_updated'
  | 'channel_event'
  | 'csat_received'

export interface RecordConversationTimelineEventInput {
  supabase: SupabaseLike
  orgId: string
  conversationId: string
  eventType: ConversationTimelineEventType
  title: string
  body?: string | null
  actorUserId?: string | null
  noteId?: string | null
  metadata?: Record<string, unknown>
  emitRealtime?: boolean
}

export async function recordConversationTimelineEvent(
  input: RecordConversationTimelineEventInput
): Promise<string | null> {
  const { data, error } = await input.supabase
    .from('conversation_timeline_events')
    .insert({
      org_id: input.orgId,
      conversation_id: input.conversationId,
      actor_user_id: input.actorUserId ?? null,
      note_id: input.noteId ?? null,
      event_type: input.eventType,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? {},
    })
    .select('id, created_at')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const eventId = (data?.id as string | null | undefined) ?? null
  const createdAt = (data?.created_at as string | null | undefined) ?? new Date().toISOString()
  const timelineItem: RealtimeTimelineItem | null = eventId
    ? {
        id: `event:${eventId}`,
        kind: 'event',
        eventType: input.eventType,
        title: input.title,
        body: input.body ?? null,
        actorUserId: input.actorUserId ?? null,
        actorName: null,
        actorEmail: null,
        metadata: input.metadata ?? {},
        createdAt,
      }
    : null

  if (input.emitRealtime !== false) {
    emitAgentRealtimeEvent(input.orgId, {
      type: 'timeline:updated',
      conversationId: input.conversationId,
      eventType: input.eventType,
      timelineItem,
      createdAt,
    })
  }

  return eventId
}

export async function safeRecordConversationTimelineEvent(
  input: RecordConversationTimelineEventInput
) {
  try {
    await recordConversationTimelineEvent(input)
  } catch (error) {
    console.error(
      '[conversation-timeline] record failed:',
      error instanceof Error ? error.message : error
    )
  }
}

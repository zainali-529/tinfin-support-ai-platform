import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { INBOX_SAVED_VIEW_IDS, type InboxSavedViewId, type RealtimeTimelineItem } from '@workspace/types'
import { router, protectedProcedure } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'
import { routePendingConversation } from '../services/inbox-ops.service'
import { notifyConversationAssigned } from '../services/notifications.service'
import { emitAgentRealtimeEvent } from '../services/realtime-events.service'
import {
  recordConversationTimelineEvent,
  safeRecordConversationTimelineEvent,
  type ConversationTimelineEventType,
} from '../services/conversation-timeline.service'
import {
  deriveInboxBacklog,
  deriveInboxSla,
  normalizeQueueState,
  type BacklogState,
  type SlaStage,
  type SlaState,
} from '../lib/inbox-metrics'

const statusFilterSchema = z.enum(['all', 'bot', 'open', 'pending', 'resolved'])
const channelFilterSchema = z.enum(['all', 'chat', 'email', 'whatsapp'])
const inboxSavedViewSchema = z.enum(INBOX_SAVED_VIEW_IDS)
const queueFilterSchema = z.enum([
  'all',
  'bot',
  'queued',
  'assigned',
  'in_progress',
  'waiting_customer',
  'resolved',
])

function queueStateForStatus(status: string, assignedTo: string | null): string {
  if (status === 'resolved' || status === 'closed') return 'resolved'
  if (status === 'bot') return 'bot'
  if (status === 'open') return 'in_progress'
  if (status === 'pending') return assignedTo ? 'assigned' : 'queued'
  return assignedTo ? 'assigned' : 'queued'
}

const conversationSelectFields = [
  'id',
  'org_id',
  'contact_id',
  'status',
  'queue_state',
  'queue_entered_at',
  'channel',
  'assigned_to',
  'ai_context',
  'started_at',
  'resolved_at',
  'first_response_due_at',
  'next_response_due_at',
  'resolution_due_at',
  'first_response_at',
  'last_customer_message_at',
  'last_agent_reply_at',
  'routing_assigned_at',
  'contacts(id, name, email, phone)',
].join(',')

function cleanSearchValue(value: string): string {
  return value.replace(/[,%()]/g, ' ').trim()
}

function toCsv(values: string[]): string {
  return values.join(',')
}

function normalizeContact(value: unknown): {
  id: string
  name: string | null
  email: string | null
  phone: string | null
} | null {
  if (!value) return null
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null

  const contact = row as {
    id?: string
    name?: string | null
    email?: string | null
    phone?: string | null
  }

  if (!contact.id) return null

  return {
    id: contact.id,
    name: contact.name ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

const LOW_CONFIDENCE_THRESHOLD = 0.45
const AI_TRUST_MESSAGE_LIMIT = 2500

function asNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readAiSources(metadata: Record<string, unknown>): unknown[] {
  return Array.isArray(metadata.sources) ? metadata.sources : []
}

function readAiAnswerType(metadata: Record<string, unknown>): string | null {
  return asStringOrNull(metadata.type) ?? asStringOrNull(metadata.answerType)
}

function isNoVerifiedAnswerMetadata(metadata: Record<string, unknown>): boolean {
  const answerType = readAiAnswerType(metadata)
  if (metadata.noVerifiedAnswer === true) return true
  if (answerType === 'ask_handoff') return true

  const confidence = asNumberOrNull(metadata.confidence)
  if (confidence === null) return false

  return confidence < LOW_CONFIDENCE_THRESHOLD && readAiSources(metadata).length === 0
}

function isLowConfidenceAnswerMetadata(metadata: Record<string, unknown>): boolean {
  const confidence = asNumberOrNull(metadata.confidence)

  if (isNoVerifiedAnswerMetadata(metadata)) return true
  if (confidence === null) return false

  return confidence < LOW_CONFIDENCE_THRESHOLD
}

function metadataWithDefinedValues(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  )
}

function statusTimelineEventType(previousStatus: string | null, nextStatus: string): ConversationTimelineEventType {
  if (nextStatus === 'bot') return 'ai_takeover'
  if ((previousStatus === 'bot' || previousStatus === 'pending') && nextStatus === 'open') return 'ai_released'
  return 'status_changed'
}

function statusTimelineTitle(previousStatus: string | null, nextStatus: string): string {
  if (nextStatus === 'bot') return 'AI resumed conversation'
  if ((previousStatus === 'bot' || previousStatus === 'pending') && nextStatus === 'open') {
    return 'Human agent took over'
  }
  if (nextStatus === 'resolved' || nextStatus === 'closed') return 'Conversation resolved'
  return 'Status changed'
}

function normalizeLabels(labels: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const label of labels) {
    const next = label.trim().replace(/\s+/g, ' ').slice(0, 32)
    if (!next) continue
    const key = next.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(next)
    if (output.length >= 12) break
  }

  return output
}

type ConversationListItem = {
  id: string
  org_id: string
  contact_id: string | null
  status: string
  queue_state: string
  channel: string
  assigned_to: string | null
  started_at: string
  queue_entered_at: string
  first_response_due_at: string | null
  next_response_due_at: string | null
  resolution_due_at: string | null
  first_response_at: string | null
  last_customer_message_at: string | null
  last_agent_reply_at: string | null
  routing_assigned_at: string | null
  backlog_minutes: number | null
  backlog_state: BacklogState
  sla_target_at: string | null
  sla_state: SlaState
  sla_remaining_seconds: number | null
  sla_stage: SlaStage
  sla_is_live: boolean
  contacts: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
  latest_message_content: string | null
  latest_message_at: string | null
  latest_email_subject: string | null
  latest_email_at: string | null
  resolved_at: string | null
  assigned_agent_name: string | null
  assigned_agent_email: string | null
  ai_context: Record<string, unknown>
}

type ConversationBaseRow = {
  id: string
  org_id: string
  contact_id: string | null
  status: string
  queue_state: string | null
  queue_entered_at: string | null
  channel: string
  assigned_to: string | null
  ai_context: Record<string, unknown> | null
  started_at: string
  resolved_at: string | null
  first_response_due_at: string | null
  next_response_due_at: string | null
  resolution_due_at: string | null
  first_response_at: string | null
  last_customer_message_at: string | null
  last_agent_reply_at: string | null
  routing_assigned_at: string | null
  contacts: unknown
}

type TimelineActor = {
  id: string
  name: string | null
  email: string | null
}

type ConversationTimelineItem = {
  id: string
  kind: 'note' | 'event'
  eventType: ConversationTimelineEventType
  title: string
  body: string | null
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

type InternalNoteRow = {
  id: string
  conversation_id: string
  author_user_id: string | null
  body: string
  metadata: Record<string, unknown> | null
  edited_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

type SupabaseQueryClient = {
  from: (table: string) => any
}

function authUserDisplayName(user: {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}): string | null {
  const metadata = user.user_metadata ?? {}
  const name = metadata.full_name ?? metadata.name
  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : null
}

async function assertConversationInOrg(
  supabase: SupabaseQueryClient,
  orgId: string,
  conversationId: string
): Promise<ConversationBaseRow> {
  const { data, error } = await supabase
    .from('conversations')
    .select(conversationSelectFields)
    .eq('id', conversationId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load conversation: ${error.message}`,
    })
  }

  if (!data) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
  }

  return data as unknown as ConversationBaseRow
}

async function assertEditableInternalNote(params: {
  supabase: SupabaseQueryClient
  orgId: string
  noteId: string
  userId: string
}): Promise<InternalNoteRow> {
  const { data, error } = await params.supabase
    .from('conversation_internal_notes')
    .select('id, conversation_id, author_user_id, body, metadata, edited_at, deleted_at, created_at, updated_at')
    .eq('id', params.noteId)
    .eq('org_id', params.orgId)
    .maybeSingle()

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load internal note: ${error.message}`,
    })
  }

  if (!data) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Internal note not found.' })
  }

  const note = data as InternalNoteRow

  if (note.author_user_id !== params.userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only the author can edit or delete this internal note.',
    })
  }

  if (note.deleted_at) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This internal note has already been deleted.',
    })
  }

  return note
}

const HYDRATED_SAVED_VIEWS = new Set<InboxSavedViewId>(['sla_at_risk', 'sla_breached'])
const SAVED_VIEW_CANDIDATE_LIMIT = 1200

function isHydratedSavedView(savedView: InboxSavedViewId): boolean {
  return HYDRATED_SAVED_VIEWS.has(savedView)
}

function filterConversationBySavedView(
  conversation: ConversationListItem,
  savedView: InboxSavedViewId,
  userId: string
): boolean {
  switch (savedView) {
    case 'my_open':
      return conversation.status === 'open' && conversation.assigned_to === userId
    case 'unassigned':
      return !['resolved', 'closed'].includes(conversation.status) && conversation.assigned_to === null
    case 'sla_at_risk':
      return conversation.sla_is_live === true && conversation.sla_state === 'at_risk'
    case 'sla_breached':
      return conversation.sla_is_live === true && conversation.sla_state === 'breached'
    case 'waiting_customer':
      return conversation.queue_state === 'waiting_customer'
    case 'human_takeover':
      return conversation.status === 'pending'
    case 'email_only':
      return conversation.channel === 'email'
    case 'whatsapp_only':
      return conversation.channel === 'whatsapp'
    case 'ai_handled':
      return conversation.status === 'bot' || conversation.queue_state === 'bot'
    case 'low_confidence':
      return true
    case 'actions_failed':
      return true
    case 'all':
    default:
      return true
  }
}

async function getFailedActionConversationIds(
  supabase: SupabaseQueryClient,
  orgId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('ai_action_logs')
    .select('conversation_id')
    .eq('org_id', orgId)
    .in('status', ['failed', 'timeout'])
    .not('conversation_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1500)

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load failed action conversations: ${error.message}`,
    })
  }

  return Array.from(
    new Set(
      ((data ?? []) as Array<{ conversation_id: string | null }>)
        .map((row) => row.conversation_id)
        .filter((value): value is string => Boolean(value))
    )
  )
}

async function getLowConfidenceConversationIds(
  supabase: SupabaseQueryClient,
  orgId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id, ai_metadata')
    .eq('org_id', orgId)
    .eq('role', 'assistant')
    .not('ai_metadata', 'is', null)
    .order('created_at', { ascending: false })
    .limit(AI_TRUST_MESSAGE_LIMIT)

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load low-confidence conversations: ${error.message}`,
    })
  }

  return Array.from(
    new Set(
      ((data ?? []) as Array<{ conversation_id: string | null; ai_metadata: Record<string, unknown> | null }>)
        .filter((row) => isLowConfidenceAnswerMetadata(asRecord(row.ai_metadata)))
        .map((row) => row.conversation_id)
        .filter((value): value is string => Boolean(value))
    )
  )
}

function applySavedViewQueryFilters(
  query: any,
  params: {
    savedView: InboxSavedViewId
    userId: string
    failedActionConversationIds?: string[]
    lowConfidenceConversationIds?: string[]
  }
) {
  switch (params.savedView) {
    case 'my_open':
      return query.eq('status', 'open').eq('assigned_to', params.userId)
    case 'unassigned':
      return query.in('status', ['bot', 'pending', 'open']).is('assigned_to', null)
    case 'sla_at_risk':
    case 'sla_breached':
      return query.in('status', ['pending', 'open'])
    case 'waiting_customer':
      return query.eq('queue_state', 'waiting_customer').eq('status', 'open')
    case 'human_takeover':
      return query.eq('status', 'pending')
    case 'email_only':
      return query.eq('channel', 'email')
    case 'whatsapp_only':
      return query.eq('channel', 'whatsapp')
    case 'ai_handled':
      return query.eq('status', 'bot')
    case 'actions_failed':
      return query.in('id', params.failedActionConversationIds ?? [])
    case 'low_confidence':
      return query.in('id', params.lowConfidenceConversationIds ?? [])
    case 'all':
    default:
      return query
  }
}

async function countSavedViewConversations(params: {
  supabase: SupabaseQueryClient
  orgId: string
  userId: string
  savedView: InboxSavedViewId
}): Promise<number> {
  const failedActionConversationIds =
    params.savedView === 'actions_failed'
      ? await getFailedActionConversationIds(params.supabase, params.orgId)
      : undefined
  const lowConfidenceConversationIds =
    params.savedView === 'low_confidence'
      ? await getLowConfidenceConversationIds(params.supabase, params.orgId)
      : undefined

  if (params.savedView === 'actions_failed' && failedActionConversationIds?.length === 0) {
    return 0
  }
  if (params.savedView === 'low_confidence' && lowConfidenceConversationIds?.length === 0) {
    return 0
  }

  let query = params.supabase
    .from('conversations')
    .select(conversationSelectFields, { count: 'exact', head: !isHydratedSavedView(params.savedView) })
    .eq('org_id', params.orgId)

  query = applySavedViewQueryFilters(query, {
    savedView: params.savedView,
    userId: params.userId,
    failedActionConversationIds,
    lowConfidenceConversationIds,
  })

  if (!isHydratedSavedView(params.savedView)) {
    const { count, error } = await query

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to count saved view conversations: ${error.message}`,
      })
    }

    return count ?? 0
  }

  const { data, error } = await query
    .order('started_at', { ascending: false })
    .order('id', { ascending: false })
    .range(0, SAVED_VIEW_CANDIDATE_LIMIT - 1)

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to count SLA saved view conversations: ${error.message}`,
    })
  }

  const hydrated = await hydrateConversationListItems(
    params.supabase,
    params.orgId,
    ((data ?? []) as unknown) as ConversationBaseRow[]
  )

  return hydrated.filter((conversation) =>
    filterConversationBySavedView(conversation, params.savedView, params.userId)
  ).length
}

async function hydrateConversationListItems(
  supabase: SupabaseQueryClient,
  orgId: string,
  rows: ConversationBaseRow[]
): Promise<ConversationListItem[]> {
  const conversationIds = rows.map((row) => row.id)
  const assignedAgentIds = Array.from(
    new Set(rows.map((row) => row.assigned_to).filter((value): value is string => Boolean(value)))
  )
  const latestMessageByConversation = new Map<string, { content: string | null; created_at: string }>()
  const latestEmailByConversation = new Map<string, { subject: string | null; created_at: string }>()
  const assignedAgentById = new Map<string, { name: string | null; email: string | null }>()

  if (conversationIds.length > 0 || assignedAgentIds.length > 0) {
    const messageLimit = Math.min(Math.max(conversationIds.length * 25, 80), 1200)
    const emailLimit = Math.min(Math.max(conversationIds.length * 10, 40), 600)
    const [
      messagesResult,
      emailsResult,
      assignedMembersResult,
    ] = await Promise.all([
      conversationIds.length > 0
        ? supabase
            .from('messages')
            .select('conversation_id, content, created_at')
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })
            .limit(messageLimit)
        : Promise.resolve({ data: [], error: null }),
      conversationIds.length > 0
        ? supabase
            .from('email_messages')
            .select('conversation_id, subject, created_at')
            .eq('org_id', orgId)
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })
            .limit(emailLimit)
        : Promise.resolve({ data: [], error: null }),
      assignedAgentIds.length > 0
        ? supabase
            .from('user_organizations')
            .select('user_id, users(name, email)')
            .eq('org_id', orgId)
            .in('user_id', assignedAgentIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (messagesResult.error || emailsResult.error || assignedMembersResult.error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load conversation previews.',
      })
    }

    for (const row of (messagesResult.data ?? []) as Array<{
      conversation_id: string
      content: string | null
      created_at: string
    }>) {
      if (!latestMessageByConversation.has(row.conversation_id)) {
        latestMessageByConversation.set(row.conversation_id, {
          content: row.content,
          created_at: row.created_at,
        })
      }
    }

    for (const row of (emailsResult.data ?? []) as Array<{
      conversation_id: string
      subject: string | null
      created_at: string
    }>) {
      if (!latestEmailByConversation.has(row.conversation_id)) {
        latestEmailByConversation.set(row.conversation_id, {
          subject: row.subject,
          created_at: row.created_at,
        })
      }
    }

    for (const row of (assignedMembersResult.data ?? []) as Array<{
      user_id: string
      users:
        | {
            name: string | null
            email: string | null
          }
        | Array<{
            name: string | null
            email: string | null
          }>
        | null
    }>) {
      const user = Array.isArray(row.users) ? row.users[0] : row.users
      assignedAgentById.set(row.user_id, {
        name: user?.name ?? null,
        email: user?.email ?? null,
      })
    }
  }

  const nowMs = Date.now()

  return rows.map((row) => {
    const latestMessage = latestMessageByConversation.get(row.id)
    const latestEmail = latestEmailByConversation.get(row.id)
    const metricRow = {
      status: row.status,
      queue_state: row.queue_state,
      assigned_to: row.assigned_to,
      started_at: row.started_at,
      queue_entered_at: row.queue_entered_at,
      first_response_due_at: row.first_response_due_at,
      next_response_due_at: row.next_response_due_at,
      resolution_due_at: row.resolution_due_at,
      first_response_at: row.first_response_at,
      last_customer_message_at: row.last_customer_message_at,
      last_agent_reply_at: row.last_agent_reply_at,
      resolved_at: row.resolved_at,
    }
    const normalizedQueueState = normalizeQueueState(metricRow)
    const backlog = deriveInboxBacklog(metricRow, nowMs)
    const sla = deriveInboxSla(metricRow, nowMs)

    const assignedAgent = row.assigned_to
      ? assignedAgentById.get(row.assigned_to) ?? null
      : null

    return {
      id: row.id,
      org_id: row.org_id,
      contact_id: row.contact_id,
      status: row.status,
      queue_state: normalizedQueueState,
      channel: row.channel,
      assigned_to: row.assigned_to,
      ai_context: asRecord(row.ai_context),
      started_at: row.started_at,
      queue_entered_at: row.queue_entered_at ?? row.started_at,
      resolved_at: row.resolved_at,
      first_response_due_at: row.first_response_due_at,
      next_response_due_at: row.next_response_due_at,
      resolution_due_at: row.resolution_due_at,
      first_response_at: row.first_response_at,
      last_customer_message_at: row.last_customer_message_at,
      last_agent_reply_at: row.last_agent_reply_at,
      routing_assigned_at: row.routing_assigned_at,
      backlog_minutes: backlog.backlogMinutes,
      backlog_state: backlog.backlogState,
      sla_target_at: sla.slaTargetAt,
      sla_state: sla.slaState,
      sla_remaining_seconds: sla.slaRemainingSeconds,
      sla_stage: sla.slaStage,
      sla_is_live: sla.slaIsLive,
      contacts: normalizeContact(row.contacts),
      latest_message_content: latestMessage?.content ?? null,
      latest_message_at: latestMessage?.created_at ?? null,
      latest_email_subject: latestEmail?.subject ?? null,
      latest_email_at: latestEmail?.created_at ?? null,
      assigned_agent_name: assignedAgent?.name ?? null,
      assigned_agent_email: assignedAgent?.email ?? null,
    }
  })
}

async function loadTimelineActors(
  supabase: SupabaseQueryClient,
  actorIds: Array<string | null | undefined>
): Promise<Map<string, TimelineActor>> {
  const ids = Array.from(new Set(actorIds.filter((value): value is string => Boolean(value))))
  const actors = new Map<string, TimelineActor>()
  if (ids.length === 0) return actors

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', ids)

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load timeline actors: ${error.message}`,
    })
  }

  for (const row of (data ?? []) as TimelineActor[]) {
    actors.set(row.id, row)
  }

  return actors
}

function buildTimelineItem(params: {
  id: string
  kind: 'note' | 'event'
  eventType: ConversationTimelineEventType
  title: string
  body?: string | null
  actorUserId?: string | null
  actor?: TimelineActor | null
  metadata?: Record<string, unknown>
  createdAt: string
}): ConversationTimelineItem {
  return {
    id: params.id,
    kind: params.kind,
    eventType: params.eventType,
    title: params.title,
    body: params.body ?? null,
    actorUserId: params.actorUserId ?? null,
    actorName: params.actor?.name ?? null,
    actorEmail: params.actor?.email ?? null,
    metadata: params.metadata ?? {},
    createdAt: params.createdAt,
  }
}

async function loadConversationTimelineItems(params: {
  supabase: SupabaseQueryClient
  orgId: string
  conversation: ConversationBaseRow
}): Promise<ConversationTimelineItem[]> {
  const conversationId = params.conversation.id
  const [
    notesResult,
    eventsResult,
    messagesResult,
    emailEventsResult,
    whatsappEventsResult,
    actionLogsResult,
  ] = await Promise.all([
    params.supabase
      .from('conversation_internal_notes')
      .select('id, author_user_id, deleted_by_user_id, body, metadata, edited_at, deleted_at, updated_at, created_at')
      .eq('org_id', params.orgId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(80),
    params.supabase
      .from('conversation_timeline_events')
      .select('id, actor_user_id, event_type, title, body, metadata, created_at')
      .eq('org_id', params.orgId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(120),
    params.supabase
      .from('messages')
      .select('id, role, content, ai_metadata, created_at')
      .eq('org_id', params.orgId)
      .eq('conversation_id', conversationId)
      .in('role', ['user', 'agent'])
      .order('created_at', { ascending: false })
      .limit(40),
    params.supabase
      .from('email_messages')
      .select('id, direction, subject, from_email, status, created_at')
      .eq('org_id', params.orgId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(30),
    params.supabase
      .from('whatsapp_messages')
      .select('id, direction, status, message_type, wa_contact_id, created_at')
      .eq('org_id', params.orgId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(30),
    params.supabase
      .from('ai_action_logs')
      .select('id, action_id, status, error_message, duration_ms, status_code, retry_count, created_at, completed_at, approved_by')
      .eq('org_id', params.orgId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  const errors = [
    notesResult.error,
    eventsResult.error,
    messagesResult.error,
    emailEventsResult.error,
    whatsappEventsResult.error,
    actionLogsResult.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load conversation timeline: ${errors[0]?.message ?? 'Unknown error'}`,
    })
  }

  const actionRows = (actionLogsResult.data ?? []) as Array<{
    id: string
    action_id: string | null
    status: string
    error_message: string | null
    duration_ms: number | null
    status_code: number | null
    retry_count: number | null
    created_at: string
    completed_at: string | null
    approved_by: string | null
  }>
  const actionIds = Array.from(new Set(actionRows.map((row) => row.action_id).filter(Boolean))) as string[]
  const actionNamesById = new Map<string, string>()

  if (actionIds.length > 0) {
    const { data, error } = await params.supabase
      .from('ai_actions')
      .select('id, display_name, name')
      .eq('org_id', params.orgId)
      .in('id', actionIds)

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load action names: ${error.message}`,
      })
    }

    for (const row of (data ?? []) as Array<{ id: string; display_name: string | null; name: string | null }>) {
      actionNamesById.set(row.id, row.display_name ?? row.name ?? 'AI action')
    }
  }

  const actorIds = [
    ...(notesResult.data ?? []).map((row: { author_user_id: string | null }) => row.author_user_id),
    ...(notesResult.data ?? []).map((row: { deleted_by_user_id?: string | null }) => row.deleted_by_user_id ?? null),
    ...(eventsResult.data ?? []).map((row: { actor_user_id: string | null }) => row.actor_user_id),
    ...(messagesResult.data ?? []).map((row: { ai_metadata: Record<string, unknown> | null }) => {
      const metadata = asRecord(row.ai_metadata)
      return typeof metadata.agentId === 'string' ? metadata.agentId : null
    }),
    ...actionRows.map((row) => row.approved_by),
  ]
  const actors = await loadTimelineActors(params.supabase, actorIds)
  const items: ConversationTimelineItem[] = []

  const sla = deriveInboxSla(params.conversation, Date.now())
  if (sla.slaState) {
    const eventType: ConversationTimelineEventType =
      sla.slaState === 'breached'
        ? 'sla_breached'
        : sla.slaState === 'met'
          ? 'sla_met'
          : 'sla_changed'
    items.push(buildTimelineItem({
      id: `sla:${conversationId}:${sla.slaState}:${sla.slaStage ?? 'unknown'}`,
      kind: 'event',
      eventType,
      title:
        sla.slaState === 'breached'
          ? 'SLA breached'
          : sla.slaState === 'met'
            ? 'SLA met'
            : sla.slaState === 'at_risk'
              ? 'SLA at risk'
              : 'SLA on track',
      body: sla.slaStage ? `Current ${sla.slaStage.replace(/_/g, ' ')} target status.` : null,
      metadata: {
        slaState: sla.slaState,
        slaStage: sla.slaStage,
        slaTargetAt: sla.slaTargetAt,
        slaRemainingSeconds: sla.slaRemainingSeconds,
        synthetic: true,
      },
      createdAt: sla.slaTargetAt ?? params.conversation.started_at,
    }))
  }

  for (const row of (notesResult.data ?? []) as Array<{
    id: string
    author_user_id: string | null
    deleted_by_user_id: string | null
    body: string
    metadata: Record<string, unknown> | null
    edited_at: string | null
    deleted_at: string | null
    updated_at: string
    created_at: string
  }>) {
    const actorId = row.deleted_at ? row.deleted_by_user_id : row.author_user_id
    const actor = actorId ? actors.get(actorId) : null
    const metadata = asRecord(row.metadata)

    if (row.deleted_at) {
      items.push(buildTimelineItem({
        id: `note:${row.id}`,
        kind: 'event',
        eventType: 'internal_note_deleted',
        title: 'Internal note deleted',
        body: 'A note was deleted by its author.',
        actorUserId: actorId,
        actor,
        metadata: {
          ...metadata,
          noteId: row.id,
          deletedAt: row.deleted_at,
          deletedByUserId: row.deleted_by_user_id,
        },
        createdAt: row.created_at,
      }))
      continue
    }

    items.push(buildTimelineItem({
      id: `note:${row.id}`,
      kind: 'note',
      eventType: 'internal_note',
      title: 'Internal note',
      body: row.body,
      actorUserId: row.author_user_id,
      actor,
      metadata: {
        ...metadata,
        noteId: row.id,
        editedAt: row.edited_at,
        updatedAt: row.updated_at,
      },
      createdAt: row.created_at,
    }))
  }

  for (const row of (eventsResult.data ?? []) as Array<{
    id: string
    actor_user_id: string | null
    event_type: ConversationTimelineEventType
    title: string
    body: string | null
    metadata: Record<string, unknown> | null
    created_at: string
  }>) {
    if (row.event_type === 'internal_note_deleted') {
      continue
    }

    const actor = row.actor_user_id ? actors.get(row.actor_user_id) : null
    items.push(buildTimelineItem({
      id: `event:${row.id}`,
      kind: 'event',
      eventType: row.event_type,
      title: row.title,
      body: row.body,
      actorUserId: row.actor_user_id,
      actor,
      metadata: asRecord(row.metadata),
      createdAt: row.created_at,
    }))
  }

  for (const row of (messagesResult.data ?? []) as Array<{
    id: string
    role: string
    content: string | null
    ai_metadata: Record<string, unknown> | null
    created_at: string
  }>) {
    const metadata = asRecord(row.ai_metadata)
    const actorId = typeof metadata.agentId === 'string' ? metadata.agentId : null
    const actor = actorId ? actors.get(actorId) : null
    items.push(buildTimelineItem({
      id: `message:${row.id}`,
      kind: 'event',
      eventType: 'channel_event',
      title: row.role === 'agent' ? 'Agent reply sent' : 'Customer message received',
      body: row.content ? row.content.slice(0, 180) : null,
      actorUserId: actorId,
      actor,
      metadata: {
        channel: params.conversation.channel,
        role: row.role,
        source: 'messages',
      },
      createdAt: row.created_at,
    }))
  }

  for (const row of (emailEventsResult.data ?? []) as Array<{
    id: string
    direction: string
    subject: string | null
    from_email: string | null
    status: string | null
    created_at: string
  }>) {
    items.push(buildTimelineItem({
      id: `email:${row.id}`,
      kind: 'event',
      eventType: 'channel_event',
      title: row.direction === 'outbound' ? 'Email sent' : 'Email received',
      body: row.subject || row.from_email,
      metadata: {
        channel: 'email',
        direction: row.direction,
        status: row.status,
      },
      createdAt: row.created_at,
    }))
  }

  for (const row of (whatsappEventsResult.data ?? []) as Array<{
    id: string
    direction: string
    status: string | null
    message_type: string | null
    wa_contact_id: string | null
    created_at: string
  }>) {
    items.push(buildTimelineItem({
      id: `whatsapp:${row.id}`,
      kind: 'event',
      eventType: 'channel_event',
      title: row.direction === 'outbound' ? 'WhatsApp sent' : 'WhatsApp received',
      body: row.message_type ? `${row.message_type.replace(/_/g, ' ')} message` : null,
      metadata: {
        channel: 'whatsapp',
        direction: row.direction,
        status: row.status,
        waContactId: row.wa_contact_id,
      },
      createdAt: row.created_at,
    }))
  }

  for (const row of actionRows) {
    const actor = row.approved_by ? actors.get(row.approved_by) : null
    const actionName = row.action_id ? actionNamesById.get(row.action_id) : null
    items.push(buildTimelineItem({
      id: `action:${row.id}`,
      kind: 'event',
      eventType: 'action_executed',
      title: `Action ${row.status}`,
      body: actionName ?? row.error_message ?? 'AI action event',
      actorUserId: row.approved_by,
      actor,
      metadata: {
        actionId: row.action_id,
        actionName,
        status: row.status,
        errorMessage: row.error_message,
        durationMs: row.duration_ms,
        statusCode: row.status_code,
        retryCount: row.retry_count,
      },
      createdAt: row.completed_at ?? row.created_at,
    }))
  }

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 180)
}

export const chatRouter = router({
  getConversations: protectedProcedure
    .input(
      z
        .object({
          orgId: z.string().uuid().optional(),
          search: z.string().max(120).optional(),
          status: statusFilterSchema.default('all'),
          channel: channelFilterSchema.default('all'),
          queue: queueFilterSchema.default('all'),
          savedView: inboxSavedViewSchema.default('all'),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(50).default(10),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId

      const page = input?.page ?? 1
      const limit = input?.limit ?? 10
      const status = input?.status ?? 'all'
      const channel = input?.channel ?? 'all'
      const queue = input?.queue ?? 'all'
      const savedView = input?.savedView ?? 'all'
      const rawSearch = input?.search?.trim() ?? ''
      const search = rawSearch.length > 0 ? cleanSearchValue(rawSearch) : ''
      const offset = (page - 1) * limit
      const failedActionConversationIds =
        savedView === 'actions_failed'
          ? await getFailedActionConversationIds(ctx.supabase, orgId)
          : undefined
      const lowConfidenceConversationIds =
        savedView === 'low_confidence'
          ? await getLowConfidenceConversationIds(ctx.supabase, orgId)
          : undefined

      if (savedView === 'actions_failed' && failedActionConversationIds?.length === 0) {
        return {
          items: [] as ConversationListItem[],
          totalCount: 0,
          page,
          limit,
          hasMore: false,
        }
      }
      if (savedView === 'low_confidence' && lowConfidenceConversationIds?.length === 0) {
        return {
          items: [] as ConversationListItem[],
          totalCount: 0,
          page,
          limit,
          hasMore: false,
        }
      }

      let query = ctx.supabase
        .from('conversations')
        .select(conversationSelectFields, { count: 'exact' })
        .eq('org_id', orgId)

      query = applySavedViewQueryFilters(query, {
        savedView,
        userId: ctx.user.id,
        failedActionConversationIds,
        lowConfidenceConversationIds,
      })

      if (channel !== 'all') {
        query = query.eq('channel', channel)
      }

      if (status === 'resolved') {
        query = query.in('status', ['resolved', 'closed'])
      } else if (status !== 'all') {
        query = query.eq('status', status)
      }

      if (queue === 'resolved') {
        query = query.in('queue_state', ['resolved'])
      } else if (queue !== 'all') {
        query = query.eq('queue_state', queue)
      }

      if (search) {
        const [contactMatchResult, messageMatchResult, emailMatchResult] = await Promise.all([
          ctx.supabase
            .from('contacts')
            .select('id')
            .eq('org_id', orgId)
            .or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
            .limit(250),
          ctx.supabase
            .from('messages')
            .select('conversation_id')
            .eq('org_id', orgId)
            .ilike('content', `%${search}%`)
            .limit(350),
          ctx.supabase
            .from('email_messages')
            .select('conversation_id')
            .eq('org_id', orgId)
            .ilike('subject', `%${search}%`)
            .limit(350),
        ])

        if (contactMatchResult.error || messageMatchResult.error || emailMatchResult.error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to search conversations.',
          })
        }

        const contactIds = Array.from(
          new Set((contactMatchResult.data ?? []).map((row) => row.id).filter(Boolean))
        ) as string[]

        const conversationIds = Array.from(
          new Set(
            [...(messageMatchResult.data ?? []), ...(emailMatchResult.data ?? [])]
              .map((row) => row.conversation_id)
              .filter(Boolean)
          )
        ) as string[]

        if (contactIds.length === 0 && conversationIds.length === 0) {
          return {
            items: [] as ConversationListItem[],
            totalCount: 0,
            page,
            limit,
            hasMore: false,
          }
        }

        if (contactIds.length > 0 && conversationIds.length > 0) {
          query = query.or(`contact_id.in.(${toCsv(contactIds)}),id.in.(${toCsv(conversationIds)})`)
        } else if (contactIds.length > 0) {
          query = query.in('contact_id', contactIds)
        } else {
          query = query.in('id', conversationIds)
        }
      }

      if (isHydratedSavedView(savedView)) {
        const { data: candidateRows, error: candidateError } = await query
          .order('started_at', { ascending: false })
          .order('id', { ascending: false })
          .range(0, SAVED_VIEW_CANDIDATE_LIMIT - 1)

        if (candidateError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to load saved view conversations: ${candidateError.message}`,
          })
        }

        const hydratedCandidates = await hydrateConversationListItems(
          ctx.supabase,
          orgId,
          ((candidateRows ?? []) as unknown) as ConversationBaseRow[]
        )
        const filteredItems = hydratedCandidates.filter((conversation) =>
          filterConversationBySavedView(conversation, savedView, ctx.user.id)
        )

        return {
          items: filteredItems.slice(offset, offset + limit),
          totalCount: filteredItems.length,
          page,
          limit,
          hasMore: offset + limit < filteredItems.length,
        }
      }

      const { data: baseRows, error: baseError, count } = await query
        .order('started_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1)

      if (baseError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load conversations: ${baseError.message}`,
        })
      }

      const rows = ((baseRows ?? []) as unknown) as ConversationBaseRow[]
      const totalCount = count ?? 0
      const hasMore = page * limit < totalCount
      const items = await hydrateConversationListItems(ctx.supabase, orgId, rows)

      return {
        items,
        totalCount,
        page,
        limit,
        hasMore,
      }
    }),

  getSavedViewCounts: protectedProcedure.query(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
    const orgId = ctx.userOrgId

    const entries = await Promise.all(
      INBOX_SAVED_VIEW_IDS.map(async (savedView) => [
        savedView,
        await countSavedViewConversations({
          supabase: ctx.supabase,
          orgId,
          userId: ctx.user.id,
          savedView,
        }),
      ] as const)
    )

    return Object.fromEntries(entries) as Record<InboxSavedViewId, number>
  }),

  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId

      const { data, error } = await ctx.supabase
        .from('conversations')
        .select(conversationSelectFields)
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load conversation: ${error.message}`,
        })
      }

      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      const [item] = await hydrateConversationListItems(
        ctx.supabase,
        orgId,
        [data as unknown as ConversationBaseRow]
      )

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      return item
    }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId

      const { data } = await ctx.supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', input.conversationId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
      return data ?? []
    }),

  getAiTrustStats: protectedProcedure.query(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
    const orgId = ctx.userOrgId

    const messagesResult = await ctx.supabase
      .from('messages')
      .select('id, conversation_id, ai_metadata, created_at')
      .eq('org_id', orgId)
      .eq('role', 'assistant')
      .not('ai_metadata', 'is', null)
      .order('created_at', { ascending: false })
      .limit(AI_TRUST_MESSAGE_LIMIT)

    if (messagesResult.error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load AI trust messages: ${messagesResult.error.message}`,
      })
    }

    const trustRows = ((messagesResult.data ?? []) as Array<{
      id: string
      conversation_id: string | null
      ai_metadata: Record<string, unknown> | null
    }>).map((row) => ({
      ...row,
      metadata: asRecord(row.ai_metadata),
    }))

    const lowConfidenceRows = trustRows.filter((row) => isLowConfidenceAnswerMetadata(row.metadata))
    const noVerifiedRows = trustRows.filter((row) => isNoVerifiedAnswerMetadata(row.metadata))
    const lowConfidenceConversationIds = new Set(
      lowConfidenceRows
        .map((row) => row.conversation_id)
        .filter((value): value is string => Boolean(value))
    )

    return {
      lowConfidenceAnswerCount: lowConfidenceRows.length,
      lowConfidenceConversationCount: lowConfidenceConversationIds.size,
      noVerifiedAnswerCount: noVerifiedRows.length,
    }
  }),

  getConversationTimeline: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId
      const conversation = await assertConversationInOrg(ctx.supabase, orgId, input.conversationId)

      return loadConversationTimelineItems({
        supabase: ctx.supabase,
        orgId,
        conversation,
      })
    }),

  createInternalNote: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId
      await assertConversationInOrg(ctx.supabase, orgId, input.conversationId)

      const { data, error } = await ctx.supabase
        .from('conversation_internal_notes')
        .insert({
          org_id: orgId,
          conversation_id: input.conversationId,
          author_user_id: ctx.user.id,
          body: input.body,
          metadata: {},
        })
        .select('id, body, author_user_id, metadata, created_at')
        .maybeSingle()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save internal note: ${error.message}`,
        })
      }

      if (!data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal note was saved but no row was returned.',
        })
      }

      const timelineItem: RealtimeTimelineItem = {
        id: `note:${data.id as string}`,
        kind: 'note',
        eventType: 'internal_note',
        title: 'Internal note',
        body: (data.body as string | null | undefined) ?? input.body,
        actorUserId: (data.author_user_id as string | null | undefined) ?? ctx.user.id,
        actorName: authUserDisplayName(ctx.user),
        actorEmail: ctx.user.email ?? null,
        metadata: (data.metadata as Record<string, unknown> | null | undefined) ?? {},
        createdAt: (data.created_at as string | null | undefined) ?? new Date().toISOString(),
      }

      emitAgentRealtimeEvent(orgId, {
        type: 'timeline:updated',
        conversationId: input.conversationId,
        eventType: 'internal_note',
        timelineItem,
        createdAt: timelineItem.createdAt,
      })

      return {
        note: data,
        timelineItem,
      }
    }),

  updateInternalNote: protectedProcedure
    .input(
      z.object({
        noteId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId
      const existing = await assertEditableInternalNote({
        supabase: ctx.supabase,
        orgId,
        noteId: input.noteId,
        userId: ctx.user.id,
      })

      if (existing.body.trim() === input.body.trim()) {
        const timelineItem: RealtimeTimelineItem = {
          id: `note:${existing.id}`,
          kind: 'note',
          eventType: 'internal_note',
          title: 'Internal note',
          body: existing.body,
          actorUserId: existing.author_user_id,
          actorName: authUserDisplayName(ctx.user),
          actorEmail: ctx.user.email ?? null,
          metadata: {
            ...asRecord(existing.metadata),
            noteId: existing.id,
            editedAt: existing.edited_at,
            updatedAt: existing.updated_at,
          },
          createdAt: existing.created_at,
        }

        return {
          note: existing,
          timelineItem,
        }
      }

      const editedAt = new Date().toISOString()
      const nextMetadata = {
        ...asRecord(existing.metadata),
        editedAt,
        editedByUserId: ctx.user.id,
      }

      const { data, error } = await ctx.supabase
        .from('conversation_internal_notes')
        .update({
          body: input.body,
          edited_at: editedAt,
          metadata: nextMetadata,
        })
        .eq('id', input.noteId)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .select('id, body, author_user_id, metadata, edited_at, updated_at, created_at')
        .maybeSingle()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update internal note: ${error.message}`,
        })
      }

      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Internal note not found.' })
      }

      await safeRecordConversationTimelineEvent({
        supabase: ctx.supabase,
        orgId,
        conversationId: existing.conversation_id,
        eventType: 'internal_note_edited',
        title: 'Internal note edited',
        body: 'A note was updated by its author.',
        actorUserId: ctx.user.id,
        metadata: {
          noteId: input.noteId,
          previousLength: existing.body.length,
          nextLength: input.body.length,
        },
      })

      const timelineItem: RealtimeTimelineItem = {
        id: `note:${data.id as string}`,
        kind: 'note',
        eventType: 'internal_note',
        title: 'Internal note',
        body: (data.body as string | null | undefined) ?? input.body,
        actorUserId: (data.author_user_id as string | null | undefined) ?? ctx.user.id,
        actorName: authUserDisplayName(ctx.user),
        actorEmail: ctx.user.email ?? null,
        metadata: {
          ...((data.metadata as Record<string, unknown> | null | undefined) ?? {}),
          noteId: data.id as string,
          editedAt: (data.edited_at as string | null | undefined) ?? editedAt,
          updatedAt: (data.updated_at as string | null | undefined) ?? editedAt,
        },
        createdAt: (data.created_at as string | null | undefined) ?? existing.created_at,
      }

      emitAgentRealtimeEvent(orgId, {
        type: 'timeline:updated',
        conversationId: existing.conversation_id,
        eventType: 'internal_note',
        timelineItem,
        createdAt: editedAt,
      })

      return {
        note: data,
        timelineItem,
      }
    }),

  deleteInternalNote: protectedProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId
      const existing = await assertEditableInternalNote({
        supabase: ctx.supabase,
        orgId,
        noteId: input.noteId,
        userId: ctx.user.id,
      })

      const deletedAt = new Date().toISOString()
      const { error } = await ctx.supabase
        .from('conversation_internal_notes')
        .update({
          deleted_at: deletedAt,
          deleted_by_user_id: ctx.user.id,
          metadata: {
            ...asRecord(existing.metadata),
            deletedAt,
            deletedByUserId: ctx.user.id,
          },
        })
        .eq('id', input.noteId)
        .eq('org_id', orgId)
        .is('deleted_at', null)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete internal note: ${error.message}`,
        })
      }

      await recordConversationTimelineEvent({
        supabase: ctx.supabase,
        orgId,
        conversationId: existing.conversation_id,
        eventType: 'internal_note_deleted',
        title: 'Internal note deleted',
        body: 'A note was deleted by its author.',
        actorUserId: ctx.user.id,
        metadata: {
          noteId: input.noteId,
          deletedAt,
        },
        emitRealtime: false,
      })

      const timelineItem: RealtimeTimelineItem = {
        id: `note:${input.noteId}`,
        kind: 'event',
        eventType: 'internal_note_deleted',
        title: 'Internal note deleted',
        body: 'A note was deleted by its author.',
        actorUserId: ctx.user.id,
        actorName: authUserDisplayName(ctx.user),
        actorEmail: ctx.user.email ?? null,
        metadata: {
          noteId: input.noteId,
          deletedAt,
          deletedByUserId: ctx.user.id,
        },
        createdAt: existing.created_at,
      }

      emitAgentRealtimeEvent(orgId, {
        type: 'timeline:updated',
        conversationId: existing.conversation_id,
        eventType: 'internal_note_deleted',
        timelineItem,
        createdAt: deletedAt,
      })

      return {
        noteId: input.noteId,
        conversationId: existing.conversation_id,
        timelineItem,
      }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        status: z.enum(['bot', 'pending', 'open', 'resolved', 'closed']),
        assignedTo: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId
      const previousConversation = await assertConversationInOrg(ctx.supabase, orgId, input.conversationId)

      if (input.assignedTo) {
        const { data: membership, error: membershipError } = await ctx.supabase
          .from('user_organizations')
          .select('id')
          .eq('org_id', orgId)
          .eq('user_id', input.assignedTo)
          .maybeSingle()

        if (membershipError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to validate assignee: ${membershipError.message}`,
          })
        }

        if (!membership?.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Assigned user is not a member of this organization.',
          })
        }
      }

      const nextAssignedTo = input.assignedTo ?? null
      const { data: updatedRow, error: updateError } = await ctx.supabase
        .from('conversations')
        .update({
          status: input.status,
          assigned_to: nextAssignedTo,
          queue_state: queueStateForStatus(input.status, nextAssignedTo),
        })
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .select('id')
        .maybeSingle()

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update conversation: ${updateError.message}`,
        })
      }

      if (!updatedRow?.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      if (input.status === 'pending' && !input.assignedTo) {
        try {
          await routePendingConversation({
            supabase: ctx.supabase,
            orgId,
            conversationId: input.conversationId,
            reason: 'manual_pending',
          })
        } catch (routingError) {
          console.error(
            '[chat.updateStatus] routing failed:',
            routingError instanceof Error ? routingError.message : routingError
          )
        }
      }

      const { data: finalData, error: finalError } = await ctx.supabase
        .from('conversations')
        .select('*')
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (finalError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch updated conversation: ${finalError.message}`,
        })
      }

      if (!finalData) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      emitAgentRealtimeEvent(orgId, {
        type: 'conversation:status_changed',
        conversationId: input.conversationId,
        status: finalData.status,
        assignedTo: finalData.assigned_to ?? null,
        queueState: finalData.queue_state ?? null,
        actorUserId: ctx.user.id,
        createdAt: new Date().toISOString(),
      })

      if (previousConversation.assigned_to !== (finalData.assigned_to ?? null)) {
        await safeRecordConversationTimelineEvent({
          supabase: ctx.supabase,
          orgId,
          conversationId: input.conversationId,
          eventType: 'assignment_changed',
          title: finalData.assigned_to ? 'Conversation assigned' : 'Conversation unassigned',
          body: null,
          actorUserId: ctx.user.id,
          metadata: metadataWithDefinedValues({
            previousAssignedTo: previousConversation.assigned_to,
            nextAssignedTo: finalData.assigned_to ?? null,
            status: finalData.status,
          }),
        })
      }

      if (previousConversation.status !== finalData.status) {
        await safeRecordConversationTimelineEvent({
          supabase: ctx.supabase,
          orgId,
          conversationId: input.conversationId,
          eventType: statusTimelineEventType(previousConversation.status, finalData.status),
          title: statusTimelineTitle(previousConversation.status, finalData.status),
          body: `${previousConversation.status} -> ${finalData.status}`,
          actorUserId: ctx.user.id,
          metadata: metadataWithDefinedValues({
            previousStatus: previousConversation.status,
            nextStatus: finalData.status,
            previousQueueState: previousConversation.queue_state,
            nextQueueState: finalData.queue_state ?? null,
          }),
        })
      }

      if (typeof finalData.assigned_to === 'string' && finalData.assigned_to === input.assignedTo) {
        try {
          await notifyConversationAssigned({
            supabase: ctx.supabase,
            orgId,
            conversationId: input.conversationId,
            assignedTo: finalData.assigned_to,
            actorUserId: ctx.user.id,
            reason: 'manual_assignment',
          })
        } catch (notificationError) {
          console.error(
            '[chat.updateStatus] assignment notification failed:',
            notificationError instanceof Error ? notificationError.message : notificationError
          )
        }
      }

      return finalData
    }),

  updateLabels: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        labels: z.array(z.string().min(1).max(64)).max(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId
      const labels = normalizeLabels(input.labels)

      const { data: existing, error: existingError } = await ctx.supabase
        .from('conversations')
        .select('ai_context')
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (existingError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load conversation labels: ${existingError.message}`,
        })
      }

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      const aiContext = {
        ...asRecord(existing.ai_context),
        inboxLabels: labels,
      }

      const { error: updateError } = await ctx.supabase
        .from('conversations')
        .update({ ai_context: aiContext })
        .eq('id', input.conversationId)
        .eq('org_id', orgId)

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update labels: ${updateError.message}`,
        })
      }

      return { labels, aiContext }
    }),
})

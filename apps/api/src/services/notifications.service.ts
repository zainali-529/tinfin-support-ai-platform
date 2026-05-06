import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmailViaResend } from './email.service'
import { deriveInboxBacklog, deriveInboxSla, normalizeQueueState, type InboxMetricConversation } from '../lib/inbox-metrics'
import { emitAgentRealtimeEvent } from './realtime-events.service'
import type { RealtimeConversationSnapshot, RealtimeConversationStatus } from '@workspace/types'

type AnySupabase = SupabaseClient<any, 'public', any>

export type NotificationType =
  | 'conversation_new'
  | 'conversation_assigned'
  | 'sla_at_risk'
  | 'sla_breached'
  | 'ai_handoff_requested'
  | 'action_approval_requested'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical'

interface NotificationRecipient {
  userId: string
  email: string | null
  name: string | null
}

interface CreateNotificationInput {
  supabase: AnySupabase
  orgId: string
  recipientUserId: string
  type: NotificationType
  severity?: NotificationSeverity
  title: string
  body: string
  href?: string | null
  actorUserId?: string | null
  metadata?: Record<string, unknown>
  dedupeKey?: string | null
  email?: boolean | 'auto'
  recipient?: NotificationRecipient | null
}

interface ConversationSummary {
  id: string
  channel?: string | null
  status?: string | null
  assigned_to?: string | null
  contacts?: unknown
}

function normalizeContact(value: unknown): RealtimeConversationSnapshot['contacts'] {
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

interface ScanSlaNotificationResult {
  scanned: number
  created: number
}

const EMAIL_DEFAULT_TYPES = new Set<NotificationType>([
  'conversation_assigned',
  'sla_at_risk',
  'sla_breached',
  'ai_handoff_requested',
  'action_approval_requested',
])

function isEmailEnabled(): boolean {
  return process.env.NOTIFICATION_EMAIL_ENABLED === 'true'
}

function includeNewConversationEmail(): boolean {
  return process.env.NOTIFICATION_EMAIL_INCLUDE_NEW_CONVERSATIONS === 'true'
}

function shouldSendEmail(type: NotificationType, email: CreateNotificationInput['email']): boolean {
  if (!isEmailEnabled()) return false
  if (email === true) return true
  if (email === false) return false
  if (type === 'conversation_new') return includeNewConversationEmail()
  return EMAIL_DEFAULT_TYPES.has(type)
}

function parseEmailAddress(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const angleMatch = trimmed.match(/<([^>]+@[^>]+)>/)
  if (angleMatch?.[1]) return angleMatch[1].trim()
  return trimmed.includes('@') ? trimmed : null
}

function notificationEmailConfig() {
  const apiKey = process.env.NOTIFICATION_RESEND_API_KEY ?? process.env.RESEND_API_KEY ?? ''
  const fromRaw = process.env.NOTIFICATION_EMAIL_FROM ?? 'notifications@Tinfiz.com'
  const from = parseEmailAddress(fromRaw) ?? fromRaw
  const fromName = process.env.NOTIFICATION_EMAIL_FROM_NAME ?? 'Tinfiz'
  const replyTo = process.env.NOTIFICATION_EMAIL_REPLY_TO ?? null

  return { apiKey, from, fromName, replyTo }
}

function appBaseUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.WEB_APP_URL ??
    process.env.APP_URL ??
    null
  )
}

function absoluteHref(href: string | null | undefined): string | null {
  if (!href) return null
  if (/^https?:\/\//i.test(href)) return href
  const base = appBaseUrl()
  if (!base) return null
  return `${base.replace(/\/$/, '')}${href.startsWith('/') ? href : `/${href}`}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildNotificationEmailHtml(input: {
  title: string
  body: string
  href: string | null
}) {
  const cta = input.href
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(input.href)}" style="display:inline-block;border-radius:10px;background:#0f172a;color:#ffffff;padding:11px 16px;text-decoration:none;font-weight:600;">Open in Tinfiz</a></p>`
    : ''

  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:28px 20px;">
      <p style="margin:0 0 12px;color:#64748b;font-size:13px;">Tinfiz notification</p>
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;">${escapeHtml(input.title)}</h1>
      <p style="margin:0;color:#334155;font-size:15px;">${escapeHtml(input.body)}</p>
      ${cta}
      <p style="margin:28px 0 0;color:#94a3b8;font-size:12px;">You are receiving this because you are a member of this workspace.</p>
    </div>
  `
}

function conversationLabel(conversation: ConversationSummary | null): string {
  if (!conversation) return 'conversation'

  const contact = Array.isArray(conversation.contacts)
    ? conversation.contacts[0]
    : conversation.contacts
  const name = contact && typeof contact === 'object'
    ? (contact as { name?: unknown; email?: unknown; phone?: unknown })
    : null
  const identity =
    (typeof name?.name === 'string' && name.name.trim()) ||
    (typeof name?.email === 'string' && name.email.trim()) ||
    (typeof name?.phone === 'string' && name.phone.trim()) ||
    null

  if (identity) return identity
  const channel = conversation.channel ? `${conversation.channel} ` : ''
  return `${channel}conversation`
}

function channelLabel(channel: string | null | undefined): string {
  if (!channel) return 'Conversation'
  if (channel === 'whatsapp') return 'WhatsApp'
  return channel.charAt(0).toUpperCase() + channel.slice(1)
}

async function getRecipientById(
  supabase: AnySupabase,
  userId: string
): Promise<NotificationRecipient | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data?.id) return null

  return {
    userId: data.id as string,
    email: typeof data.email === 'string' ? data.email : null,
    name: typeof data.name === 'string' ? data.name : null,
  }
}

async function fetchOrgRecipients(
  supabase: AnySupabase,
  orgId: string
): Promise<NotificationRecipient[]> {
  const { data, error } = await supabase
    .from('user_organizations')
    .select('user_id, role, users(id, email, name)')
    .eq('org_id', orgId)
    .in('role', ['admin', 'agent'])

  if (error) {
    console.error('[notifications] failed to load recipients:', error.message)
    return []
  }

  const seen = new Set<string>()
  const recipients: NotificationRecipient[] = []

  for (const row of (data ?? []) as Array<Record<string, any>>) {
    const user = Array.isArray(row.users) ? row.users[0] : row.users
    const userId = typeof row.user_id === 'string' ? row.user_id : user?.id
    if (!userId || seen.has(userId)) continue

    seen.add(userId)
    recipients.push({
      userId,
      email: typeof user?.email === 'string' ? user.email : null,
      name: typeof user?.name === 'string' ? user.name : null,
    })
  }

  return recipients
}

async function markEmailStatus(params: {
  supabase: AnySupabase
  notificationId: string
  status: 'skipped' | 'sent' | 'failed'
  error?: string | null
}) {
  const patch: Record<string, unknown> = {
    email_status: params.status,
    email_error: params.error ?? null,
  }

  if (params.status === 'sent') patch.email_sent_at = new Date().toISOString()

  const { error } = await params.supabase
    .from('notifications')
    .update(patch)
    .eq('id', params.notificationId)

  if (error) {
    console.error('[notifications] failed to update email status:', error.message)
  }
}

async function sendNotificationEmail(params: {
  supabase: AnySupabase
  notificationId: string
  recipient: NotificationRecipient | null
  title: string
  body: string
  href?: string | null
}) {
  const recipient = params.recipient
  if (!recipient?.email) {
    await markEmailStatus({
      supabase: params.supabase,
      notificationId: params.notificationId,
      status: 'skipped',
      error: 'Recipient email not available.',
    })
    return
  }

  const config = notificationEmailConfig()
  if (!config.apiKey || !config.from) {
    await markEmailStatus({
      supabase: params.supabase,
      notificationId: params.notificationId,
      status: 'skipped',
      error: 'Notification email environment is not configured.',
    })
    return
  }

  try {
    const url = absoluteHref(params.href)
    await sendEmailViaResend({
      resendApiKey: config.apiKey,
      from: config.from,
      fromName: config.fromName,
      replyTo: config.replyTo,
      to: [recipient.email],
      subject: `[Tinfiz] ${params.title}`,
      htmlBody: buildNotificationEmailHtml({
        title: params.title,
        body: params.body,
        href: url,
      }),
      textBody: `${params.title}\n\n${params.body}${url ? `\n\nOpen: ${url}` : ''}`,
    })
    await markEmailStatus({
      supabase: params.supabase,
      notificationId: params.notificationId,
      status: 'sent',
    })
  } catch (error) {
    await markEmailStatus({
      supabase: params.supabase,
      notificationId: params.notificationId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown email error.',
    })
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<string | null> {
  if (!input.recipientUserId) return null

  const payload = {
    org_id: input.orgId,
    recipient_user_id: input.recipientUserId,
    actor_user_id: input.actorUserId ?? null,
    type: input.type,
    severity: input.severity ?? 'info',
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    metadata: input.metadata ?? {},
    dedupe_key: input.dedupeKey ?? null,
    email_status: shouldSendEmail(input.type, input.email) ? 'not_queued' : 'skipped',
  }

  const { data, error } = await input.supabase
    .from('notifications')
    .insert(payload)
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return null
    console.error('[notifications] create failed:', error.message)
    return null
  }

  const notificationId = data?.id as string | undefined
  if (!notificationId) return null

  if (shouldSendEmail(input.type, input.email)) {
    const recipient = input.recipient ?? (await getRecipientById(input.supabase, input.recipientUserId))
    void sendNotificationEmail({
      supabase: input.supabase,
      notificationId,
      recipient,
      title: input.title,
      body: input.body,
      href: input.href,
    })
  }

  return notificationId
}

export async function notifyOrgMembers(input: Omit<CreateNotificationInput, 'recipientUserId' | 'recipient'> & {
  excludeUserIds?: string[]
}): Promise<number> {
  const recipients = await fetchOrgRecipients(input.supabase, input.orgId)
  const excluded = new Set(input.excludeUserIds ?? [])
  let created = 0

  await Promise.all(
    recipients
      .filter((recipient) => !excluded.has(recipient.userId))
      .map(async (recipient) => {
        const id = await createNotification({
          ...input,
          recipientUserId: recipient.userId,
          recipient,
        })
        if (id) created += 1
      })
  )

  return created
}

async function fetchConversation(
  supabase: AnySupabase,
  orgId: string,
  conversationId: string
): Promise<ConversationSummary | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, channel, status, assigned_to, contacts(name, email, phone)')
    .eq('id', conversationId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    console.error('[notifications] failed to load conversation:', error.message)
    return null
  }

  return (data as ConversationSummary | null) ?? null
}

async function fetchRealtimeConversationSnapshot(
  supabase: AnySupabase,
  orgId: string,
  conversationId: string
): Promise<RealtimeConversationSnapshot | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select([
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
    ].join(','))
    .eq('id', conversationId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      console.error('[notifications] failed to load realtime conversation snapshot:', error.message)
    }
    return null
  }

  const row = data as Record<string, any>
  const [messageResult, emailResult] = await Promise.all([
    supabase
      .from('messages')
      .select('content, created_at')
      .eq('org_id', orgId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('email_messages')
      .select('subject, created_at')
      .eq('org_id', orgId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

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
  const nowMs = Date.now()
  const backlog = deriveInboxBacklog(metricRow, nowMs)
  const sla = deriveInboxSla(metricRow, nowMs)

  return {
    id: row.id,
    org_id: row.org_id,
    contact_id: row.contact_id ?? null,
    status: (row.status ?? 'bot') as RealtimeConversationStatus,
    queue_state: normalizeQueueState(metricRow) as RealtimeConversationSnapshot['queue_state'],
    queue_entered_at: row.queue_entered_at ?? row.started_at ?? null,
    channel: row.channel ?? 'chat',
    assigned_to: row.assigned_to ?? null,
    ai_context: row.ai_context && typeof row.ai_context === 'object' ? row.ai_context : {},
    started_at: row.started_at,
    resolved_at: row.resolved_at ?? null,
    first_response_due_at: row.first_response_due_at ?? null,
    next_response_due_at: row.next_response_due_at ?? null,
    resolution_due_at: row.resolution_due_at ?? null,
    first_response_at: row.first_response_at ?? null,
    last_customer_message_at: row.last_customer_message_at ?? null,
    last_agent_reply_at: row.last_agent_reply_at ?? null,
    routing_assigned_at: row.routing_assigned_at ?? null,
    backlog_minutes: backlog.backlogMinutes,
    backlog_state: backlog.backlogState,
    sla_target_at: sla.slaTargetAt,
    sla_state: sla.slaState,
    sla_remaining_seconds: sla.slaRemainingSeconds,
    sla_stage: sla.slaStage,
    sla_is_live: sla.slaIsLive,
    contacts: normalizeContact(row.contacts),
    latest_message_content: (messageResult.data as { content?: string | null } | null)?.content ?? null,
    latest_message_at: (messageResult.data as { created_at?: string | null } | null)?.created_at ?? null,
    latest_email_subject: (emailResult.data as { subject?: string | null } | null)?.subject ?? null,
    latest_email_at: (emailResult.data as { created_at?: string | null } | null)?.created_at ?? null,
    assigned_agent_name: null,
    assigned_agent_email: null,
  }
}

export async function notifyNewConversation(input: {
  supabase: AnySupabase
  orgId: string
  conversationId: string
  channel?: string | null
}) {
  const [conversation, realtimeConversation] = await Promise.all([
    fetchConversation(input.supabase, input.orgId, input.conversationId),
    fetchRealtimeConversationSnapshot(input.supabase, input.orgId, input.conversationId),
  ])
  const channel = input.channel ?? conversation?.channel ?? 'chat'

  emitAgentRealtimeEvent(input.orgId, {
    type: 'conversation:new',
    conversationId: input.conversationId,
    channel,
    conversation: realtimeConversation,
    createdAt: new Date().toISOString(),
  })

  return notifyOrgMembers({
    supabase: input.supabase,
    orgId: input.orgId,
    type: 'conversation_new',
    severity: 'info',
    title: `New ${channelLabel(channel)} conversation`,
    body: `${conversationLabel(conversation)} started a new ${channelLabel(channel).toLowerCase()} conversation.`,
    href: `/inbox?conversation=${input.conversationId}`,
    metadata: {
      conversationId: input.conversationId,
      channel,
    },
    dedupeKey: `conversation_new:${input.conversationId}`,
    email: 'auto',
  })
}

export async function notifyConversationAssigned(input: {
  supabase: AnySupabase
  orgId: string
  conversationId: string
  assignedTo: string | null | undefined
  actorUserId?: string | null
  reason?: string | null
}) {
  if (!input.assignedTo) return null

  const conversation = await fetchConversation(input.supabase, input.orgId, input.conversationId)
  const channel = conversation?.channel ?? 'conversation'

  return createNotification({
    supabase: input.supabase,
    orgId: input.orgId,
    recipientUserId: input.assignedTo,
    actorUserId: input.actorUserId ?? null,
    type: 'conversation_assigned',
    severity: 'info',
    title: 'Conversation assigned to you',
    body: `${conversationLabel(conversation)} is now assigned to you.`,
    href: `/inbox?conversation=${input.conversationId}`,
    metadata: {
      conversationId: input.conversationId,
      channel,
      reason: input.reason ?? 'assignment',
    },
    dedupeKey: `conversation_assigned:${input.conversationId}:${input.assignedTo}`,
    email: 'auto',
  })
}

export async function notifyHandoffRequested(input: {
  supabase: AnySupabase
  orgId: string
  conversationId: string
  assignedTo?: string | null
}) {
  const conversation = await fetchConversation(input.supabase, input.orgId, input.conversationId)
  const notification = {
    supabase: input.supabase,
    orgId: input.orgId,
    type: 'ai_handoff_requested' as const,
    severity: 'warning' as const,
    title: 'Human takeover requested',
    body: `${conversationLabel(conversation)} needs a human reply.`,
    href: `/inbox?conversation=${input.conversationId}`,
    metadata: {
      conversationId: input.conversationId,
      channel: conversation?.channel ?? null,
    },
    dedupeKey: `ai_handoff_requested:${input.conversationId}`,
    email: 'auto' as const,
  }

  if (input.assignedTo) {
    return createNotification({
      ...notification,
      recipientUserId: input.assignedTo,
    })
  }

  return notifyOrgMembers(notification)
}

export async function notifyActionApprovalRequested(input: {
  supabase: AnySupabase
  orgId: string
  conversationId: string
  logId?: string | null
  actionName?: string | null
}) {
  const conversation = await fetchConversation(input.supabase, input.orgId, input.conversationId)
  const actionName = input.actionName?.trim() || 'AI action'

  return notifyOrgMembers({
    supabase: input.supabase,
    orgId: input.orgId,
    type: 'action_approval_requested',
    severity: 'warning',
    title: 'Action approval required',
    body: `${actionName} needs approval before it can run for ${conversationLabel(conversation)}.`,
    href: `/inbox?conversation=${input.conversationId}`,
    metadata: {
      conversationId: input.conversationId,
      logId: input.logId ?? null,
      actionName,
    },
    dedupeKey: `action_approval_requested:${input.logId ?? input.conversationId}:${actionName}`,
    email: 'auto',
  })
}

export async function scanSlaNotifications(
  supabase: AnySupabase,
  orgId: string
): Promise<ScanSlaNotificationResult> {
  const { data, error } = await supabase
    .from('conversations')
    .select([
      'id',
      'status',
      'queue_state',
      'assigned_to',
      'channel',
      'started_at',
      'queue_entered_at',
      'resolved_at',
      'first_response_due_at',
      'next_response_due_at',
      'resolution_due_at',
      'first_response_at',
      'last_customer_message_at',
      'last_agent_reply_at',
      'contacts(name, email, phone)',
    ].join(','))
    .eq('org_id', orgId)
    .in('status', ['pending', 'open'])
    .limit(250)

  if (error) {
    console.error('[notifications] SLA scan failed:', error.message)
    return { scanned: 0, created: 0 }
  }

  const rows = ((data ?? []) as unknown) as Array<InboxMetricConversation & ConversationSummary>
  const recipients = await fetchOrgRecipients(supabase, orgId)
  const recipientsById = new Map(recipients.map((recipient) => [recipient.userId, recipient]))
  const nowMs = Date.now()
  let created = 0

  for (const row of rows) {
    const sla = deriveInboxSla(row, nowMs)
    if (!sla.slaIsLive || (sla.slaState !== 'at_risk' && sla.slaState !== 'breached')) continue

    const assignedRecipient = row.assigned_to ? recipientsById.get(row.assigned_to) ?? null : null
    const notificationRecipients = assignedRecipient ? [assignedRecipient] : recipients
    const severity: NotificationSeverity = sla.slaState === 'breached' ? 'critical' : 'warning'
    const title = sla.slaState === 'breached' ? 'SLA breached' : 'SLA at risk'
    const minutes =
      sla.slaRemainingSeconds === null
        ? null
        : Math.abs(Math.ceil(sla.slaRemainingSeconds / 60))
    const body =
      sla.slaState === 'breached'
        ? `${conversationLabel(row)} missed the ${sla.slaStage ?? 'SLA'} target${minutes !== null ? ` by ${minutes}m` : ''}.`
        : `${conversationLabel(row)} is close to missing the ${sla.slaStage ?? 'SLA'} target${minutes !== null ? ` in ${minutes}m` : ''}.`

    await Promise.all(notificationRecipients.map(async (recipient) => {
      const id = await createNotification({
        supabase,
        orgId,
        recipientUserId: recipient.userId,
        recipient,
        type: sla.slaState === 'breached' ? 'sla_breached' : 'sla_at_risk',
        severity,
        title,
        body,
        href: `/inbox?conversation=${row.id}`,
        metadata: {
          conversationId: row.id,
          channel: row.channel ?? null,
          slaState: sla.slaState,
          slaStage: sla.slaStage,
          slaTargetAt: sla.slaTargetAt,
          slaRemainingSeconds: sla.slaRemainingSeconds,
        },
        dedupeKey: `sla:${sla.slaState}:${row.id}:${sla.slaStage ?? 'unknown'}:${sla.slaTargetAt ?? 'no-target'}`,
        email: 'auto',
      })
      if (id) created += 1
    }))
  }

  return { scanned: rows.length, created }
}


import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { getApiDb, sql } from '../lib/db'
import { getPlan } from '../lib/plans'
import { getOrgSubscription } from '../lib/subscriptions'
import { protectedProcedure, router } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'

type DashboardPeriod = 'today' | '7d' | '30d'

const periodSchema = z
  .object({
    period: z.enum(['today', '7d', '30d']).default('7d'),
  })
  .optional()

const listInputSchema = z
  .object({
    limit: z.number().int().min(1).max(20).default(6),
  })
  .optional()

interface ContactJoin {
  name: string | null
  email: string | null
  phone: string | null
}

interface DashboardOverviewStatsRow {
  active_conversations: unknown
  pending_conversations: unknown
  total_contacts: unknown
  current_contacts: unknown
  prev_contacts: unknown
  current_resolved: unknown
  prev_resolved: unknown
  current_conversations: unknown
  current_ai_messages: unknown
  current_agent_messages: unknown
  prev_ai_messages: unknown
  prev_agent_messages: unknown
  queue_bot: unknown
  queue_pending: unknown
  queue_open: unknown
  queue_unassigned: unknown
  queue_assigned: unknown
  sla_at_risk: unknown
  sla_breached: unknown
  channel_chat: unknown
  channel_email: unknown
  channel_whatsapp: unknown
  channel_voice: unknown
  current_calls: unknown
  active_calls: unknown
  knowledge_base_count: unknown
  active_ai_actions: unknown
  current_action_logs: unknown
  current_successful_action_logs: unknown
}

interface RecentConversationRow {
  id: string
  status: string
  channel: string
  started_at: string
  assigned_to: string | null
  contact_name: string | null
  contact_value: string | null
  preview_text: string | null
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getPeriodDays(period: DashboardPeriod): number {
  if (period === 'today') return 1
  if (period === '7d') return 7
  return 30
}

function getPeriodBounds(period: DashboardPeriod): {
  currentStartIso: string
  currentEndIso: string
  prevStartIso: string
} {
  const now = new Date()
  const currentEndIso = now.toISOString()

  if (period === 'today') {
    const currentStart = startOfDay(now)
    const prevStart = new Date(currentStart)
    prevStart.setDate(prevStart.getDate() - 1)

    return {
      currentStartIso: currentStart.toISOString(),
      currentEndIso,
      prevStartIso: prevStart.toISOString(),
    }
  }

  const days = getPeriodDays(period)
  const currentStart = startOfDay(now)
  currentStart.setDate(currentStart.getDate() - days)

  const prevStart = new Date(currentStart)
  prevStart.setDate(prevStart.getDate() - days)

  return {
    currentStartIso: currentStart.toISOString(),
    currentEndIso,
    prevStartIso: prevStart.toISOString(),
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function normalizeContact(value: unknown): ContactJoin | null {
  if (!value) return null
  if (Array.isArray(value)) return (value[0] as ContactJoin | undefined) ?? null
  return value as ContactJoin
}

function previewText(content: string | null | undefined): string {
  if (!content) return 'No messages yet'
  const clean = content.trim()
  if (!clean) return 'No messages yet'
  if (clean.length <= 120) return clean
  return `${clean.slice(0, 117)}...`
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function hasArrayItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasRows(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

export const dashboardRouter = router({
  getHomeOverview: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'dashboard', 'Dashboard access is required.')
      const orgId = ctx.userOrgId
      const period = (input?.period ?? '7d') as DashboardPeriod
      const { currentStartIso, currentEndIso, prevStartIso } =
        getPeriodBounds(period)

      let stats: DashboardOverviewStatsRow | undefined

      try {
        const rows = await getApiDb().execute(sql<DashboardOverviewStatsRow>`
          WITH params AS (
            SELECT
              CAST(${orgId} AS uuid) AS org_id,
              CAST(${currentStartIso} AS timestamptz) AS current_start,
              CAST(${currentEndIso} AS timestamptz) AS current_end,
              CAST(${prevStartIso} AS timestamptz) AS prev_start,
              now() AS now_at
          ),
          conversation_scope AS (
            SELECT
              c.*,
              CASE
                WHEN c.status IN ('pending', 'open') AND c.first_response_at IS NULL
                  THEN c.first_response_due_at
                WHEN c.status IN ('pending', 'open')
                  AND c.first_response_at IS NOT NULL
                  AND c.last_customer_message_at IS NOT NULL
                  AND (
                    c.last_agent_reply_at IS NULL
                    OR c.last_customer_message_at > c.last_agent_reply_at
                  )
                  THEN COALESCE(c.next_response_due_at, c.first_response_due_at)
                ELSE NULL
              END AS live_sla_target_at
            FROM public.conversations c
            JOIN params p ON c.org_id = p.org_id
            WHERE c.status IN ('bot', 'pending', 'open')
              OR c.started_at >= p.prev_start
          ),
          conversation_stats AS (
            SELECT
              COUNT(*) FILTER (WHERE status IN ('bot', 'pending', 'open')) AS active_conversations,
              COUNT(*) FILTER (WHERE status = 'pending') AS pending_conversations,
              COUNT(*) FILTER (
                WHERE status IN ('resolved', 'closed')
                  AND started_at >= p.current_start
                  AND started_at < p.current_end
              ) AS current_resolved,
              COUNT(*) FILTER (
                WHERE status IN ('resolved', 'closed')
                  AND started_at >= p.prev_start
                  AND started_at < p.current_start
              ) AS prev_resolved,
              COUNT(*) FILTER (
                WHERE started_at >= p.current_start
                  AND started_at < p.current_end
              ) AS current_conversations,
              COUNT(*) FILTER (WHERE status = 'bot') AS queue_bot,
              COUNT(*) FILTER (WHERE status = 'pending') AS queue_pending,
              COUNT(*) FILTER (WHERE status = 'open') AS queue_open,
              COUNT(*) FILTER (
                WHERE status IN ('bot', 'pending', 'open') AND assigned_to IS NULL
              ) AS queue_unassigned,
              COUNT(*) FILTER (
                WHERE status IN ('bot', 'pending', 'open') AND assigned_to IS NOT NULL
              ) AS queue_assigned,
              COUNT(*) FILTER (
                WHERE live_sla_target_at IS NOT NULL
                  AND live_sla_target_at <= p.now_at
              ) AS sla_breached,
              COUNT(*) FILTER (
                WHERE live_sla_target_at IS NOT NULL
                  AND live_sla_target_at > p.now_at
                  AND live_sla_target_at <= p.now_at + interval '5 minutes'
              ) AS sla_at_risk,
              COUNT(*) FILTER (
                WHERE status IN ('bot', 'pending', 'open')
                  AND COALESCE(NULLIF(channel, ''), 'chat') NOT IN ('email', 'whatsapp', 'voice')
              ) AS channel_chat,
              COUNT(*) FILTER (
                WHERE status IN ('bot', 'pending', 'open') AND channel = 'email'
              ) AS channel_email,
              COUNT(*) FILTER (
                WHERE status IN ('bot', 'pending', 'open') AND channel = 'whatsapp'
              ) AS channel_whatsapp,
              COUNT(*) FILTER (
                WHERE status IN ('bot', 'pending', 'open') AND channel = 'voice'
              ) AS channel_voice
            FROM conversation_scope
            CROSS JOIN params p
          ),
          contact_stats AS (
            SELECT
              COUNT(*) AS total_contacts,
              COUNT(*) FILTER (
                WHERE c.created_at >= p.current_start AND c.created_at < p.current_end
              ) AS current_contacts,
              COUNT(*) FILTER (
                WHERE c.created_at >= p.prev_start AND c.created_at < p.current_start
              ) AS prev_contacts
            FROM public.contacts c
            CROSS JOIN params p
            WHERE c.org_id = p.org_id
          ),
          message_stats AS (
            SELECT
              COUNT(*) FILTER (
                WHERE role = 'assistant'
                  AND created_at >= p.current_start
                  AND created_at < p.current_end
              ) AS current_ai_messages,
              COUNT(*) FILTER (
                WHERE role = 'agent'
                  AND created_at >= p.current_start
                  AND created_at < p.current_end
              ) AS current_agent_messages,
              COUNT(*) FILTER (
                WHERE role = 'assistant'
                  AND created_at >= p.prev_start
                  AND created_at < p.current_start
              ) AS prev_ai_messages,
              COUNT(*) FILTER (
                WHERE role = 'agent'
                  AND created_at >= p.prev_start
                  AND created_at < p.current_start
              ) AS prev_agent_messages
            FROM public.messages m
            CROSS JOIN params p
            WHERE m.org_id = p.org_id
              AND m.created_at >= p.prev_start
              AND m.created_at < p.current_end
          ),
          call_stats AS (
            SELECT
              COUNT(*) FILTER (
                WHERE created_at >= p.current_start AND created_at < p.current_end
              ) AS current_calls,
              COUNT(*) FILTER (
                WHERE status IN ('created', 'queued', 'ringing', 'in-progress', 'active', 'started')
              ) AS active_calls
            FROM public.calls c
            CROSS JOIN params p
            WHERE c.org_id = p.org_id
          ),
          kb_stats AS (
            SELECT COUNT(*) AS knowledge_base_count
            FROM public.knowledge_bases kb
            CROSS JOIN params p
            WHERE kb.org_id = p.org_id
          ),
          action_stats AS (
            SELECT COUNT(*) AS active_ai_actions
            FROM public.ai_actions a
            CROSS JOIN params p
            WHERE a.org_id = p.org_id AND a.is_active = true
          ),
          action_log_stats AS (
            SELECT
              COUNT(*) AS current_action_logs,
              COUNT(*) FILTER (WHERE status = 'success') AS current_successful_action_logs
            FROM public.ai_action_logs l
            CROSS JOIN params p
            WHERE l.org_id = p.org_id
              AND l.created_at >= p.current_start
              AND l.created_at < p.current_end
          )
          SELECT *
          FROM conversation_stats,
            contact_stats,
            message_stats,
            call_stats,
            kb_stats,
            action_stats,
            action_log_stats
        `)
        stats = (rows as unknown as DashboardOverviewStatsRow[])[0]
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load dashboard overview: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        })
      }

      if (!stats) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load dashboard overview: empty result',
        })
      }

      const openConversations = toNumber(stats.active_conversations)
      const pendingConversations = toNumber(stats.pending_conversations)
      const totalContacts = toNumber(stats.total_contacts)
      const currentContacts = toNumber(stats.current_contacts)
      const prevContacts = toNumber(stats.prev_contacts)
      const currentResolved = toNumber(stats.current_resolved)
      const prevResolved = toNumber(stats.prev_resolved)
      const currentConversations = toNumber(stats.current_conversations)
      const currentAiMessages = toNumber(stats.current_ai_messages)
      const currentAgentMessages = toNumber(stats.current_agent_messages)
      const prevAiMessages = toNumber(stats.prev_ai_messages)
      const prevAgentMessages = toNumber(stats.prev_agent_messages)
      const currentCalls = toNumber(stats.current_calls)
      const activeCalls = toNumber(stats.active_calls)
      const knowledgeBaseCount = toNumber(stats.knowledge_base_count)
      const activeAiActions = toNumber(stats.active_ai_actions)
      const currentActionLogs = toNumber(stats.current_action_logs)
      const currentSuccessfulActionLogs = toNumber(
        stats.current_successful_action_logs
      )

      const currentHandledTotal = currentAiMessages + currentAgentMessages
      const prevHandledTotal = prevAiMessages + prevAgentMessages

      const aiHandledRate =
        currentHandledTotal > 0
          ? Math.round((currentAiMessages / currentHandledTotal) * 100)
          : 0
      const prevAiHandledRate =
        prevHandledTotal > 0
          ? Math.round((prevAiMessages / prevHandledTotal) * 100)
          : 0
      const resolutionRate =
        currentConversations > 0
          ? Math.round((currentResolved / currentConversations) * 100)
          : 0
      const actionSuccessRate =
        currentActionLogs > 0
          ? Math.round((currentSuccessfulActionLogs / currentActionLogs) * 100)
          : 0

      const queueBreakdown = {
        bot: toNumber(stats.queue_bot),
        pending: toNumber(stats.queue_pending),
        open: toNumber(stats.queue_open),
        unassigned: toNumber(stats.queue_unassigned),
        assigned: toNumber(stats.queue_assigned),
        slaAtRisk: toNumber(stats.sla_at_risk),
        slaBreached: toNumber(stats.sla_breached),
      }
      const channelBreakdown = {
        chat: toNumber(stats.channel_chat),
        email: toNumber(stats.channel_email),
        whatsapp: toNumber(stats.channel_whatsapp),
        voice: toNumber(stats.channel_voice),
      }

      return {
        period,
        summary: {
          openConversations,
          pendingConversations,
          totalContacts,
          newContactsInPeriod: currentContacts,
          resolvedInPeriod: currentResolved,
          aiHandledRate: clampPercent(aiHandledRate),
          aiMessagesInPeriod: currentAiMessages,
          agentMessagesInPeriod: currentAgentMessages,
          resolutionRate: clampPercent(resolutionRate),
          unassignedConversations: queueBreakdown.unassigned,
          assignedConversations: queueBreakdown.assigned,
          botConversations: queueBreakdown.bot,
          slaAtRiskConversations: queueBreakdown.slaAtRisk,
          slaBreachedConversations: queueBreakdown.slaBreached,
          activeCalls,
          callsInPeriod: currentCalls,
          knowledgeBaseCount,
          activeAiActions,
          aiActionExecutionsInPeriod: currentActionLogs,
          aiActionSuccessRate: clampPercent(actionSuccessRate),
        },
        queue: {
          totalActive: openConversations,
          ...queueBreakdown,
        },
        channels: channelBreakdown,
        trends: {
          newContactsChangePct: percentChange(currentContacts, prevContacts),
          resolvedChangePct: percentChange(currentResolved, prevResolved),
          aiHandledRateChangePct: aiHandledRate - prevAiHandledRate,
        },
        updatedAt: new Date().toISOString(),
      }
    }),

  getRecentConversations: protectedProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'dashboard', 'Dashboard access is required.')
      const limit = input?.limit ?? 6

      let conversations: RecentConversationRow[]

      try {
        const rows = await getApiDb().execute(sql<RecentConversationRow>`
          SELECT
            c.id,
            CASE WHEN c.status = 'closed' THEN 'resolved' ELSE c.status END AS status,
            COALESCE(NULLIF(c.channel, ''), 'chat') AS channel,
            c.started_at,
            c.assigned_to,
            COALESCE(
              NULLIF(ct.name, ''),
              NULLIF(ct.email, ''),
              NULLIF(ct.phone, ''),
              'Anonymous'
            ) AS contact_name,
            COALESCE(NULLIF(ct.email, ''), NULLIF(ct.phone, '')) AS contact_value,
            CASE
              WHEN c.channel = 'email' THEN COALESCE(em.subject, m.content)
              ELSE m.content
            END AS preview_text
          FROM public.conversations c
          LEFT JOIN public.contacts ct ON ct.id = c.contact_id
          LEFT JOIN LATERAL (
            SELECT m.content
            FROM public.messages m
            WHERE m.org_id = c.org_id
              AND m.conversation_id = c.id
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT 1
          ) m ON true
          LEFT JOIN LATERAL (
            SELECT em.subject
            FROM public.email_messages em
            WHERE em.org_id = c.org_id
              AND em.conversation_id = c.id
            ORDER BY em.created_at DESC, em.id DESC
            LIMIT 1
          ) em ON true
          WHERE c.org_id = CAST(${ctx.userOrgId} AS uuid)
          ORDER BY c.started_at DESC, c.id DESC
          LIMIT ${limit}
        `)
        conversations = rows as unknown as RecentConversationRow[]
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load recent conversations: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        })
      }

      return conversations.map((conversation) => {
        return {
          id: conversation.id,
          channel: conversation.channel,
          status: conversation.status,
          startedAt: conversation.started_at,
          contactName: conversation.contact_name?.trim() || 'Anonymous',
          contactValue: conversation.contact_value?.trim() || null,
          previewText: previewText(conversation.preview_text),
          isUnassigned: !conversation.assigned_to,
          href: `/inbox?conversation=${conversation.id}`,
        }
      })
    }),

  getActivityFeed: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(25).default(12),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'dashboard', 'Dashboard access is required.')
      const limit = input?.limit ?? 12

      const [conversationResult, messagesResult, callsResult] = await Promise.all([
        ctx.supabase
          .from('conversations')
          .select('id,status,channel,started_at,contacts(name,email,phone)')
          .eq('org_id', ctx.userOrgId)
          .order('started_at', { ascending: false })
          .limit(limit),

        ctx.supabase
          .from('messages')
          .select('id,conversation_id,role,content,created_at')
          .eq('org_id', ctx.userOrgId)
          .order('created_at', { ascending: false })
          .limit(limit),

        ctx.supabase
          .from('calls')
          .select('id,status,type,duration_seconds,created_at')
          .eq('org_id', ctx.userOrgId)
          .order('created_at', { ascending: false })
          .limit(limit),
      ])

      const queryErrors = [
        conversationResult.error,
        messagesResult.error,
        callsResult.error,
      ].filter(Boolean)

      if (queryErrors.length > 0) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load activity feed: ${queryErrors[0]?.message ?? 'unknown error'}`,
        })
      }

      const conversationItems = ((conversationResult.data ?? []) as Array<{
        id: string
        status: string
        channel: string
        started_at: string
        contacts: unknown
      }>).map((conversation) => {
        const contact = normalizeContact(conversation.contacts)
        const label =
          contact?.name?.trim() ||
          contact?.email?.trim() ||
          contact?.phone?.trim() ||
          'a visitor'

        return {
          id: `conversation:${conversation.id}`,
          type: 'conversation_started',
          title: `${conversation.channel} conversation started`,
          description: `Started with ${label}`,
          timestamp: conversation.started_at,
          href: `/inbox?conversation=${conversation.id}`,
        }
      })

      const messageItems = ((messagesResult.data ?? []) as Array<{
        id: string
        conversation_id: string
        role: string
        content: string | null
        created_at: string
      }>).map((message) => {
        const title =
          message.role === 'agent'
            ? 'Agent replied'
            : message.role === 'assistant'
              ? 'AI replied'
              : message.role === 'user'
                ? 'Customer message'
                : 'System event'

        return {
          id: `message:${message.id}`,
          type:
            message.role === 'agent'
              ? 'agent_reply'
              : message.role === 'assistant'
                ? 'ai_reply'
                : 'customer_message',
          title,
          description: previewText(message.content),
          timestamp: message.created_at,
          href: `/inbox?conversation=${message.conversation_id}`,
        }
      })

      const callItems = ((callsResult.data ?? []) as Array<{
        id: string
        status: string
        type: string | null
        duration_seconds: number | null
        created_at: string
      }>).map((call) => {
        const minutes = Math.ceil((call.duration_seconds ?? 0) / 60)

        return {
          id: `call:${call.id}`,
          type: 'call_event',
          title: call.status === 'ended' ? 'Voice call ended' : 'Voice call event',
          description:
            minutes > 0
              ? `${minutes} min ${call.type ?? 'voice'} call`
              : `${call.type ?? 'voice'} call`,
          timestamp: call.created_at,
          href: '/calls',
        }
      })

      return [...conversationItems, ...messageItems, ...callItems]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, limit)
    }),

  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'dashboard', 'Dashboard access is required.')
    const [
      subscriptionResult,
      widgetResult,
      knowledgeBaseResult,
      knowledgeChunkResult,
      emailResult,
      whatsappResult,
      conversationResult,
      chatConversationResult,
      userMessageResult,
      assistantMessageResult,
      handledResult,
      teamMemberResult,
      pendingInviteResult,
      slaPolicyResult,
      activeAiActionsResult,
    ] = await Promise.all([
      getOrgSubscription(ctx.supabase, ctx.userOrgId),

      ctx.supabase
        .from('widget_configs')
        .select('id,company_name,welcome_message,logo_url,primary_color,settings')
        .eq('org_id', ctx.userOrgId)
        .maybeSingle(),

      ctx.supabase
        .from('knowledge_bases')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .limit(1),

      ctx.supabase
        .from('kb_chunks')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .limit(1),

      ctx.supabase
        .from('email_accounts')
        .select('id,is_active')
        .eq('org_id', ctx.userOrgId)
        .maybeSingle(),

      ctx.supabase
        .from('whatsapp_accounts')
        .select('id,is_active')
        .eq('org_id', ctx.userOrgId)
        .maybeSingle(),

      ctx.supabase
        .from('conversations')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .limit(1),

      ctx.supabase
        .from('conversations')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .eq('channel', 'chat')
        .limit(1),

      ctx.supabase
        .from('messages')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .eq('role', 'user')
        .limit(1),

      ctx.supabase
        .from('messages')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .eq('role', 'assistant')
        .limit(1),

      ctx.supabase
        .from('messages')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .eq('role', 'agent')
        .limit(1),

      ctx.supabase
        .from('user_organizations')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .limit(2),

      ctx.supabase
        .from('org_invitations')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .eq('status', 'pending')
        .limit(1),

      ctx.supabase
        .from('inbox_sla_policies')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .limit(1),

      ctx.supabase
        .from('ai_actions')
        .select('id')
        .eq('org_id', ctx.userOrgId)
        .eq('is_active', true)
        .limit(1),
    ])

    const queryErrors = [
      widgetResult.error,
      knowledgeBaseResult.error,
      knowledgeChunkResult.error,
      emailResult.error,
      whatsappResult.error,
      conversationResult.error,
      chatConversationResult.error,
      userMessageResult.error,
      assistantMessageResult.error,
      handledResult.error,
      teamMemberResult.error,
      pendingInviteResult.error,
      slaPolicyResult.error,
      activeAiActionsResult.error,
    ].filter(Boolean)

    if (queryErrors.length > 0) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load onboarding status: ${queryErrors[0]?.message ?? 'unknown error'}`,
      })
    }

    const planId = subscriptionResult.planId || 'free'
    const plan = getPlan(planId)
    const canManageWidget = ctx.userPermissions.widget === true
    const canManageKnowledge = ctx.userPermissions.knowledge === true
    const canManageChannels = ctx.userPermissions.channels === true
    const canManageInbox = ctx.userPermissions.inbox === true
    const canInviteTeam = ctx.userRole === 'admin'
    const canManageActions = ctx.userRole === 'admin'
    const canUseAiActions = plan.features.aiActions === true

    const widgetData = widgetResult.data as {
      id?: string
      company_name?: string | null
      welcome_message?: string | null
      logo_url?: string | null
      primary_color?: string | null
      settings?: unknown
    } | null
    const widgetSettings = asRecord(widgetData?.settings)
    const hasWidgetRow = Boolean(widgetData?.id)
    const hasWidgetProfile = Boolean(
      widgetData?.id &&
        (
          cleanText(widgetData.company_name).length > 0 ||
          cleanText(widgetData.logo_url).length > 0 ||
          cleanText(widgetSettings.botName).length > 0 ||
          cleanText(widgetSettings.responseTimeText).length > 0 ||
          hasArrayItems(widgetSettings.suggestions) ||
          hasArrayItems(widgetSettings.helpItems) ||
          cleanText(widgetData.welcome_message) !== '' && cleanText(widgetData.welcome_message) !== 'Hi! How can we help?'
        )
    )
    const hasKnowledgeBase = hasRows(knowledgeBaseResult.data)
    const hasKnowledgeSource = hasRows(knowledgeChunkResult.data)
    const hasEmailConnected = Boolean((emailResult.data as { id: string; is_active?: boolean } | null)?.id && (emailResult.data as { is_active?: boolean } | null)?.is_active !== false)
    const hasWhatsAppConnected = Boolean(
      (whatsappResult.data as { id: string; is_active?: boolean } | null)?.id &&
        (whatsappResult.data as { is_active?: boolean } | null)?.is_active !== false
    )
    const hasAnyConversation = hasRows(conversationResult.data)
    const hasChatConversation = hasRows(chatConversationResult.data)
    const hasUserMessage = hasRows(userMessageResult.data)
    const hasAssistantMessage = hasRows(assistantMessageResult.data)
    const hasHandledConversation = hasRows(handledResult.data)
    const hasTeamMemberOrInvite =
      (teamMemberResult.data?.length ?? 0) > 1 || hasRows(pendingInviteResult.data)
    const hasSlaPolicy = hasRows(slaPolicyResult.data)
    const hasActiveAiAction = hasRows(activeAiActionsResult.data)

    const stepStatus = (completed: boolean, locked: boolean, ready: boolean) => {
      if (completed) return 'complete'
      if (locked) return 'locked'
      if (ready) return 'ready'
      return 'todo'
    }

    const steps = [
      {
        key: 'organization',
        title: 'Create organization',
        description: 'Your active workspace is created and ready for setup.',
        href: '/organizations',
        ctaLabel: 'Manage org',
        docsHref: '/docs/getting-started/workspace-setup',
        verifyLabel: 'Verify org',
        category: 'Workspace',
        completed: true,
        locked: false,
        status: 'complete',
        statusDetail: 'Active organization found.',
      },
      {
        key: 'widget_profile',
        title: 'Add widget profile',
        description: 'Set company name, assistant identity, welcome copy, theme, suggestions, or help content.',
        href: '/widget',
        ctaLabel: hasWidgetRow ? 'Customize' : 'Create profile',
        docsHref: '/docs/widget/customization',
        verifyLabel: 'Check profile',
        category: 'Widget',
        completed: hasWidgetProfile,
        locked: !canManageWidget,
        status: stepStatus(hasWidgetProfile, !canManageWidget, hasWidgetRow),
        statusDetail: hasWidgetProfile
          ? 'Widget profile has custom branding or content.'
          : hasWidgetRow
            ? 'Default widget exists. Customize it before launch.'
            : 'Create the widget profile first.',
      },
      {
        key: 'install_widget',
        title: 'Install widget',
        description: 'Place the script on a staging or production website and confirm the widget can load.',
        href: '/embedding',
        ctaLabel: 'Get script',
        docsHref: '/docs/widget/install',
        verifyLabel: 'Check install',
        category: 'Widget',
        completed: hasChatConversation,
        locked: !canManageWidget,
        status: stepStatus(hasChatConversation, !canManageWidget, hasWidgetProfile),
        statusDetail: hasChatConversation
          ? 'A chat conversation has reached this workspace.'
          : hasWidgetProfile
            ? 'Install the embed script, then send a test message.'
            : 'Complete the widget profile before installing.',
      },
      {
        key: 'knowledge_source',
        title: 'Add first knowledge source',
        description: 'Add a text note, URL, or document so AI has approved context.',
        href: '/knowledge',
        ctaLabel: hasKnowledgeBase ? 'Add source' : 'Create KB',
        docsHref: '/docs/ai/knowledge-base',
        verifyLabel: 'Check source',
        category: 'AI',
        completed: hasKnowledgeSource,
        locked: !canManageKnowledge,
        status: stepStatus(hasKnowledgeSource, !canManageKnowledge, hasKnowledgeBase),
        statusDetail: hasKnowledgeSource
          ? 'At least one knowledge source is indexed.'
          : hasKnowledgeBase
            ? 'Knowledge base exists. Add at least one source.'
            : 'Create a knowledge base and add a source.',
      },
      {
        key: 'test_ai_answer',
        title: 'Test AI answer',
        description: 'Ask a source-backed question from the widget and confirm the assistant replies correctly.',
        href: '/widget',
        ctaLabel: 'Open widget',
        docsHref: '/docs/ai/response-quality',
        verifyLabel: 'Check reply',
        category: 'AI',
        completed: hasKnowledgeSource && hasAssistantMessage,
        locked: !canManageWidget,
        status: stepStatus(hasKnowledgeSource && hasAssistantMessage, !canManageWidget, hasKnowledgeSource),
        statusDetail: hasKnowledgeSource && hasAssistantMessage
          ? 'At least one AI reply exists after knowledge setup.'
          : hasKnowledgeSource
            ? 'Ask a real test question from the widget.'
            : 'Add a knowledge source before testing AI.',
      },
      {
        key: 'email',
        title: 'Connect email channel',
        description: 'Allow customers to contact you through support email.',
        href: plan.features.emailChannel && canManageChannels ? '/email-settings' : '/billing',
        ctaLabel: plan.features.emailChannel ? 'Connect email' : 'View plans',
        docsHref: '/docs/channels/email',
        verifyLabel: 'Check email',
        category: 'Channels',
        completed: hasEmailConnected,
        locked: !canManageChannels || !plan.features.emailChannel,
        status: stepStatus(hasEmailConnected, !canManageChannels || !plan.features.emailChannel, true),
        statusDetail: hasEmailConnected
          ? 'Email account is active.'
          : !plan.features.emailChannel
            ? 'Email is available on Pro and Scale.'
            : 'Connect an active email account.',
      },
      {
        key: 'whatsapp',
        title: 'Connect WhatsApp channel',
        description: 'Enable WhatsApp support in your unified inbox.',
        href: plan.features.whatsappChannel && canManageChannels ? '/settings/channels/whatsapp' : '/billing',
        ctaLabel: plan.features.whatsappChannel ? 'Connect WhatsApp' : 'View plans',
        docsHref: '/docs/channels/whatsapp',
        verifyLabel: 'Check WhatsApp',
        category: 'Channels',
        completed: hasWhatsAppConnected,
        locked: !canManageChannels || !plan.features.whatsappChannel,
        status: stepStatus(hasWhatsAppConnected, !canManageChannels || !plan.features.whatsappChannel, true),
        statusDetail: hasWhatsAppConnected
          ? 'WhatsApp account is active.'
          : !plan.features.whatsappChannel
            ? 'WhatsApp is available on Pro and Scale.'
            : 'Connect an active WhatsApp account.',
      },
      {
        key: 'team_member',
        title: 'Invite team member',
        description: 'Invite at least one teammate or keep a pending invite ready.',
        href: '/team',
        ctaLabel: 'Invite team',
        docsHref: '/docs/admin/team-permissions',
        verifyLabel: 'Check team',
        category: 'Team',
        completed: hasTeamMemberOrInvite,
        locked: !canInviteTeam || !plan.features.teamMembers,
        status: stepStatus(hasTeamMemberOrInvite, !canInviteTeam || !plan.features.teamMembers, true),
        statusDetail: hasTeamMemberOrInvite
          ? 'Team member or pending invite found.'
          : !plan.features.teamMembers
            ? 'Team seats are available on paid plans.'
            : 'Invite one teammate before launch.',
      },
      {
        key: 'sla',
        title: 'Configure SLA',
        description: 'Create SLA targets so backlog, risk, and breached conversations are measurable.',
        href: '/inbox',
        ctaLabel: 'Open inbox',
        docsHref: '/docs/inbox/sla-backlog',
        verifyLabel: 'Check SLA',
        category: 'Operations',
        completed: hasSlaPolicy,
        locked: !canManageInbox,
        status: stepStatus(hasSlaPolicy, !canManageInbox, true),
        statusDetail: hasSlaPolicy
          ? 'SLA policy is configured.'
          : 'Create or seed the default SLA policy before launch.',
      },
      {
        key: 'ai_action',
        title: 'Create first AI action',
        description: 'Add one safe read action, such as order lookup or account status.',
        href: canUseAiActions ? '/ai-actions' : '/billing',
        ctaLabel: canUseAiActions ? 'Create action' : 'View plans',
        docsHref: '/docs/ai/actions-v1',
        verifyLabel: 'Check action',
        category: 'Automation',
        completed: hasActiveAiAction,
        locked: !canManageActions || !canUseAiActions,
        status: stepStatus(hasActiveAiAction, !canManageActions || !canUseAiActions, hasKnowledgeSource),
        statusDetail: hasActiveAiAction
          ? 'Active AI action found.'
          : !canUseAiActions
            ? 'AI Actions are preview-only on Free and Starter. Upgrade to Pro to save and run actions.'
          : hasKnowledgeSource
            ? 'Create a read-only test action first.'
            : 'Add knowledge first, then create a safe action.',
      },
      {
        key: 'test_conversation',
        title: 'Send test conversation',
        description: 'Send a visitor message, confirm realtime inbox delivery, and reply as an agent.',
        href: hasAnyConversation ? '/inbox' : '/widget',
        ctaLabel: hasAnyConversation ? 'Open test' : 'Start test',
        docsHref: '/docs/widget/testing',
        verifyLabel: 'Check test',
        category: 'QA',
        completed: hasUserMessage && hasHandledConversation,
        locked: false,
        status: stepStatus(hasUserMessage && hasHandledConversation, false, hasWidgetProfile),
        statusDetail: hasUserMessage && hasHandledConversation
          ? 'Visitor message and agent reply found.'
          : hasUserMessage
            ? 'Visitor message found. Reply once from the inbox.'
            : 'Send a widget test message to verify realtime flow.',
      },
    ]

    const availableSteps = steps.filter((step) => !step.locked)
    const completedSteps = availableSteps.filter((step) => step.completed).length
    const completionPercent =
      availableSteps.length === 0
        ? 100
        : Math.round((completedSteps / availableSteps.length) * 100)
    const nextStep = availableSteps.find((step) => !step.completed) ?? null

    return {
      planId,
      completionPercent,
      totalSteps: availableSteps.length,
      completedSteps,
      nextStep,
      steps,
      channels: {
        emailConnected: hasEmailConnected,
        whatsappConnected: hasWhatsAppConnected,
      },
      hasAnyConversation,
      handledConversation: hasHandledConversation,
    }
  }),
})

import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { getPlan } from '../lib/plans'
import { getOrgSubscription } from '../lib/subscriptions'
import { protectedProcedure, router } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'
import { deriveInboxSla } from '../lib/inbox-metrics'

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

function toCount(value: { count: number | null } | null): number {
  return value?.count ?? 0
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

export const dashboardRouter = router({
  getHomeOverview: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'dashboard', 'Dashboard access is required.')
      const orgId = ctx.userOrgId
      const period = (input?.period ?? '7d') as DashboardPeriod
      const { currentStartIso, currentEndIso, prevStartIso } =
        getPeriodBounds(period)

      const [
        openConversationsResult,
        pendingConversationsResult,
        totalContactsResult,
        currentContactsResult,
        prevContactsResult,
        currentResolvedResult,
        prevResolvedResult,
        currentConversationsResult,
        currentAiMessagesResult,
        currentAgentMessagesResult,
        prevAiMessagesResult,
        prevAgentMessagesResult,
        activeConversationsDetailResult,
        currentCallsResult,
        activeCallsResult,
        knowledgeBaseResult,
        activeAiActionsResult,
        currentActionLogsResult,
        currentSuccessfulActionLogsResult,
      ] = await Promise.all([
        ctx.supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['bot', 'pending', 'open']),

        ctx.supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'pending'),

        ctx.supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId),

        ctx.supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', currentStartIso)
          .lt('created_at', currentEndIso),

        ctx.supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', prevStartIso)
          .lt('created_at', currentStartIso),

        ctx.supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['resolved', 'closed'])
          .gte('started_at', currentStartIso)
          .lt('started_at', currentEndIso),

        ctx.supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['resolved', 'closed'])
          .gte('started_at', prevStartIso)
          .lt('started_at', currentStartIso),

        ctx.supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('started_at', currentStartIso)
          .lt('started_at', currentEndIso),

        ctx.supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('role', 'assistant')
          .gte('created_at', currentStartIso)
          .lt('created_at', currentEndIso),

        ctx.supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('role', 'agent')
          .gte('created_at', currentStartIso)
          .lt('created_at', currentEndIso),

        ctx.supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('role', 'assistant')
          .gte('created_at', prevStartIso)
          .lt('created_at', currentStartIso),

        ctx.supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('role', 'agent')
          .gte('created_at', prevStartIso)
          .lt('created_at', currentStartIso),

        ctx.supabase
          .from('conversations')
          .select('id,status,queue_state,channel,assigned_to,started_at,queue_entered_at,resolved_at,first_response_due_at,next_response_due_at,resolution_due_at,first_response_at,last_customer_message_at,last_agent_reply_at')
          .eq('org_id', orgId)
          .in('status', ['bot', 'pending', 'open'])
          .limit(1000),

        ctx.supabase
          .from('calls')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', currentStartIso)
          .lt('created_at', currentEndIso),

        ctx.supabase
          .from('calls')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['created', 'queued', 'ringing', 'in-progress', 'active', 'started']),

        ctx.supabase
          .from('knowledge_bases')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId),

        ctx.supabase
          .from('ai_actions')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('is_active', true),

        ctx.supabase
          .from('ai_action_logs')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', currentStartIso)
          .lt('created_at', currentEndIso),

        ctx.supabase
          .from('ai_action_logs')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'success')
          .gte('created_at', currentStartIso)
          .lt('created_at', currentEndIso),
      ])

      const queryErrors = [
        openConversationsResult.error,
        pendingConversationsResult.error,
        totalContactsResult.error,
        currentContactsResult.error,
        prevContactsResult.error,
        currentResolvedResult.error,
        prevResolvedResult.error,
        currentConversationsResult.error,
        currentAiMessagesResult.error,
        currentAgentMessagesResult.error,
        prevAiMessagesResult.error,
        prevAgentMessagesResult.error,
        activeConversationsDetailResult.error,
        currentCallsResult.error,
        activeCallsResult.error,
        knowledgeBaseResult.error,
        activeAiActionsResult.error,
        currentActionLogsResult.error,
        currentSuccessfulActionLogsResult.error,
      ].filter(Boolean)

      if (queryErrors.length > 0) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load dashboard overview: ${queryErrors[0]?.message ?? 'unknown error'}`,
        })
      }

      const openConversations = toCount(openConversationsResult)
      const pendingConversations = toCount(pendingConversationsResult)
      const totalContacts = toCount(totalContactsResult)
      const currentContacts = toCount(currentContactsResult)
      const prevContacts = toCount(prevContactsResult)
      const currentResolved = toCount(currentResolvedResult)
      const prevResolved = toCount(prevResolvedResult)
      const currentConversations = toCount(currentConversationsResult)
      const currentAiMessages = toCount(currentAiMessagesResult)
      const currentAgentMessages = toCount(currentAgentMessagesResult)
      const prevAiMessages = toCount(prevAiMessagesResult)
      const prevAgentMessages = toCount(prevAgentMessagesResult)
      const currentCalls = toCount(currentCallsResult)
      const activeCalls = toCount(activeCallsResult)
      const knowledgeBaseCount = toCount(knowledgeBaseResult)
      const activeAiActions = toCount(activeAiActionsResult)
      const currentActionLogs = toCount(currentActionLogsResult)
      const currentSuccessfulActionLogs = toCount(currentSuccessfulActionLogsResult)

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

      const activeConversationRows =
        (activeConversationsDetailResult.data as Array<{
          id: string
          status: string
          queue_state: string | null
          channel: string | null
          assigned_to: string | null
          started_at: string | null
          queue_entered_at: string | null
          resolved_at: string | null
          first_response_due_at: string | null
          next_response_due_at: string | null
          resolution_due_at: string | null
          first_response_at: string | null
          last_customer_message_at: string | null
          last_agent_reply_at: string | null
        }> | null) ?? []

      const now = new Date()
      const queueBreakdown = {
        bot: 0,
        pending: 0,
        open: 0,
        unassigned: 0,
        assigned: 0,
        slaAtRisk: 0,
        slaBreached: 0,
      }
      const channelBreakdown = {
        chat: 0,
        email: 0,
        whatsapp: 0,
        voice: 0,
      }

      for (const row of activeConversationRows) {
        if (row.status === 'bot') queueBreakdown.bot += 1
        if (row.status === 'pending') queueBreakdown.pending += 1
        if (row.status === 'open') queueBreakdown.open += 1
        if (row.assigned_to) queueBreakdown.assigned += 1
        else queueBreakdown.unassigned += 1

        const channel = row.channel === 'email' || row.channel === 'whatsapp' || row.channel === 'voice'
          ? row.channel
          : 'chat'
        channelBreakdown[channel] += 1

        const sla = deriveInboxSla(row, now.getTime())
        if (sla.slaState === 'breached' && sla.slaIsLive) {
          queueBreakdown.slaBreached += 1
        } else if (sla.slaState === 'at_risk' && sla.slaIsLive) {
          queueBreakdown.slaAtRisk += 1
        }
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
          totalActive: activeConversationRows.length,
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

      const conversationsResult = await ctx.supabase
        .from('conversations')
        .select(
          'id,status,channel,started_at,assigned_to,contact_id,contacts(name,email,phone)'
        )
        .eq('org_id', ctx.userOrgId)
        .order('started_at', { ascending: false })
        .limit(limit)

      if (conversationsResult.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load recent conversations: ${conversationsResult.error.message}`,
        })
      }

      const conversations =
        (conversationsResult.data as Array<{
          id: string
          status: string
          channel: string
          started_at: string
          assigned_to: string | null
          contacts: unknown
        }> | null) ?? []

      const conversationIds = conversations.map((conversation) => conversation.id)
      if (conversationIds.length === 0) return []

      const [messagesResult, emailResult] = await Promise.all([
        ctx.supabase
          .from('messages')
          .select('conversation_id,role,content,created_at')
          .eq('org_id', ctx.userOrgId)
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .limit(200),

        ctx.supabase
          .from('email_messages')
          .select('conversation_id,subject,created_at')
          .eq('org_id', ctx.userOrgId)
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (messagesResult.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load conversation previews: ${messagesResult.error.message}`,
        })
      }
      if (emailResult.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load email previews: ${emailResult.error.message}`,
        })
      }

      const latestMessageByConversation = new Map<
        string,
        { role: string; content: string | null; created_at: string }
      >()
      const latestEmailByConversation = new Map<string, string>()

      for (const row of (messagesResult.data ?? []) as Array<{
        conversation_id: string
        role: string
        content: string | null
        created_at: string
      }>) {
        if (!latestMessageByConversation.has(row.conversation_id)) {
          latestMessageByConversation.set(row.conversation_id, row)
        }
      }

      for (const row of (emailResult.data ?? []) as Array<{
        conversation_id: string
        subject: string
      }>) {
        if (!latestEmailByConversation.has(row.conversation_id)) {
          latestEmailByConversation.set(row.conversation_id, row.subject)
        }
      }

      return conversations.map((conversation) => {
        const contact = normalizeContact(conversation.contacts)
        const contactName =
          contact?.name?.trim() ||
          contact?.email?.trim() ||
          contact?.phone?.trim() ||
          'Anonymous'
        const contactValue = contact?.email?.trim() || contact?.phone?.trim() || null
        const latestMessage = latestMessageByConversation.get(conversation.id)
        const latestEmailSubject = latestEmailByConversation.get(conversation.id)

        const preview =
          conversation.channel === 'email'
            ? previewText(latestEmailSubject ?? latestMessage?.content)
            : previewText(latestMessage?.content)

        return {
          id: conversation.id,
          channel: conversation.channel,
          status:
            conversation.status === 'closed' ? 'resolved' : conversation.status,
          startedAt: conversation.started_at,
          contactName,
          contactValue,
          previewText: preview,
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
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId),

      ctx.supabase
        .from('kb_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId),

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
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId),

      ctx.supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId)
        .eq('channel', 'chat'),

      ctx.supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId)
        .eq('role', 'user'),

      ctx.supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId)
        .eq('role', 'assistant'),

      ctx.supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId)
        .eq('role', 'agent'),

      ctx.supabase
        .from('user_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId),

      ctx.supabase
        .from('org_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId)
        .eq('status', 'pending'),

      ctx.supabase
        .from('inbox_sla_policies')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId),

      ctx.supabase
        .from('ai_actions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId)
        .eq('is_active', true),
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
    const hasKnowledgeBase = toCount(knowledgeBaseResult) > 0
    const hasKnowledgeSource = toCount(knowledgeChunkResult) > 0
    const hasEmailConnected = Boolean((emailResult.data as { id: string; is_active?: boolean } | null)?.id && (emailResult.data as { is_active?: boolean } | null)?.is_active !== false)
    const hasWhatsAppConnected = Boolean(
      (whatsappResult.data as { id: string; is_active?: boolean } | null)?.id &&
        (whatsappResult.data as { is_active?: boolean } | null)?.is_active !== false
    )
    const hasAnyConversation = toCount(conversationResult) > 0
    const hasChatConversation = toCount(chatConversationResult) > 0
    const hasUserMessage = toCount(userMessageResult) > 0
    const hasAssistantMessage = toCount(assistantMessageResult) > 0
    const hasHandledConversation = toCount(handledResult) > 0
    const hasTeamMemberOrInvite =
      toCount(teamMemberResult) > 1 || toCount(pendingInviteResult) > 0
    const hasSlaPolicy = toCount(slaPolicyResult) > 0
    const hasActiveAiAction = toCount(activeAiActionsResult) > 0

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
          ? `${toCount(knowledgeChunkResult)} knowledge chunks indexed.`
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
          ? `${toCount(slaPolicyResult)} SLA policy row found.`
          : 'Create or seed the default SLA policy before launch.',
      },
      {
        key: 'ai_action',
        title: 'Create first AI action',
        description: 'Add one safe read action, such as order lookup or account status.',
        href: '/ai-actions',
        ctaLabel: 'Create action',
        docsHref: '/docs/ai/actions-v1',
        verifyLabel: 'Check action',
        category: 'Automation',
        completed: hasActiveAiAction,
        locked: !canManageActions,
        status: stepStatus(hasActiveAiAction, !canManageActions, hasKnowledgeSource),
        statusDetail: hasActiveAiAction
          ? 'Active AI action found.'
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

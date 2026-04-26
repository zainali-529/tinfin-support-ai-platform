import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { getPlan } from '../lib/plans'
import { protectedProcedure, router } from '../trpc/trpc'

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

export const dashboardRouter = router({
  getHomeOverview: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
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
        },
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
    const [
      subscriptionResult,
      widgetResult,
      knowledgeResult,
      emailResult,
      whatsappResult,
      conversationResult,
      handledResult,
    ] = await Promise.all([
      ctx.supabase
        .from('subscriptions')
        .select('plan')
        .eq('org_id', ctx.userOrgId)
        .maybeSingle(),

      ctx.supabase
        .from('widget_configs')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId),

      ctx.supabase
        .from('knowledge_bases')
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
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.userOrgId)
        .eq('role', 'agent'),
    ])

    const queryErrors = [
      subscriptionResult.error,
      widgetResult.error,
      knowledgeResult.error,
      emailResult.error,
      whatsappResult.error,
      conversationResult.error,
      handledResult.error,
    ].filter(Boolean)

    if (queryErrors.length > 0) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load onboarding status: ${queryErrors[0]?.message ?? 'unknown error'}`,
      })
    }

    const planId =
      ((subscriptionResult.data as { plan?: string } | null)?.plan ?? 'free') ||
      'free'
    const plan = getPlan(planId)
    const isAdmin = ctx.userRole === 'admin'

    const hasWidget = toCount(widgetResult) > 0
    const hasKnowledgeBase = toCount(knowledgeResult) > 0
    const hasEmailConnected = Boolean((emailResult.data as { id: string } | null)?.id)
    const hasWhatsAppConnected = Boolean(
      (whatsappResult.data as { id: string } | null)?.id
    )
    const hasAnyConversation = toCount(conversationResult) > 0
    const hasHandledConversation = toCount(handledResult) > 0

    const steps = [
      {
        key: 'widget',
        title: 'Install chat widget',
        description: 'Enable your website widget to start receiving messages.',
        href: '/widget',
        completed: hasWidget,
        locked: !isAdmin,
      },
      {
        key: 'knowledge',
        title: 'Add knowledge base',
        description: 'Upload docs so AI can answer with your product context.',
        href: '/knowledge',
        completed: hasKnowledgeBase,
        locked: false,
      },
      {
        key: 'email',
        title: 'Connect email channel',
        description: 'Allow customers to contact you through support email.',
        href: '/settings/channels',
        completed: hasEmailConnected,
        locked: !isAdmin || !plan.features.emailChannel,
      },
      {
        key: 'whatsapp',
        title: 'Connect WhatsApp channel',
        description: 'Enable WhatsApp support in your unified inbox.',
        href: '/settings/channels/whatsapp',
        completed: hasWhatsAppConnected,
        locked: !isAdmin || !plan.features.whatsappChannel,
      },
      {
        key: 'first_conversation',
        title: 'Handle first conversation',
        description: 'Reply as an agent and close your first support thread.',
        href: '/inbox',
        completed: hasHandledConversation,
        locked: false,
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

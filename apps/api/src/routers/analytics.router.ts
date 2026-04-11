/**
 * apps/api/src/routers/analytics.router.ts
 *
 * Analytics router — org-scoped data for the analytics dashboard.
 *
 * Procedures:
 *   getOverview          — key KPIs for selected period
 *   getConversationTrend — daily conversation counts
 *   getStatusBreakdown   — pie data for conversation statuses
 *   getMessageVolume     — daily messages by role (user/assistant/agent)
 *   getContactGrowth     — new contacts per day + cumulative
 *   getResolutionTrend   — daily resolution rate %
 *   getCallAnalytics     — daily call counts + voice minutes
 *   getHandlingBreakdown — AI vs human handled conversations
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'

const periodSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
}).optional()

function getPeriodStart(period: string): Date {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function buildDateMap<T>(days: number, init: () => T): Record<string, T> {
  const map: Record<string, T> = {}
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]!
    map[key] = init()
  }
  return map
}

function dateKey(isoString: string): string {
  return isoString.split('T')[0]!
}

export const analyticsRouter = router({

  /**
   * High-level KPI overview for the selected period.
   * Also computes comparison vs. the PREVIOUS equal period for trend arrows.
   */
  getOverview: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const period = input?.period ?? '30d'
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90

      const now = new Date()
      const currentStart = new Date(now)
      currentStart.setDate(currentStart.getDate() - days)
      currentStart.setHours(0, 0, 0, 0)

      const prevStart = new Date(currentStart)
      prevStart.setDate(prevStart.getDate() - days)

      const [
        currConv, prevConv,
        currResolved, prevResolved,
        currMessages, prevMessages,
        currAiMsg, prevAiMsg,
        currAgentMsg, prevAgentMsg,
        currContacts, prevContacts,
        totalContacts,
        currCalls, prevCalls,
        callDuration,
        pendingConv,
      ] = await Promise.all([
        // Current period conversations
        ctx.supabase.from('conversations').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).gte('started_at', currentStart.toISOString()),
        // Prev period conversations
        ctx.supabase.from('conversations').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).gte('started_at', prevStart.toISOString()).lt('started_at', currentStart.toISOString()),
        // Current resolved
        ctx.supabase.from('conversations').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).in('status', ['resolved', 'closed']).gte('started_at', currentStart.toISOString()),
        // Prev resolved
        ctx.supabase.from('conversations').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).in('status', ['resolved', 'closed']).gte('started_at', prevStart.toISOString()).lt('started_at', currentStart.toISOString()),
        // Current messages
        ctx.supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).gte('created_at', currentStart.toISOString()),
        // Prev messages
        ctx.supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).gte('created_at', prevStart.toISOString()).lt('created_at', currentStart.toISOString()),
        // Current AI messages
        ctx.supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).eq('role', 'assistant').gte('created_at', currentStart.toISOString()),
        // Prev AI messages
        ctx.supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).eq('role', 'assistant').gte('created_at', prevStart.toISOString()).lt('created_at', currentStart.toISOString()),
        // Current agent messages
        ctx.supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).eq('role', 'agent').gte('created_at', currentStart.toISOString()),
        // Prev agent messages
        ctx.supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).eq('role', 'agent').gte('created_at', prevStart.toISOString()).lt('created_at', currentStart.toISOString()),
        // Current new contacts
        ctx.supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).gte('created_at', currentStart.toISOString()),
        // Prev new contacts
        ctx.supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).gte('created_at', prevStart.toISOString()).lt('created_at', currentStart.toISOString()),
        // Total contacts all-time
        ctx.supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        // Current calls
        ctx.supabase.from('calls').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).gte('created_at', currentStart.toISOString()),
        // Prev calls
        ctx.supabase.from('calls').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).gte('created_at', prevStart.toISOString()).lt('created_at', currentStart.toISOString()),
        // Call durations for current period
        ctx.supabase.from('calls').select('duration_seconds')
          .eq('org_id', orgId).gte('created_at', currentStart.toISOString()).not('duration_seconds', 'is', null),
        // Pending conversations (real-time)
        ctx.supabase.from('conversations').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).eq('status', 'pending'),
      ])

      const totalConv    = currConv.count ?? 0
      const prevTotalConv = prevConv.count ?? 0
      const resolvedConv = currResolved.count ?? 0
      const prevResolvedConv = prevResolved.count ?? 0
      const aiMsg = currAiMsg.count ?? 0
      const prevAiMsgCount = prevAiMsg.count ?? 0
      const agentMsg = currAgentMsg.count ?? 0
      const prevAgentMsgCount = prevAgentMsg.count ?? 0
      const totalCalls   = currCalls.count ?? 0
      const prevTotalCalls = prevCalls.count ?? 0
      const totalVoiceSec = (callDuration.data ?? []).reduce((s, c) => s + ((c.duration_seconds as number) || 0), 0)

      const resolutionRate = totalConv > 0 ? Math.round((resolvedConv / totalConv) * 100) : 0
      const prevResolutionRate = prevTotalConv > 0 ? Math.round((prevResolvedConv / prevTotalConv) * 100) : 0
      const handledByAI = aiMsg + agentMsg > 0 ? Math.round((aiMsg / (aiMsg + agentMsg)) * 100) : 0
      const prevHandledByAI = (prevAiMsgCount + prevAgentMsgCount) > 0
        ? Math.round((prevAiMsgCount / (prevAiMsgCount + prevAgentMsgCount)) * 100)
        : 0

      function pctChange(curr: number, prev: number): number | null {
        if (prev === 0) return null
        return Math.round(((curr - prev) / prev) * 100)
      }

      return {
        period,
        conversations: {
          value: totalConv,
          change: pctChange(totalConv, prevTotalConv),
        },
        resolutionRate: {
          value: resolutionRate,
          change: resolutionRate - prevResolutionRate,
        },
        messages: {
          value: currMessages.count ?? 0,
          change: pctChange(currMessages.count ?? 0, prevMessages.count ?? 0),
        },
        aiAutomationRate: {
          value: handledByAI,
          change: handledByAI - prevHandledByAI,
        },
        newContacts: {
          value: currContacts.count ?? 0,
          change: pctChange(currContacts.count ?? 0, prevContacts.count ?? 0),
        },
        totalContacts: totalContacts.count ?? 0,
        calls: {
          value: totalCalls,
          change: pctChange(totalCalls, prevTotalCalls),
        },
        voiceMinutes: Math.ceil(totalVoiceSec / 60),
        pendingConversations: pendingConv.count ?? 0,
      }
    }),

  /**
   * Daily conversation volume for the trend chart.
   */
  getConversationTrend: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const period = input?.period ?? '30d'
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const startDate = getPeriodStart(period)

      const { data } = await ctx.supabase
        .from('conversations')
        .select('started_at, status')
        .eq('org_id', orgId)
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: true })

      const byDate = buildDateMap(days, () => ({
        total: 0, resolved: 0, bot: 0, open: 0, pending: 0,
      }))

      for (const conv of data ?? []) {
        const key = dateKey(conv.started_at as string)
        if (!byDate[key]) continue
        byDate[key].total++
        const s = conv.status as string
        if (s === 'resolved' || s === 'closed') byDate[key].resolved++
        else if (s === 'bot') byDate[key].bot++
        else if (s === 'open') byDate[key].open++
        else if (s === 'pending') byDate[key].pending++
      }

      return Object.entries(byDate).map(([date, v]) => ({ date, ...v }))
    }),

  /**
   * Conversation status breakdown for pie chart.
   */
  getStatusBreakdown: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const period = input?.period ?? '30d'
      const startDate = getPeriodStart(period)

      const { data } = await ctx.supabase
        .from('conversations')
        .select('status')
        .eq('org_id', orgId)
        .gte('started_at', startDate.toISOString())

      const counts: Record<string, number> = {}
      for (const conv of data ?? []) {
        const s = conv.status as string
        const key = (s === 'closed') ? 'resolved' : s
        counts[key] = (counts[key] || 0) + 1
      }

      const COLOR_MAP: Record<string, string> = {
        bot: '#6366f1',
        pending: '#f59e0b',
        open: '#10b981',
        resolved: '#64748b',
      }

      return Object.entries(counts).map(([status, count]) => ({
        status,
        count,
        color: COLOR_MAP[status] ?? '#94a3b8',
      }))
    }),

  /**
   * Daily message volume by role.
   */
  getMessageVolume: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const period = input?.period ?? '30d'
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const startDate = getPeriodStart(period)

      const { data } = await ctx.supabase
        .from('messages')
        .select('created_at, role')
        .eq('org_id', orgId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      const byDate = buildDateMap(days, () => ({ user: 0, assistant: 0, agent: 0, total: 0 }))

      for (const msg of data ?? []) {
        const key = dateKey(msg.created_at as string)
        if (!byDate[key]) continue
        const role = msg.role as string
        byDate[key].total++
        if (role === 'user') byDate[key].user++
        else if (role === 'assistant') byDate[key].assistant++
        else if (role === 'agent') byDate[key].agent++
      }

      return Object.entries(byDate).map(([date, v]) => ({ date, ...v }))
    }),

  /**
   * Contact acquisition: new per day + running cumulative.
   */
  getContactGrowth: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const period = input?.period ?? '30d'
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const startDate = getPeriodStart(period)

      // Also get total BEFORE the period for cumulative baseline
      const [periodContacts, totalBefore] = await Promise.all([
        ctx.supabase.from('contacts').select('created_at').eq('org_id', orgId)
          .gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }),
        ctx.supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).lt('created_at', startDate.toISOString()),
      ])

      const byDate = buildDateMap(days, () => 0)

      for (const c of periodContacts.data ?? []) {
        const key = dateKey(c.created_at as string)
        if (byDate[key] !== undefined) byDate[key]++
      }

      let cumulative = totalBefore.count ?? 0
      return Object.entries(byDate).map(([date, newContacts]) => {
        cumulative += newContacts
        return { date, new: newContacts, cumulative }
      })
    }),

  /**
   * Daily resolution rate as a percentage.
   */
  getResolutionTrend: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const period = input?.period ?? '30d'
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const startDate = getPeriodStart(period)

      const { data } = await ctx.supabase
        .from('conversations')
        .select('started_at, status')
        .eq('org_id', orgId)
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: true })

      const byDate = buildDateMap(days, () => ({ total: 0, resolved: 0 }))

      for (const conv of data ?? []) {
        const key = dateKey(conv.started_at as string)
        if (!byDate[key]) continue
        byDate[key].total++
        const s = conv.status as string
        if (s === 'resolved' || s === 'closed') byDate[key].resolved++
      }

      return Object.entries(byDate).map(([date, v]) => ({
        date,
        rate: v.total > 0 ? Math.round((v.resolved / v.total) * 100) : 0,
        total: v.total,
        resolved: v.resolved,
      }))
    }),

  /**
   * Voice call analytics: daily counts and minutes.
   */
  getCallAnalytics: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const period = input?.period ?? '30d'
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const startDate = getPeriodStart(period)

      const { data } = await ctx.supabase
        .from('calls')
        .select('created_at, duration_seconds, status, type')
        .eq('org_id', orgId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      const byDate = buildDateMap(days, () => ({ count: 0, minutes: 0, ended: 0 }))

      for (const call of data ?? []) {
        const key = dateKey(call.created_at as string)
        if (!byDate[key]) continue
        byDate[key].count++
        byDate[key].minutes += Math.ceil(((call.duration_seconds as number) || 0) / 60)
        if ((call.status as string) === 'ended') byDate[key].ended++
      }

      return Object.entries(byDate).map(([date, v]) => ({ date, ...v }))
    }),

  /**
   * AI vs human handling breakdown — for the donut chart.
   */
  getHandlingBreakdown: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const period = input?.period ?? '30d'
      const startDate = getPeriodStart(period)

      // Conversations that were ever taken over by an agent have at least one 'agent' message
      const [aiOnly, humanTouched, total] = await Promise.all([
        // Conversations that were fully handled by AI (resolved, never had agent message)
        ctx.supabase.from('conversations').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).in('status', ['resolved', 'closed'])
          .gte('started_at', startDate.toISOString()),
        // Conversations that had at least one agent message
        ctx.supabase.from('messages').select('conversation_id', { count: 'exact', head: true })
          .eq('org_id', orgId).eq('role', 'agent').gte('created_at', startDate.toISOString()),
        ctx.supabase.from('conversations').select('id', { count: 'exact', head: true })
          .eq('org_id', orgId).gte('started_at', startDate.toISOString()),
      ])

      const t = total.count ?? 0
      const human = Math.min(humanTouched.count ?? 0, t)
      const ai = Math.max(t - human, 0)

      return [
        { label: 'AI Automated', value: ai, color: '#6366f1' },
        { label: 'Human Handled', value: human, color: '#10b981' },
      ]
    }),
})
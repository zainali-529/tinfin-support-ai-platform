import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'

const periodSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
}).optional()

type AnalyticsPeriod = '7d' | '30d' | '90d'
type ChecklistStatus = 'pass' | 'warn' | 'fail' | 'manual'
type SlaState = 'on_track' | 'at_risk' | 'breached' | 'met' | 'unknown'

type ConversationRow = Record<string, unknown> & {
  id: string
  status?: string | null
  channel?: string | null
  started_at?: string | null
  resolved_at?: string | null
  assigned_to?: string | null
  queue_state?: string | null
  queue_entered_at?: string | null
  first_response_due_at?: string | null
  next_response_due_at?: string | null
  resolution_due_at?: string | null
  first_response_at?: string | null
  last_customer_message_at?: string | null
  last_agent_reply_at?: string | null
  contacts?: unknown
}

type MessageRow = Record<string, unknown> & {
  conversation_id?: string | null
  role?: string | null
  created_at?: string | null
  ai_metadata?: unknown
}

type ActionLogRow = Record<string, unknown> & {
  id?: string | null
  action_id?: string | null
  status?: string | null
  request_payload?: unknown
  error_message?: string | null
  created_at?: string | null
  executed_at?: string | null
  duration_ms?: number | null
  status_code?: number | null
  retry_count?: number | null
  ai_actions?: unknown
}

type UserRow = Record<string, unknown> & {
  id?: string | null
  name?: string | null
  email?: string | null
  role?: string | null
  is_online?: boolean | null
}

function periodDays(period: AnalyticsPeriod): number {
  return period === '7d' ? 7 : period === '90d' ? 90 : 30
}

function startOfToday(): Date {
  const value = new Date()
  value.setHours(0, 0, 0, 0)
  return value
}

function getWindow(period: AnalyticsPeriod) {
  const days = periodDays(period)
  const currentStart = startOfToday()
  currentStart.setDate(currentStart.getDate() - days + 1)
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - days)
  const previousEnd = new Date(currentStart)
  return { days, currentStart, previousStart, previousEnd, now: new Date() }
}

function dateKey(value: string | null | undefined): string {
  return value?.split('T')[0] ?? ''
}

function buildDateMap<T>(days: number, init: () => T): Record<string, T> {
  const output: Record<string, T> = {}
  const base = startOfToday()
  for (let i = days - 1; i >= 0; i--) {
    const next = new Date(base)
    next.setDate(next.getDate() - i)
    output[dateKey(next.toISOString())] = init()
  }
  return output
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next ? next : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toMs(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function secondsBetween(start: unknown, end: unknown): number | null {
  const startMs = toMs(start)
  const endMs = toMs(end)
  if (startMs === null || endMs === null || endMs < startMs) return null
  return Math.round((endMs - startMs) / 1000)
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) return null
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
}

function percentile(values: Array<number | null | undefined>, pct: number): number | null {
  const valid = values
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b)
  if (valid.length === 0) return null
  const index = Math.max(0, Math.min(valid.length - 1, Math.ceil((pct / 100) * valid.length) - 1))
  return valid[index] ?? null
}

function percent(part: number, total: number, precision = 0): number {
  if (total <= 0) return 0
  return Number(((part / total) * 100).toFixed(precision))
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function normalizeStatus(value: unknown): string {
  const status = asString(value)?.toLowerCase() ?? 'unknown'
  return status === 'closed' ? 'resolved' : status
}

function normalizeQueueState(status: string, explicit: unknown): string {
  const queueState = asString(explicit)
  if (queueState) return queueState
  if (status === 'resolved') return 'resolved'
  if (status === 'bot') return 'bot'
  if (status === 'open') return 'in_progress'
  return 'queued'
}

function normalizeContact(value: unknown): { name: string | null; email: string | null } | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  const contact = asRecord(row)
  return { name: asString(contact.name), email: asString(contact.email) }
}

function normalizeAction(value: unknown): { name: string | null; displayName: string | null } {
  const row = Array.isArray(value) ? value[0] : value
  const action = asRecord(row)
  return { name: asString(action.name), displayName: asString(action.display_name) }
}

function deriveBacklogMinutes(row: ConversationRow, nowMs: number): number | null {
  const status = normalizeStatus(row.status)
  const queue = normalizeQueueState(status, row.queue_state)
  if (queue !== 'queued' && queue !== 'assigned' && queue !== 'in_progress') return null

  const lastCustomerMs = toMs(row.last_customer_message_at)
  const lastAgentMs = toMs(row.last_agent_reply_at)
  const waitingOnAgent = lastCustomerMs !== null && (lastAgentMs === null || lastCustomerMs > lastAgentMs)
  if (queue === 'in_progress' && !waitingOnAgent) return null

  const startMs = queue === 'in_progress'
    ? lastCustomerMs ?? toMs(row.queue_entered_at) ?? toMs(row.started_at)
    : toMs(row.queue_entered_at) ?? lastCustomerMs ?? toMs(row.started_at)
  if (startMs === null) return null
  return Math.max(0, Math.floor((nowMs - startMs) / 60000))
}

function backlogState(minutes: number | null): 'fresh' | 'watch' | 'stale' | 'critical' | 'unknown' {
  if (minutes === null) return 'unknown'
  if (minutes <= 15) return 'fresh'
  if (minutes <= 45) return 'watch'
  if (minutes <= 120) return 'stale'
  return 'critical'
}

function deriveSla(row: ConversationRow, nowMs: number): {
  state: SlaState
  targetAt: string | null
  remainingSeconds: number | null
} {
  const status = normalizeStatus(row.status)

  if (status === 'resolved') {
    const dueMs = toMs(row.resolution_due_at)
    const resolvedMs = toMs(row.resolved_at)
    if (dueMs === null || resolvedMs === null) {
      return { state: 'unknown', targetAt: row.resolution_due_at ?? null, remainingSeconds: null }
    }
    return {
      state: resolvedMs <= dueMs ? 'met' : 'breached',
      targetAt: row.resolution_due_at ?? null,
      remainingSeconds: Math.floor((dueMs - resolvedMs) / 1000),
    }
  }

  if (!row.first_response_at) {
    const dueMs = toMs(row.first_response_due_at)
    if (dueMs === null) {
      return { state: 'unknown', targetAt: row.first_response_due_at ?? null, remainingSeconds: null }
    }
    const remainingSeconds = Math.floor((dueMs - nowMs) / 1000)
    return {
      state: remainingSeconds <= 0 ? 'breached' : remainingSeconds <= 300 ? 'at_risk' : 'on_track',
      targetAt: row.first_response_due_at ?? null,
      remainingSeconds,
    }
  }

  const lastCustomerMs = toMs(row.last_customer_message_at)
  const lastAgentMs = toMs(row.last_agent_reply_at)
  const waitingOnAgent = lastCustomerMs !== null && (lastAgentMs === null || lastCustomerMs > lastAgentMs)
  const targetAt = waitingOnAgent ? row.next_response_due_at : row.resolution_due_at
  const targetMs = toMs(targetAt)
  if (targetMs === null) return { state: 'unknown', targetAt: targetAt ?? null, remainingSeconds: null }
  const remainingSeconds = Math.floor((targetMs - nowMs) / 1000)
  return {
    state: remainingSeconds <= 0 ? 'breached' : remainingSeconds <= 300 ? 'at_risk' : 'on_track',
    targetAt: targetAt ?? null,
    remainingSeconds,
  }
}

function actionDurationMs(log: ActionLogRow): number | null {
  const direct = asNumber(log.duration_ms)
  if (direct !== null) return direct
  const payloadDuration = asNumber(asRecord(log.request_payload).durationMs)
  if (payloadDuration !== null) return payloadDuration
  const fallbackSeconds = secondsBetween(log.created_at, log.executed_at)
  return fallbackSeconds === null ? null : fallbackSeconds * 1000
}

function actionRetryCount(log: ActionLogRow): number {
  const direct = asNumber(log.retry_count)
  if (direct !== null) return Math.max(0, Math.round(direct))
  const payload = asRecord(log.request_payload)
  const fallback = asNumber(payload.retryCount ?? payload.retries)
  return fallback === null ? 0 : Math.max(0, Math.round(fallback))
}

function actionStatusCode(log: ActionLogRow): number | null {
  const direct = asNumber(log.status_code)
  if (direct !== null) return direct
  return asNumber(asRecord(log.request_payload).statusCode)
}

function statusBucket(status: unknown): 'success' | 'failed' | 'timeout' | 'pending' | 'rejected' | 'cancelled' | 'other' {
  const value = normalizeStatus(status)
  if (value === 'success') return 'success'
  if (value === 'failed') return 'failed'
  if (value === 'timeout') return 'timeout'
  if (value === 'pending_approval' || value === 'pending_confirmation' || value === 'approved') return 'pending'
  if (value === 'rejected') return 'rejected'
  if (value === 'cancelled') return 'cancelled'
  return 'other'
}

function readinessScore(checks: Array<{ status: ChecklistStatus; severity: 'high' | 'medium' | 'low' }>): number {
  let score = 100
  for (const check of checks) {
    const weight = check.severity === 'high' ? 18 : check.severity === 'medium' ? 10 : 5
    if (check.status === 'fail') score -= weight
    if (check.status === 'warn') score -= Math.round(weight * 0.6)
    if (check.status === 'manual') score -= Math.round(weight * 0.25)
  }
  return Math.max(0, Math.min(100, score))
}

async function buildReportingDashboard(ctx: any, period: AnalyticsPeriod) {
  requirePermissionFromContext(ctx, 'analytics', 'Analytics access is required.')

  const orgId = ctx.userOrgId
  const { days, currentStart, previousStart, previousEnd, now } = getWindow(period)
  const nowMs = now.getTime()

  const [
    conversationsResult,
    previousConversationsResult,
    messagesResult,
    currentContactsResult,
    previousContactsResult,
    totalContactsResult,
    callsResult,
    previousCallsResult,
    actionLogsResult,
    actionsResult,
    usersResult,
    slaPoliciesResult,
  ] = await Promise.all([
    ctx.supabase
      .from('conversations')
      .select([
        'id',
        'status',
        'channel',
        'started_at',
        'resolved_at',
        'assigned_to',
        'queue_state',
        'queue_entered_at',
        'first_response_due_at',
        'next_response_due_at',
        'resolution_due_at',
        'first_response_at',
        'last_customer_message_at',
        'last_agent_reply_at',
        'contacts(name, email)',
      ].join(','))
      .eq('org_id', orgId)
      .gte('started_at', currentStart.toISOString())
      .order('started_at', { ascending: true }),
    ctx.supabase
      .from('conversations')
      .select('id,status,started_at')
      .eq('org_id', orgId)
      .gte('started_at', previousStart.toISOString())
      .lt('started_at', previousEnd.toISOString()),
    ctx.supabase
      .from('messages')
      .select('conversation_id, role, created_at, ai_metadata')
      .eq('org_id', orgId)
      .gte('created_at', currentStart.toISOString())
      .order('created_at', { ascending: true }),
    ctx.supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', currentStart.toISOString()),
    ctx.supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', previousStart.toISOString())
      .lt('created_at', previousEnd.toISOString()),
    ctx.supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ctx.supabase
      .from('calls')
      .select('created_at, duration_seconds, status, type')
      .eq('org_id', orgId)
      .gte('created_at', currentStart.toISOString())
      .order('created_at', { ascending: true }),
    ctx.supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', previousStart.toISOString())
      .lt('created_at', previousEnd.toISOString()),
    ctx.supabase
      .from('ai_action_logs')
      .select([
        'id',
        'action_id',
        'status',
        'request_payload',
        'error_message',
        'created_at',
        'executed_at',
        'duration_ms',
        'status_code',
        'retry_count',
        'ai_actions(name, display_name)',
      ].join(','))
      .eq('org_id', orgId)
      .gte('created_at', currentStart.toISOString())
      .order('created_at', { ascending: true }),
    ctx.supabase.from('ai_actions').select('id, name, display_name, is_active').eq('org_id', orgId),
    ctx.supabase.from('users').select('id, name, email, role, is_online').eq('org_id', orgId),
    ctx.supabase.from('inbox_sla_policies').select('id, channel, is_default').eq('org_id', orgId),
  ])

  const conversations = (conversationsResult.data ?? []) as ConversationRow[]
  const previousConversations = (previousConversationsResult.data ?? []) as ConversationRow[]
  const messages = (messagesResult.data ?? []) as MessageRow[]
  const calls = (callsResult.data ?? []) as Array<Record<string, unknown>>
  const actionLogs = (actionLogsResult.data ?? []) as ActionLogRow[]
  const actions = (actionsResult.data ?? []) as Array<Record<string, unknown>>
  const users = (usersResult.data ?? []) as UserRow[]
  const slaPolicies = (slaPoliciesResult.data ?? []) as Array<Record<string, unknown>>

  const timeline = buildDateMap(days, () => ({
    conversations: 0,
    resolved: 0,
    open: 0,
    pending: 0,
    bot: 0,
    messages: 0,
    userMessages: 0,
    aiMessages: 0,
    agentMessages: 0,
    slaBreaches: 0,
    actions: 0,
    actionSuccess: 0,
    actionFailed: 0,
    avgActionLatencyMs: 0,
    _latencies: [] as number[],
  }))

  const statusCounts = new Map<string, number>()
  const channelStats = new Map<string, {
    channel: string
    total: number
    onTrack: number
    atRisk: number
    breached: number
    met: number
    unknown: number
    firstResponse: number[]
    resolution: number[]
  }>()
  const queueStats = new Map<string, {
    state: string
    count: number
    critical: number
    stale: number
    totalBacklogMinutes: number
  }>()
  const riskQueue: Array<{
    id: string
    contactName: string | null
    contactEmail: string | null
    channel: string
    status: string
    assignedTo: string | null
    slaState: SlaState
    slaTargetAt: string | null
    slaRemainingSeconds: number | null
    backlogMinutes: number | null
  }> = []
  const firstResponses: number[] = []
  const resolutions: number[] = []
  let totalResolved = 0
  let totalOnTrack = 0
  let totalAtRisk = 0
  let totalBreached = 0
  let totalMet = 0
  let activeBreaches = 0
  let nextBreachAt: string | null = null

  for (const row of conversations) {
    const status = normalizeStatus(row.status)
    const channel = asString(row.channel) ?? 'chat'
    const day = timeline[dateKey(row.started_at)]
    if (day) {
      day.conversations += 1
      if (status === 'resolved') day.resolved += 1
      if (status === 'open') day.open += 1
      if (status === 'pending') day.pending += 1
      if (status === 'bot') day.bot += 1
    }
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)
    if (status === 'resolved') totalResolved += 1

    const sla = deriveSla(row, nowMs)
    if (sla.state === 'on_track') totalOnTrack += 1
    if (sla.state === 'at_risk') totalAtRisk += 1
    if (sla.state === 'met') totalMet += 1
    if (sla.state === 'breached') {
      totalBreached += 1
      if (status !== 'resolved') activeBreaches += 1
      if (day) day.slaBreaches += 1
    }
    if (sla.targetAt && sla.remainingSeconds !== null && sla.remainingSeconds > 0) {
      const targetMs = toMs(sla.targetAt)
      const currentMs = toMs(nextBreachAt)
      if (targetMs !== null && (currentMs === null || targetMs < currentMs)) nextBreachAt = sla.targetAt
    }

    const firstResponse = secondsBetween(row.started_at, row.first_response_at)
    const resolution = secondsBetween(row.started_at, row.resolved_at)
    if (firstResponse !== null) firstResponses.push(firstResponse)
    if (resolution !== null) resolutions.push(resolution)

    const channelStat = channelStats.get(channel) ?? {
      channel,
      total: 0,
      onTrack: 0,
      atRisk: 0,
      breached: 0,
      met: 0,
      unknown: 0,
      firstResponse: [],
      resolution: [],
    }
    channelStat.total += 1
    if (sla.state === 'on_track') channelStat.onTrack += 1
    else if (sla.state === 'at_risk') channelStat.atRisk += 1
    else if (sla.state === 'breached') channelStat.breached += 1
    else if (sla.state === 'met') channelStat.met += 1
    else channelStat.unknown += 1
    if (firstResponse !== null) channelStat.firstResponse.push(firstResponse)
    if (resolution !== null) channelStat.resolution.push(resolution)
    channelStats.set(channel, channelStat)

    const queue = normalizeQueueState(status, row.queue_state)
    const minutes = deriveBacklogMinutes(row, nowMs)
    if (minutes !== null) {
      const backlog = backlogState(minutes)
      const queueStat = queueStats.get(queue) ?? {
        state: queue,
        count: 0,
        critical: 0,
        stale: 0,
        totalBacklogMinutes: 0,
      }
      queueStat.count += 1
      queueStat.totalBacklogMinutes += minutes
      if (backlog === 'critical') queueStat.critical += 1
      if (backlog === 'stale') queueStat.stale += 1
      queueStats.set(queue, queueStat)
    }

    if ((sla.state === 'breached' || sla.state === 'at_risk') && status !== 'resolved') {
      const contact = normalizeContact(row.contacts)
      riskQueue.push({
        id: row.id,
        contactName: contact?.name ?? null,
        contactEmail: contact?.email ?? null,
        channel,
        status,
        assignedTo: row.assigned_to ?? null,
        slaState: sla.state,
        slaTargetAt: sla.targetAt,
        slaRemainingSeconds: sla.remainingSeconds,
        backlogMinutes: minutes,
      })
    }
  }

  for (const message of messages) {
    const day = timeline[dateKey(message.created_at)]
    if (!day) continue
    day.messages += 1
    if (message.role === 'user') day.userMessages += 1
    if (message.role === 'assistant') day.aiMessages += 1
    if (message.role === 'agent') day.agentMessages += 1
  }

  const actionStats = new Map<string, {
    actionId: string
    name: string
    displayName: string
    total: number
    success: number
    failed: number
    timeout: number
    pending: number
    rejected: number
    cancelled: number
    other: number
    retryCount: number
    durations: number[]
    lastRunAt: string | null
    lastStatus: string | null
  }>()
  const actionDurations: number[] = []
  const recentFailures: Array<{
    id: string | null
    actionName: string
    status: string
    errorMessage: string | null
    durationMs: number | null
    statusCode: number | null
    retryCount: number
    createdAt: string | null
  }> = []
  let actionSuccess = 0
  let actionFailed = 0
  let actionTimeout = 0
  let actionPending = 0
  let actionRejected = 0
  let actionCancelled = 0
  let actionRetries = 0

  for (const log of actionLogs) {
    const bucket = statusBucket(log.status)
    const action = normalizeAction(log.ai_actions)
    const actionId = asString(log.action_id) ?? 'unknown'
    const displayName = action.displayName ?? action.name ?? 'Unknown action'
    const duration = actionDurationMs(log)
    const retries = actionRetryCount(log)
    const day = timeline[dateKey(log.created_at)]

    if (day) {
      day.actions += 1
      if (bucket === 'success') day.actionSuccess += 1
      if (bucket === 'failed' || bucket === 'timeout') day.actionFailed += 1
      if (duration !== null) day._latencies.push(duration)
    }

    if (bucket === 'success') actionSuccess += 1
    if (bucket === 'failed') actionFailed += 1
    if (bucket === 'timeout') actionTimeout += 1
    if (bucket === 'pending') actionPending += 1
    if (bucket === 'rejected') actionRejected += 1
    if (bucket === 'cancelled') actionCancelled += 1
    if (duration !== null) actionDurations.push(duration)
    actionRetries += retries

    const stat = actionStats.get(actionId) ?? {
      actionId,
      name: action.name ?? displayName,
      displayName,
      total: 0,
      success: 0,
      failed: 0,
      timeout: 0,
      pending: 0,
      rejected: 0,
      cancelled: 0,
      other: 0,
      retryCount: 0,
      durations: [],
      lastRunAt: null,
      lastStatus: null,
    }
    stat.total += 1
    if (bucket === 'success') stat.success += 1
    else if (bucket === 'failed') stat.failed += 1
    else if (bucket === 'timeout') stat.timeout += 1
    else if (bucket === 'pending') stat.pending += 1
    else if (bucket === 'rejected') stat.rejected += 1
    else if (bucket === 'cancelled') stat.cancelled += 1
    else stat.other += 1
    stat.retryCount += retries
    if (duration !== null) stat.durations.push(duration)
    if (!stat.lastRunAt || (log.created_at && (toMs(log.created_at) ?? 0) > (toMs(stat.lastRunAt) ?? 0))) {
      stat.lastRunAt = log.created_at ?? null
      stat.lastStatus = asString(log.status)
    }
    actionStats.set(actionId, stat)

    if (bucket === 'failed' || bucket === 'timeout') {
      recentFailures.push({
        id: log.id ?? null,
        actionName: displayName,
        status: asString(log.status) ?? 'failed',
        errorMessage: asString(log.error_message),
        durationMs: duration,
        statusCode: actionStatusCode(log),
        retryCount: retries,
        createdAt: log.created_at ?? null,
      })
    }
  }

  for (const day of Object.values(timeline)) {
    day.avgActionLatencyMs = average(day._latencies) ?? 0
  }

  const usersById = new Map(users.filter((user) => user.id).map((user) => [user.id as string, user]))
  const agentMessageCounts = new Map<string, number>()
  for (const message of messages) {
    if (message.role !== 'agent') continue
    const agentId = asString(asRecord(message.ai_metadata).agentId)
    if (agentId) agentMessageCounts.set(agentId, (agentMessageCounts.get(agentId) ?? 0) + 1)
  }

  const assigneeStats = new Map<string, {
    id: string
    name: string
    email: string
    role: string
    isOnline: boolean
    totalAssigned: number
    activeAssigned: number
    open: number
    pending: number
    resolved: number
    breached: number
    met: number
    firstResponses: number[]
    resolutions: number[]
  }>()
  function ensureAssignee(id: string | null | undefined) {
    const userId = id ?? 'unassigned'
    const user = usersById.get(userId)
    const existing = assigneeStats.get(userId)
    if (existing) return existing
    const next = {
      id: userId,
      name: userId === 'unassigned' ? 'Unassigned' : (user?.name ?? user?.email ?? 'Unknown agent'),
      email: userId === 'unassigned' ? '' : (user?.email ?? ''),
      role: userId === 'unassigned' ? 'queue' : (user?.role ?? 'agent'),
      isOnline: user?.is_online === true,
      totalAssigned: 0,
      activeAssigned: 0,
      open: 0,
      pending: 0,
      resolved: 0,
      breached: 0,
      met: 0,
      firstResponses: [] as number[],
      resolutions: [] as number[],
    }
    assigneeStats.set(userId, next)
    return next
  }
  for (const user of users) ensureAssignee(user.id)
  for (const row of conversations) {
    const assignee = ensureAssignee(row.assigned_to)
    const status = normalizeStatus(row.status)
    const sla = deriveSla(row, nowMs)
    const firstResponse = secondsBetween(row.started_at, row.first_response_at)
    const resolution = secondsBetween(row.started_at, row.resolved_at)
    assignee.totalAssigned += 1
    if (status !== 'resolved') assignee.activeAssigned += 1
    if (status === 'open') assignee.open += 1
    if (status === 'pending') assignee.pending += 1
    if (status === 'resolved') assignee.resolved += 1
    if (sla.state === 'breached') assignee.breached += 1
    if (sla.state === 'met') assignee.met += 1
    if (firstResponse !== null) assignee.firstResponses.push(firstResponse)
    if (resolution !== null) assignee.resolutions.push(resolution)
  }

  const previousResolved = previousConversations.filter((row) => normalizeStatus(row.status) === 'resolved').length
  const totalConversations = conversations.length
  const totalMessages = messages.length
  const userMessages = messages.filter((row) => row.role === 'user').length
  const aiMessages = messages.filter((row) => row.role === 'assistant').length
  const agentMessages = messages.filter((row) => row.role === 'agent').length
  const humanConversationIds = new Set(messages.filter((row) => row.role === 'agent').map((row) => row.conversation_id).filter(Boolean))
  const voiceSeconds = calls.reduce((sum, call) => sum + (asNumber(call.duration_seconds) ?? 0), 0)
  const completedActions = actionSuccess + actionFailed + actionTimeout
  const actionOverview = {
    total: actionLogs.length,
    success: actionSuccess,
    failed: actionFailed,
    timeout: actionTimeout,
    pending: actionPending,
    rejected: actionRejected,
    cancelled: actionCancelled,
    successRate: percent(actionSuccess, completedActions, 1),
    failureRate: percent(actionFailed + actionTimeout, completedActions, 1),
    retryCount: actionRetries,
    retryRate: percent(actionRetries, Math.max(actionLogs.length, 1), 1),
    avgLatencyMs: average(actionDurations),
    p95LatencyMs: percentile(actionDurations, 95),
    activeActions: actions.filter((action) => action.is_active !== false).length,
  }
  const slaOverview = {
    total: totalConversations,
    onTrack: totalOnTrack,
    atRisk: totalAtRisk,
    breached: totalBreached,
    met: totalMet,
    unknown: Math.max(totalConversations - totalOnTrack - totalAtRisk - totalBreached - totalMet, 0),
    breachRate: percent(totalBreached, totalConversations, 1),
    activeBreaches,
    nextBreachAt,
    avgFirstResponseSeconds: average(firstResponses),
    avgResolutionSeconds: average(resolutions),
    firstResponseMetRate: percent(firstResponses.filter((value) => value <= 600).length, firstResponses.length, 1),
  }

  const checks: Array<{
    id: string
    title: string
    category: 'SLA' | 'Actions' | 'Ops' | 'QA' | 'Rollback'
    severity: 'high' | 'medium' | 'low'
    status: ChecklistStatus
    detail: string
    nextStep: string
  }> = [
    {
      id: 'sla-policy',
      title: 'SLA policies configured',
      category: 'SLA',
      severity: 'high',
      status: slaPolicies.length > 0 ? 'pass' : 'fail',
      detail: `${slaPolicies.length} SLA policies found for this organization.`,
      nextStep: slaPolicies.length > 0 ? 'Review targets before launch.' : 'Create the default inbox_sla_policies row before launch.',
    },
    {
      id: 'active-sla-breaches',
      title: 'Active SLA breach backlog under control',
      category: 'SLA',
      severity: 'high',
      status: activeBreaches === 0 ? 'pass' : activeBreaches <= 3 ? 'warn' : 'fail',
      detail: `${activeBreaches} active conversations are currently breached.`,
      nextStep: 'Clear breached queue or temporarily increase launch staffing.',
    },
    {
      id: 'assignee-coverage',
      title: 'Assignee visibility ready',
      category: 'Ops',
      severity: 'medium',
      status: users.length > 0 ? 'pass' : 'warn',
      detail: `${users.length} team members available for assignment analytics.`,
      nextStep: 'Invite launch support agents and verify permissions.',
    },
    {
      id: 'action-success-rate',
      title: 'AI action success rate healthy',
      category: 'Actions',
      severity: 'high',
      status: completedActions === 0 ? 'manual' : actionOverview.successRate >= 95 ? 'pass' : actionOverview.successRate >= 85 ? 'warn' : 'fail',
      detail: `${actionOverview.successRate}% success across ${completedActions} completed executions.`,
      nextStep: 'Fix failed actions, validate secrets, and retest before launch.',
    },
    {
      id: 'action-latency',
      title: 'Action latency within launch target',
      category: 'Actions',
      severity: 'medium',
      status: !actionOverview.p95LatencyMs ? 'manual' : actionOverview.p95LatencyMs <= 5000 ? 'pass' : actionOverview.p95LatencyMs <= 10000 ? 'warn' : 'fail',
      detail: `P95 action latency is ${actionOverview.p95LatencyMs ? `${actionOverview.p95LatencyMs}ms` : 'not available yet'}.`,
      nextStep: 'Optimize slow external endpoints or review timeout budgets.',
    },
    {
      id: 'recent-action-failures',
      title: 'Recent action failures reviewed',
      category: 'Actions',
      severity: 'medium',
      status: recentFailures.length === 0 ? 'pass' : recentFailures.length <= 5 ? 'warn' : 'fail',
      detail: `${recentFailures.length} failed or timed-out action logs found.`,
      nextStep: 'Open recent failures, patch action config, then retest.',
    },
    {
      id: 'load-test',
      title: 'Load test executed for launch traffic',
      category: 'QA',
      severity: 'high',
      status: 'manual',
      detail: 'Run the included load test script against staging before launch freeze.',
      nextStep: 'Record p95 latency, error rate, and rollback threshold.',
    },
    {
      id: 'rollback-runbook',
      title: 'Rollback runbook reviewed',
      category: 'Rollback',
      severity: 'high',
      status: 'manual',
      detail: 'Rollback steps are documented and require human sign-off.',
      nextStep: 'Review REPORTING_LAUNCH_HARDENING_RUNBOOK.md with the launch owner.',
    },
  ]
  const score = readinessScore(checks)

  return {
    period,
    generatedAt: now.toISOString(),
    range: {
      days,
      currentStart: currentStart.toISOString(),
      previousStart: previousStart.toISOString(),
      previousEnd: previousEnd.toISOString(),
    },
    executiveSummary: {
      conversations: { value: totalConversations, change: pctChange(totalConversations, previousConversations.length) },
      resolutionRate: {
        value: percent(totalResolved, totalConversations),
        change: percent(totalResolved, totalConversations) - percent(previousResolved, previousConversations.length),
      },
      messages: { value: totalMessages, user: userMessages, ai: aiMessages, agent: agentMessages },
      aiAutomationRate: { value: percent(aiMessages, aiMessages + agentMessages) },
      newContacts: {
        value: currentContactsResult.count ?? 0,
        change: pctChange(currentContactsResult.count ?? 0, previousContactsResult.count ?? 0),
      },
      totalContacts: totalContactsResult.count ?? 0,
      calls: { value: calls.length, change: pctChange(calls.length, previousCallsResult.count ?? 0) },
      voiceMinutes: Math.ceil(voiceSeconds / 60),
      pendingConversations: statusCounts.get('pending') ?? 0,
      slaBreachRate: slaOverview.breachRate,
      avgFirstResponseSeconds: slaOverview.avgFirstResponseSeconds,
      actionSuccessRate: actionOverview.successRate,
      actionP95LatencyMs: actionOverview.p95LatencyMs,
      readinessScore: score,
    },
    timeline: Object.entries(timeline).map(([date, value]) => ({
      date,
      conversations: value.conversations,
      resolved: value.resolved,
      open: value.open,
      pending: value.pending,
      bot: value.bot,
      messages: value.messages,
      userMessages: value.userMessages,
      aiMessages: value.aiMessages,
      agentMessages: value.agentMessages,
      slaBreaches: value.slaBreaches,
      actions: value.actions,
      actionSuccess: value.actionSuccess,
      actionFailed: value.actionFailed,
      avgActionLatencyMs: value.avgActionLatencyMs,
    })),
    statusBreakdown: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
    handlingBreakdown: [
      { label: 'AI Automated', value: Math.max(totalConversations - humanConversationIds.size, 0), color: '#22c55e' },
      { label: 'Human Handled', value: humanConversationIds.size, color: '#f59e0b' },
    ],
    sla: {
      overview: slaOverview,
      byChannel: Array.from(channelStats.values()).map((stat) => ({
        channel: stat.channel,
        total: stat.total,
        onTrack: stat.onTrack,
        atRisk: stat.atRisk,
        breached: stat.breached,
        met: stat.met,
        unknown: stat.unknown,
        breachRate: percent(stat.breached, stat.total, 1),
        avgFirstResponseSeconds: average(stat.firstResponse),
        avgResolutionSeconds: average(stat.resolution),
      })).sort((a, b) => b.breached - a.breached || b.total - a.total),
      queueBacklog: Array.from(queueStats.values()).map((stat) => ({
        state: stat.state,
        count: stat.count,
        critical: stat.critical,
        stale: stat.stale,
        avgBacklogMinutes: stat.count > 0 ? Math.round(stat.totalBacklogMinutes / stat.count) : 0,
      })).sort((a, b) => b.count - a.count),
      activeRiskQueue: riskQueue.sort((a, b) => {
        if (a.slaState !== b.slaState) return a.slaState === 'breached' ? -1 : 1
        return (a.slaRemainingSeconds ?? 0) - (b.slaRemainingSeconds ?? 0)
      }).slice(0, 8),
    },
    assignees: Array.from(assigneeStats.values()).map((stat) => ({
      id: stat.id,
      name: stat.name,
      email: stat.email,
      role: stat.role,
      isOnline: stat.isOnline,
      totalAssigned: stat.totalAssigned,
      activeAssigned: stat.activeAssigned,
      open: stat.open,
      pending: stat.pending,
      resolved: stat.resolved,
      breached: stat.breached,
      agentMessages: agentMessageCounts.get(stat.id) ?? 0,
      avgFirstResponseSeconds: average(stat.firstResponses),
      avgResolutionSeconds: average(stat.resolutions),
      slaMetRate: percent(stat.met, stat.met + stat.breached),
      loadScore: stat.activeAssigned * 3 + stat.pending * 2 + stat.breached * 4,
    })).sort((a, b) => b.loadScore - a.loadScore || b.activeAssigned - a.activeAssigned).slice(0, 12),
    actions: {
      overview: actionOverview,
      byAction: Array.from(actionStats.values()).map((stat) => ({
        actionId: stat.actionId,
        name: stat.name,
        displayName: stat.displayName,
        total: stat.total,
        success: stat.success,
        failed: stat.failed,
        timeout: stat.timeout,
        pending: stat.pending,
        rejected: stat.rejected,
        cancelled: stat.cancelled,
        other: stat.other,
        successRate: percent(stat.success, stat.success + stat.failed + stat.timeout, 1),
        failureRate: percent(stat.failed + stat.timeout, stat.success + stat.failed + stat.timeout, 1),
        retryCount: stat.retryCount,
        avgLatencyMs: average(stat.durations),
        p95LatencyMs: percentile(stat.durations, 95),
        lastRunAt: stat.lastRunAt,
        lastStatus: stat.lastStatus,
      })).sort((a, b) => b.total - a.total),
      recentFailures: recentFailures.sort((a, b) => (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0)).slice(0, 10),
    },
    launch: {
      score,
      status: score >= 90 ? 'ready' : score >= 75 ? 'watch' : 'blocked',
      checks,
    },
  }
}

export const analyticsRouter = router({
  getReportingDashboard: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => buildReportingDashboard(ctx, input?.period ?? '30d')),

  getOverview: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const report = await buildReportingDashboard(ctx, input?.period ?? '30d')
      return {
        period: report.period,
        conversations: report.executiveSummary.conversations,
        resolutionRate: report.executiveSummary.resolutionRate,
        messages: { value: report.executiveSummary.messages.value, change: null },
        aiAutomationRate: { value: report.executiveSummary.aiAutomationRate.value, change: null },
        newContacts: report.executiveSummary.newContacts,
        totalContacts: report.executiveSummary.totalContacts,
        calls: report.executiveSummary.calls,
        voiceMinutes: report.executiveSummary.voiceMinutes,
        pendingConversations: report.executiveSummary.pendingConversations,
      }
    }),

  getConversationTrend: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const report = await buildReportingDashboard(ctx, input?.period ?? '30d')
      return report.timeline.map((row) => ({
        date: row.date,
        total: row.conversations,
        resolved: row.resolved,
        bot: row.bot,
        open: row.open,
        pending: row.pending,
      }))
    }),

  getStatusBreakdown: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const report = await buildReportingDashboard(ctx, input?.period ?? '30d')
      const colors: Record<string, string> = { bot: '#22c55e', pending: '#f59e0b', open: '#38bdf8', resolved: '#64748b' }
      return report.statusBreakdown.map((item) => ({ ...item, color: colors[item.status] ?? '#94a3b8' }))
    }),

  getMessageVolume: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const report = await buildReportingDashboard(ctx, input?.period ?? '30d')
      return report.timeline.map((row) => ({
        date: row.date,
        user: row.userMessages,
        assistant: row.aiMessages,
        agent: row.agentMessages,
        total: row.messages,
      }))
    }),

  getContactGrowth: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'analytics', 'Analytics access is required.')
      const period = input?.period ?? '30d'
      const { days, currentStart } = getWindow(period)
      const [periodContacts, totalBefore] = await Promise.all([
        ctx.supabase.from('contacts').select('created_at').eq('org_id', ctx.userOrgId).gte('created_at', currentStart.toISOString()),
        ctx.supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('org_id', ctx.userOrgId).lt('created_at', currentStart.toISOString()),
      ])
      const byDate = buildDateMap(days, () => 0)
      for (const contact of (periodContacts.data ?? []) as Array<Record<string, unknown>>) {
        const key = dateKey(asString(contact.created_at))
        if (byDate[key] !== undefined) byDate[key] += 1
      }
      let cumulative = totalBefore.count ?? 0
      return Object.entries(byDate).map(([date, count]) => {
        cumulative += count
        return { date, new: count, cumulative }
      })
    }),

  getResolutionTrend: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const report = await buildReportingDashboard(ctx, input?.period ?? '30d')
      return report.timeline.map((row) => ({
        date: row.date,
        rate: percent(row.resolved, row.conversations),
        total: row.conversations,
        resolved: row.resolved,
      }))
    }),

  getCallAnalytics: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'analytics', 'Analytics access is required.')
      const period = input?.period ?? '30d'
      const { days, currentStart } = getWindow(period)
      const { data } = await ctx.supabase
        .from('calls')
        .select('created_at, duration_seconds, status')
        .eq('org_id', ctx.userOrgId)
        .gte('created_at', currentStart.toISOString())
      const byDate = buildDateMap(days, () => ({ count: 0, minutes: 0, ended: 0 }))
      for (const call of (data ?? []) as Array<Record<string, unknown>>) {
        const bucket = byDate[dateKey(asString(call.created_at))]
        if (!bucket) continue
        bucket.count += 1
        bucket.minutes += Math.ceil((asNumber(call.duration_seconds) ?? 0) / 60)
        if (call.status === 'ended') bucket.ended += 1
      }
      return Object.entries(byDate).map(([date, value]) => ({ date, ...value }))
    }),

  getHandlingBreakdown: protectedProcedure
    .input(periodSchema)
    .query(async ({ ctx, input }) => {
      const report = await buildReportingDashboard(ctx, input?.period ?? '30d')
      return report.handlingBreakdown
    }),
})

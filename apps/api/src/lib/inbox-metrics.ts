export type BacklogState = 'fresh' | 'watch' | 'stale' | 'critical' | null
export type SlaState = 'on_track' | 'at_risk' | 'breached' | 'met' | null
export type SlaStage = 'first_response' | 'next_response' | 'resolution' | null

export interface InboxMetricConversation {
  status?: string | null
  queue_state?: string | null
  assigned_to?: string | null
  started_at?: string | null
  queue_entered_at?: string | null
  resolved_at?: string | null
  first_response_due_at?: string | null
  next_response_due_at?: string | null
  resolution_due_at?: string | null
  first_response_at?: string | null
  last_customer_message_at?: string | null
  last_agent_reply_at?: string | null
}

export interface BacklogSnapshot {
  backlogMinutes: number | null
  backlogState: BacklogState
  backlogStartedAt: string | null
}

export interface SlaSnapshot {
  slaState: SlaState
  slaTargetAt: string | null
  slaRemainingSeconds: number | null
  slaStage: SlaStage
  slaIsLive: boolean
}

const VALID_QUEUE_STATES = new Set([
  'bot',
  'queued',
  'assigned',
  'in_progress',
  'waiting_customer',
  'resolved',
])

export function toTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function normalizeConversationStatus(status: string | null | undefined): string {
  const normalized = status?.trim().toLowerCase() || 'bot'
  return normalized === 'closed' ? 'resolved' : normalized
}

export function normalizeQueueState(row: InboxMetricConversation): string {
  const status = normalizeConversationStatus(row.status)
  const explicit = row.queue_state?.trim().toLowerCase()

  if (status === 'resolved') return 'resolved'
  if (status === 'bot') return 'bot'
  if (explicit && VALID_QUEUE_STATES.has(explicit) && explicit !== 'resolved' && explicit !== 'bot') {
    return explicit
  }
  if (status === 'open') return 'in_progress'
  if (status === 'pending') return row.assigned_to ? 'assigned' : 'queued'
  return row.assigned_to ? 'assigned' : 'queued'
}

export function backlogStateFromMinutes(value: number | null): BacklogState {
  if (value === null || Number.isNaN(value)) return null
  if (value <= 15) return 'fresh'
  if (value <= 45) return 'watch'
  if (value <= 120) return 'stale'
  return 'critical'
}

function minutesSince(startedAt: string | null | undefined, nowMs: number): number | null {
  const startMs = toTimestampMs(startedAt)
  if (startMs === null) return null
  return Math.max(0, Math.floor((nowMs - startMs) / 60000))
}

function secondsUntil(targetAt: string | null | undefined, compareMs: number): number | null {
  const targetMs = toTimestampMs(targetAt)
  if (targetMs === null) return null
  return Math.floor((targetMs - compareMs) / 1000)
}

function isWaitingOnAgent(row: InboxMetricConversation): boolean {
  const lastCustomerMs = toTimestampMs(row.last_customer_message_at)
  const lastAgentMs = toTimestampMs(row.last_agent_reply_at)
  return lastCustomerMs !== null && (lastAgentMs === null || lastCustomerMs > lastAgentMs)
}

function buildSlaSnapshot(params: {
  targetAt: string | null | undefined
  compareMs: number
  stage: SlaStage
  live: boolean
}): SlaSnapshot {
  const remainingSeconds = secondsUntil(params.targetAt, params.compareMs)
  if (remainingSeconds === null) {
    return {
      slaState: null,
      slaTargetAt: params.targetAt ?? null,
      slaRemainingSeconds: null,
      slaStage: params.stage,
      slaIsLive: params.live,
    }
  }

  const isBreached = params.live ? remainingSeconds <= 0 : remainingSeconds < 0

  return {
    slaState:
      isBreached
        ? 'breached'
        : remainingSeconds <= 300
          ? 'at_risk'
          : 'on_track',
    slaTargetAt: params.targetAt ?? null,
    slaRemainingSeconds: remainingSeconds,
    slaStage: params.stage,
    slaIsLive: params.live,
  }
}

export function deriveInboxBacklog(
  row: InboxMetricConversation,
  nowMs: number
): BacklogSnapshot {
  const queueState = normalizeQueueState(row)

  if (queueState === 'resolved' || queueState === 'bot' || queueState === 'waiting_customer') {
    return { backlogMinutes: null, backlogState: null, backlogStartedAt: null }
  }

  const backlogStartedAt =
    queueState === 'in_progress'
      ? row.last_customer_message_at ?? row.queue_entered_at ?? row.started_at ?? null
      : row.queue_entered_at ?? row.last_customer_message_at ?? row.started_at ?? null

  if (queueState === 'in_progress' && !isWaitingOnAgent(row)) {
    return { backlogMinutes: null, backlogState: null, backlogStartedAt: null }
  }

  const backlogMinutes = minutesSince(backlogStartedAt, nowMs)
  return {
    backlogMinutes,
    backlogState: backlogStateFromMinutes(backlogMinutes),
    backlogStartedAt,
  }
}

export function deriveInboxSla(row: InboxMetricConversation, nowMs: number): SlaSnapshot {
  const status = normalizeConversationStatus(row.status)
  const queueState = normalizeQueueState(row)

  if (status === 'resolved') {
    const resolvedMs = toTimestampMs(row.resolved_at)
    if (resolvedMs === null) {
      return {
        slaState: null,
        slaTargetAt: row.resolution_due_at ?? null,
        slaRemainingSeconds: null,
        slaStage: 'resolution',
        slaIsLive: false,
      }
    }

    const resolutionSnapshot = buildSlaSnapshot({
      targetAt: row.resolution_due_at,
      compareMs: resolvedMs,
      stage: 'resolution',
      live: false,
    })

    if (resolutionSnapshot.slaState === 'breached') {
      return resolutionSnapshot
    }

    return {
      ...resolutionSnapshot,
      slaState: 'met',
    }
  }

  if (queueState === 'bot') {
    return {
      slaState: null,
      slaTargetAt: null,
      slaRemainingSeconds: null,
      slaStage: null,
      slaIsLive: false,
    }
  }

  const firstResponseMs = toTimestampMs(row.first_response_at)

  if (firstResponseMs === null) {
    return buildSlaSnapshot({
      targetAt: row.first_response_due_at,
      compareMs: nowMs,
      stage: 'first_response',
      live: true,
    })
  }

  if (isWaitingOnAgent(row)) {
    return buildSlaSnapshot({
      targetAt: row.next_response_due_at ?? row.first_response_due_at,
      compareMs: nowMs,
      stage: 'next_response',
      live: true,
    })
  }

  const lastAgentMs = toTimestampMs(row.last_agent_reply_at)
  const lastCustomerMs = toTimestampMs(row.last_customer_message_at)
  const latestResponseMs = lastCustomerMs !== null && lastAgentMs !== null && lastAgentMs >= lastCustomerMs
    ? lastAgentMs
    : firstResponseMs
  const latestTargetAt = lastCustomerMs !== null && lastAgentMs !== null && lastAgentMs >= lastCustomerMs
    ? row.next_response_due_at ?? row.first_response_due_at
    : row.first_response_due_at
  const latestSnapshot = buildSlaSnapshot({
    targetAt: latestTargetAt,
    compareMs: latestResponseMs,
    stage: latestTargetAt === row.first_response_due_at ? 'first_response' : 'next_response',
    live: false,
  })

  if (latestSnapshot.slaState === 'breached') {
    return latestSnapshot
  }

  return {
    slaState: 'met',
    slaTargetAt: latestSnapshot.slaTargetAt,
    slaRemainingSeconds: latestSnapshot.slaRemainingSeconds,
    slaStage: latestSnapshot.slaStage,
    slaIsLive: false,
  }
}

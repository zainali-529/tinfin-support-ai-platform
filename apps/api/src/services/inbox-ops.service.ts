import type { SupabaseClient } from '@supabase/supabase-js'

type AnySupabase = SupabaseClient<any, 'public', any>

type RoutingReason =
  | 'email_inbound'
  | 'whatsapp_inbound'
  | 'chat_handoff'
  | 'manual_pending'
  | 'auto'

interface RoutingCandidate {
  userId: string
  joinedAt: string
  isOnline: boolean
}

export interface RoutingResult {
  assignedTo: string | null
  strategy: 'round_robin_load_aware'
  candidateCount: number
  onlineCandidateCount: number
  loadByUserId: Record<string, number>
}

const ACTIVE_LOAD_STATUSES = ['pending', 'open'] as const

function toIsoNow(): string {
  return new Date().toISOString()
}

function normalizeCandidates(rows: Array<any> | null | undefined): RoutingCandidate[] {
  return (rows ?? [])
    .map((row) => {
      const userRecord = Array.isArray(row.users) ? row.users[0] : row.users
      const userId = typeof row.user_id === 'string' ? row.user_id : ''
      const joinedAt = typeof row.joined_at === 'string' ? row.joined_at : ''
      const isOnline = userRecord?.is_online === true

      if (!userId || !joinedAt) return null
      return {
        userId,
        joinedAt,
        isOnline,
      }
    })
    .filter((item): item is RoutingCandidate => Boolean(item))
}

function buildLoadMap(rows: Array<{ assigned_to: string | null }> | null | undefined): Record<string, number> {
  const result: Record<string, number> = {}

  for (const row of rows ?? []) {
    const assignedTo = row.assigned_to
    if (!assignedTo) continue
    result[assignedTo] = (result[assignedTo] ?? 0) + 1
  }

  return result
}

function pickAssignee(params: {
  candidates: RoutingCandidate[]
  lastAssignedUserId: string | null
  loadByUserId: Record<string, number>
}): string | null {
  const sorted = [...params.candidates].sort((a, b) => {
    const joinedCompare = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    if (joinedCompare !== 0) return joinedCompare
    return a.userId.localeCompare(b.userId)
  })

  if (sorted.length === 0) return null

  const lastIndex = sorted.findIndex((candidate) => candidate.userId === params.lastAssignedUserId)
  const rrOrder =
    lastIndex >= 0
      ? [...sorted.slice(lastIndex + 1), ...sorted.slice(0, lastIndex + 1)]
      : sorted

  const minLoad = Math.min(...rrOrder.map((candidate) => params.loadByUserId[candidate.userId] ?? 0))
  const leastLoadedIds = new Set(
    rrOrder
      .filter((candidate) => (params.loadByUserId[candidate.userId] ?? 0) === minLoad)
      .map((candidate) => candidate.userId)
  )

  for (const candidate of rrOrder) {
    if (leastLoadedIds.has(candidate.userId)) {
      return candidate.userId
    }
  }

  return rrOrder[0]?.userId ?? null
}

async function fetchRoutingCandidates(
  supabase: AnySupabase,
  orgId: string
): Promise<{
  allCandidates: RoutingCandidate[]
  preferredPool: RoutingCandidate[]
}> {
  const { data, error } = await supabase
    .from('user_organizations')
    .select('user_id, role, joined_at, users (is_online)')
    .eq('org_id', orgId)
    .in('role', ['admin', 'agent'])

  if (error) {
    throw new Error(`Failed to load routing candidates: ${error.message}`)
  }

  const allCandidates = normalizeCandidates(data as Array<any> | null | undefined)
  const onlineCandidates = allCandidates.filter((candidate) => candidate.isOnline)
  const preferredPool = onlineCandidates.length > 0 ? onlineCandidates : allCandidates

  return { allCandidates, preferredPool }
}

async function fetchCurrentLoads(
  supabase: AnySupabase,
  orgId: string,
  candidateIds: string[]
): Promise<Record<string, number>> {
  if (candidateIds.length === 0) return {}

  const { data, error } = await supabase
    .from('conversations')
    .select('assigned_to')
    .eq('org_id', orgId)
    .in('status', [...ACTIVE_LOAD_STATUSES])
    .in('assigned_to', candidateIds)

  if (error) {
    throw new Error(`Failed to load agent workloads: ${error.message}`)
  }

  return buildLoadMap((data ?? []) as Array<{ assigned_to: string | null }>)
}

async function fetchLastAssignedUserId(
  supabase: AnySupabase,
  orgId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('inbox_routing_state')
    .select('last_assigned_user_id')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load routing state: ${error.message}`)
  }

  const userId = data?.last_assigned_user_id
  return typeof userId === 'string' ? userId : null
}

async function persistRoutingState(params: {
  supabase: AnySupabase
  orgId: string
  assignedTo: string | null
  atIso: string
}) {
  const { supabase, orgId, assignedTo, atIso } = params
  const { error } = await supabase.from('inbox_routing_state').upsert({
    org_id: orgId,
    last_assigned_user_id: assignedTo,
    last_assigned_at: atIso,
    updated_at: atIso,
  })

  if (error) {
    throw new Error(`Failed to persist routing state: ${error.message}`)
  }
}

async function logRoutingEvent(params: {
  supabase: AnySupabase
  orgId: string
  conversationId: string
  assignedTo: string | null
  reason: RoutingReason
  metadata: Record<string, unknown>
}) {
  const { supabase, orgId, conversationId, assignedTo, reason, metadata } = params
  const { error } = await supabase.from('inbox_routing_events').insert({
    org_id: orgId,
    conversation_id: conversationId,
    assigned_to: assignedTo,
    reason,
    metadata,
  })

  if (error) {
    throw new Error(`Failed to log routing event: ${error.message}`)
  }
}

export async function routePendingConversation(params: {
  supabase: AnySupabase
  orgId: string
  conversationId: string
  reason: RoutingReason
}): Promise<RoutingResult> {
  const { supabase, orgId, conversationId, reason } = params

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('status, assigned_to')
    .eq('id', conversationId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (conversationError) {
    throw new Error(`Failed to load conversation before routing: ${conversationError.message}`)
  }

  if (!conversation) {
    throw new Error('Conversation not found for routing.')
  }

  if (!['pending', 'open'].includes(conversation.status)) {
    return {
      assignedTo:
        typeof conversation.assigned_to === 'string' ? conversation.assigned_to : null,
      strategy: 'round_robin_load_aware',
      candidateCount: 0,
      onlineCandidateCount: 0,
      loadByUserId: {},
    }
  }

  const { allCandidates, preferredPool } = await fetchRoutingCandidates(supabase, orgId)

  if (preferredPool.length === 0) {
    const { error: queueError } = await supabase
      .from('conversations')
      .update({
        assigned_to: null,
        queue_state: 'queued',
      })
      .eq('id', conversationId)
      .eq('org_id', orgId)

    if (queueError) {
      throw new Error(`Failed to update queue state: ${queueError.message}`)
    }

    await logRoutingEvent({
      supabase,
      orgId,
      conversationId,
      assignedTo: null,
      reason,
      metadata: {
        note: 'No eligible agents found',
      },
    })

    return {
      assignedTo: null,
      strategy: 'round_robin_load_aware',
      candidateCount: allCandidates.length,
      onlineCandidateCount: allCandidates.filter((candidate) => candidate.isOnline).length,
      loadByUserId: {},
    }
  }

  const nowIso = toIsoNow()
  const candidateIds = preferredPool.map((candidate) => candidate.userId)

  const [loadByUserId, lastAssignedUserId] = await Promise.all([
    fetchCurrentLoads(supabase, orgId, candidateIds),
    fetchLastAssignedUserId(supabase, orgId),
  ])

  const assignedTo = pickAssignee({
    candidates: preferredPool,
    lastAssignedUserId,
    loadByUserId,
  })

  if (!assignedTo) {
    throw new Error('Routing candidates were resolved but no assignee could be selected.')
  }

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      assigned_to: assignedTo,
      queue_state: 'assigned',
      routing_assigned_at: nowIso,
    })
    .eq('id', conversationId)
    .eq('org_id', orgId)

  if (updateError) {
    throw new Error(`Failed to assign conversation: ${updateError.message}`)
  }

  await persistRoutingState({
    supabase,
    orgId,
    assignedTo,
    atIso: nowIso,
  })

  await logRoutingEvent({
    supabase,
    orgId,
    conversationId,
    assignedTo,
    reason,
    metadata: {
      strategy: 'round_robin_load_aware',
      candidateCount: preferredPool.length,
      onlineCandidateCount: allCandidates.filter((candidate) => candidate.isOnline).length,
      loadByUserId,
    },
  })

  return {
    assignedTo,
    strategy: 'round_robin_load_aware',
    candidateCount: preferredPool.length,
    onlineCandidateCount: allCandidates.filter((candidate) => candidate.isOnline).length,
    loadByUserId,
  }
}

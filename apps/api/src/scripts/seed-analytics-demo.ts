import {
  addMinutes,
  daysAgo,
  demoActionNames,
  getSupabaseAdmin,
  iso,
  readCliOptions,
  seedMarker,
} from './analytics-demo-seed-utils'

type UserRow = {
  id: string
  name: string | null
  email: string | null
}

type ContactRow = {
  id: string
  name: string | null
  email: string | null
}

type ConversationSeed = {
  org_id: string
  contact_id: string
  status: string
  queue_state: string
  queue_entered_at: string
  channel: string
  assigned_to: string | null
  started_at: string
  resolved_at: string | null
  first_response_due_at: string
  next_response_due_at: string
  resolution_due_at: string
  first_response_at: string | null
  last_customer_message_at: string
  last_agent_reply_at: string | null
  routing_assigned_at: string | null
  ai_context: Record<string, unknown>
}

type ConversationRow = ConversationSeed & {
  id: string
}

const CHANNELS = ['chat', 'email', 'whatsapp', 'voice'] as const
const STATUSES = ['bot', 'pending', 'open', 'resolved'] as const

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length] as T
}

function supportName(index: number) {
  const first = ['Ava', 'Noah', 'Mia', 'Zain', 'Sara', 'Omar', 'Lina', 'Rayyan', 'Hira', 'Adam']
  const last = ['Khan', 'Malik', 'Stone', 'Reed', 'Ali', 'Brooks', 'Shah', 'Hayes', 'Iqbal', 'Cruz']
  return `${pick(first, index)} ${pick(last, index * 3)}`
}

function buildContacts(orgId: string, seedId: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    org_id: orgId,
    name: supportName(index),
    email: `analytics.demo.${seedId.replace(/[^a-zA-Z0-9]/g, '.').toLowerCase()}.${index + 1}@example.test`,
    phone: `+1555000${String(index + 1).padStart(4, '0')}`,
    meta: {
      ...seedMarker(seedId),
      visitorId: `demo-${seedId}-${index + 1}`,
      segment: pick(['Trial', 'Startup', 'Scale', 'Enterprise'], index),
      source: pick(['website', 'email', 'campaign', 'referral'], index + 1),
    },
    created_at: iso(daysAgo(Math.max(0, Math.floor(index / 3)), 9 + (index % 8), index % 50)),
  }))
}

function buildConversation(params: {
  orgId: string
  seedId: string
  contactId: string
  users: UserRow[]
  index: number
  dayOffset: number
}): ConversationSeed {
  const channel = pick(CHANNELS, params.index)
  const status = pick(STATUSES, params.index + params.dayOffset)
  const startedAt = daysAgo(params.dayOffset, 8 + (params.index % 9), (params.index * 7) % 55)
  const firstDue = addMinutes(startedAt, 10)
  const nextDue = addMinutes(startedAt, 35)
  const resolutionDue = addMinutes(startedAt, 240)
  const isResolved = status === 'resolved'
  const isBreached = params.index % 7 === 0
  const hasAgent = status === 'open' || status === 'pending' || isResolved
  const firstResponseAt = hasAgent
    ? addMinutes(startedAt, isBreached ? 22 : 4 + (params.index % 9))
    : null
  const resolvedAt = isResolved
    ? addMinutes(startedAt, isBreached ? 300 + (params.index % 70) : 80 + (params.index % 120))
    : null
  const lastCustomerMessageAt = status === 'open'
    ? addMinutes(startedAt, 45 + (params.index % 130))
    : addMinutes(startedAt, 2)
  const lastAgentReplyAt = hasAgent && status !== 'pending'
    ? addMinutes(startedAt, isBreached ? 70 : 15 + (params.index % 40))
    : null
  const assignedUser = params.users.length > 0 ? pick(params.users, params.index + params.dayOffset) : null
  const assignedTo = hasAgent ? assignedUser?.id ?? null : null
  const queueState =
    status === 'resolved' ? 'resolved' :
    status === 'bot' ? 'bot' :
    status === 'open' ? 'in_progress' :
    assignedTo ? 'assigned' : 'queued'

  return {
    org_id: params.orgId,
    contact_id: params.contactId,
    status,
    queue_state: queueState,
    queue_entered_at: iso(startedAt),
    channel,
    assigned_to: assignedTo,
    started_at: iso(startedAt),
    resolved_at: resolvedAt ? iso(resolvedAt) : null,
    first_response_due_at: iso(firstDue),
    next_response_due_at: iso(nextDue),
    resolution_due_at: iso(resolutionDue),
    first_response_at: firstResponseAt ? iso(firstResponseAt) : null,
    last_customer_message_at: iso(lastCustomerMessageAt),
    last_agent_reply_at: lastAgentReplyAt ? iso(lastAgentReplyAt) : null,
    routing_assigned_at: assignedTo ? iso(addMinutes(startedAt, 3)) : null,
    ai_context: {
      ...seedMarker(params.seedId),
      inboxLabels: [channel, isBreached ? 'SLA risk' : 'Demo'],
      demoIndex: params.index,
    },
  }
}

function buildMessages(params: {
  orgId: string
  seedId: string
  conversation: ConversationRow
  index: number
}) {
  const started = new Date(params.conversation.started_at)
  const marker = seedMarker(params.seedId)
  const userMessage = {
    org_id: params.orgId,
    conversation_id: params.conversation.id,
    role: 'user',
    content: pick([
      'I need help checking my order status.',
      'Can you explain the billing issue on my account?',
      'I want to talk to someone about setup.',
      'The widget is not showing on my website.',
      'Can you update my subscription details?',
    ], params.index),
    attachments: [],
    ai_metadata: { ...marker, demoMessageType: 'customer' },
    created_at: iso(addMinutes(started, 1)),
  }

  const aiMessage = {
    org_id: params.orgId,
    conversation_id: params.conversation.id,
    role: 'assistant',
    content: pick([
      'I can help with that. I am checking the available details now.',
      'Thanks for sharing that. I found the relevant account context.',
      'I can route this to the right teammate if needed.',
    ], params.index),
    attachments: [],
    ai_metadata: { ...marker, demoMessageType: 'ai' },
    created_at: iso(addMinutes(started, 3)),
  }

  const messages = [userMessage, aiMessage]
  if (params.conversation.assigned_to && params.conversation.status !== 'bot') {
    messages.push({
      org_id: params.orgId,
      conversation_id: params.conversation.id,
      role: 'agent',
      content: 'I reviewed this and can help with the next step.',
      attachments: [],
      ai_metadata: {
        ...marker,
        agentId: params.conversation.assigned_to,
        demoMessageType: 'agent',
      },
      created_at: iso(addMinutes(started, 14 + (params.index % 20))),
    } as typeof userMessage)
  }

  return messages
}

async function main() {
  const { orgId, seedId, days, scale } = readCliOptions()
  const supabase = getSupabaseAdmin()
  const marker = seedMarker(seedId)

  console.log(`[analytics-demo] seed started org=${orgId} seed=${seedId} days=${days} scale=${scale}`)

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle()

  if (orgError) throw new Error(`Failed to validate organization: ${orgError.message}`)
  if (!org) throw new Error(`Organization not found: ${orgId}`)

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('org_id', orgId)

  if (usersError) throw new Error(`Failed to load users: ${usersError.message}`)
  const users = (usersData ?? []) as UserRow[]

  const contactCount = Math.max(days * scale * 3, 30)
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .insert(buildContacts(orgId, seedId, contactCount))
    .select('id, name, email')

  if (contactsError) throw new Error(`Failed to insert demo contacts: ${contactsError.message}`)
  const contactRows = (contacts ?? []) as ContactRow[]

  const conversationsToInsert: ConversationSeed[] = []
  let cursor = 0
  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
    const dailyVolume = Math.max(2, scale * (3 + ((days - dayOffset) % 5)))
    for (let dailyIndex = 0; dailyIndex < dailyVolume; dailyIndex++) {
      const contact = pick(contactRows, cursor)
      conversationsToInsert.push(buildConversation({
        orgId,
        seedId,
        contactId: contact.id,
        users,
        index: cursor,
        dayOffset,
      }))
      cursor += 1
    }
  }

  const { data: conversations, error: conversationsError } = await supabase
    .from('conversations')
    .insert(conversationsToInsert)
    .select('*')

  if (conversationsError) throw new Error(`Failed to insert demo conversations: ${conversationsError.message}`)
  const conversationRows = (conversations ?? []) as ConversationRow[]

  const messages = conversationRows.flatMap((conversation, index) =>
    buildMessages({ orgId, seedId, conversation, index })
  )
  const { error: messagesError } = await supabase.from('messages').insert(messages)
  if (messagesError) throw new Error(`Failed to insert demo messages: ${messagesError.message}`)

  const actionsPayload = demoActionNames(seedId).map((name, index) => ({
    org_id: orgId,
    name,
    display_name: pick(['Demo Order Lookup', 'Demo Refund Check', 'Demo Subscription Sync'], index),
    description: 'Temporary analytics demo action. Safe to delete using cleanup:analytics-demo.',
    method: pick(['GET', 'POST', 'PATCH'], index),
    url_template: `https://demo.example.test/${name}`,
    headers_template: { 'X-Demo-Seed': seedId },
    body_template: index === 0 ? null : '{"demo": true}',
    response_path: null,
    response_template: 'Demo response completed.',
    parameters: [{ name: 'customer_id', type: 'string', required: true }],
    requires_confirmation: index !== 0,
    human_approval_required: index === 2,
    timeout_seconds: 10,
    is_active: true,
    category: 'demo',
  }))

  const { data: actions, error: actionsError } = await supabase
    .from('ai_actions')
    .upsert(actionsPayload, { onConflict: 'org_id,name' })
    .select('id, name, display_name')

  if (actionsError) throw new Error(`Failed to upsert demo actions: ${actionsError.message}`)
  const actionRows = (actions ?? []) as Array<{ id: string; name: string; display_name: string }>

  const actionLogs = conversationRows.slice(0, Math.min(conversationRows.length, days * scale * 4)).map((conversation, index) => {
    const action = pick(actionRows, index)
    const createdAt = addMinutes(new Date(conversation.started_at), 6 + (index % 25))
    const durationMs = 240 + ((index * 137) % 8_000)
    const failed = index % 9 === 0
    const timeout = index % 23 === 0
    const pending = index % 31 === 0
    const status = pending ? 'pending_approval' : timeout ? 'timeout' : failed ? 'failed' : 'success'

    return {
      org_id: orgId,
      action_id: action.id,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      parameters_used: { customer_id: conversation.contact_id },
      request_payload: {
        ...marker,
        actionName: action.name,
        durationMs,
        statusCode: failed ? 502 : timeout ? 504 : 200,
      },
      response_raw: status === 'success' ? { ok: true, demo: true } : { ok: false, demo: true },
      response_parsed: status === 'success' ? 'Demo action succeeded.' : null,
      status,
      error_message: status === 'success' ? null : pick(['Demo upstream timeout', 'Demo validation failed', 'Demo provider unavailable'], index),
      duration_ms: durationMs,
      status_code: failed ? 502 : timeout ? 504 : 200,
      retry_count: failed || timeout ? 1 + (index % 2) : index % 17 === 0 ? 1 : 0,
      executed_at: iso(addMinutes(createdAt, 1)),
      completed_at: pending ? null : iso(addMinutes(createdAt, 2)),
      created_at: iso(createdAt),
    }
  })

  const { error: logsError } = await supabase.from('ai_action_logs').insert(actionLogs)
  if (logsError) throw new Error(`Failed to insert demo action logs: ${logsError.message}`)

  const calls = conversationRows
    .filter((conversation, index) => conversation.channel === 'voice' || index % 8 === 0)
    .slice(0, days * scale * 2)
    .map((conversation, index) => {
      const createdAt = addMinutes(new Date(conversation.started_at), 5)
      const durationSeconds = 90 + ((index * 41) % 540)
      return {
        org_id: orgId,
        contact_id: conversation.contact_id,
        conversation_id: conversation.id,
        vapi_call_id: `demo-${seedId}-${conversation.id}`,
        vapi_assistant_id: 'demo-assistant',
        status: 'ended',
        type: 'webCall',
        direction: 'inbound',
        duration_seconds: durationSeconds,
        transcript: 'Demo call transcript for analytics visualization.',
        summary: 'Demo call summary.',
        ended_reason: 'customer-ended-call',
        visitor_id: `demo-${seedId}-${index}`,
        metadata: { ...marker, demoCall: true },
        started_at: iso(createdAt),
        ended_at: iso(addMinutes(createdAt, Math.ceil(durationSeconds / 60))),
        created_at: iso(createdAt),
        updated_at: iso(addMinutes(createdAt, Math.ceil(durationSeconds / 60))),
      }
    })

  if (calls.length > 0) {
    const { error: callsError } = await supabase.from('calls').insert(calls)
    if (callsError) throw new Error(`Failed to insert demo calls: ${callsError.message}`)
  }

  console.log('[analytics-demo] seed complete')
  console.table({
    actionLogs: actionLogs.length,
    actions: actionRows.length,
    calls: calls.length,
    contacts: contactRows.length,
    conversations: conversationRows.length,
    messages: messages.length,
    seedId,
  })
}

main().catch((error) => {
  console.error('[analytics-demo] seed failed:', error)
  process.exit(1)
})

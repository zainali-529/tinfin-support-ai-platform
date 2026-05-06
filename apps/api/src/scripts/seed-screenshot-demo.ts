import {
  addMinutes,
  demoActionNames,
  getSupabaseAdmin,
  insertBatched,
  iso,
  nowMinus,
  pick,
  readCliOptions,
  seedMarker,
} from './screenshot-demo-seed-utils'
import { cleanupScreenshotDemo } from './cleanup-screenshot-demo'

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

type ConversationRow = Record<string, unknown> & {
  id: string
  contact_id: string
  channel: string
  status: string
  assigned_to: string | null
  started_at: string
}

type ActionRow = {
  id: string
  name: string
  display_name: string
}

const CHANNELS = ['chat', 'email', 'whatsapp', 'voice'] as const
const STATUSES = ['bot', 'open', 'pending', 'resolved'] as const
const SEGMENTS = ['SaaS trial', 'Ecommerce', 'Agency', 'Scale support', 'Startup', 'Marketplace'] as const
const CONTACT_FIRST = ['Ava', 'Noah', 'Mia', 'Zain', 'Sara', 'Omar', 'Lina', 'Rayyan', 'Hira', 'Adam', 'Emma', 'Bilal'] as const
const CONTACT_LAST = ['Khan', 'Malik', 'Stone', 'Reed', 'Ali', 'Brooks', 'Shah', 'Hayes', 'Iqbal', 'Cruz', 'Santos', 'Nolan'] as const

function supportName(index: number) {
  return `${pick(CONTACT_FIRST, index)} ${pick(CONTACT_LAST, index * 3)}`
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
}

function conversationQuestion(index: number) {
  return pick([
    'Can you help me track order ORDER-12345?',
    'I want to understand your pricing plans.',
    'Can I connect WhatsApp and email in the same inbox?',
    'My widget is installed but I want to customize the colors.',
    'Can your AI answer from my knowledge base only?',
    'How do I invite another support agent?',
    'Can I cancel my subscription from billing?',
    'What happens when an SLA is breached?',
    'I need a human to review a refund request.',
    'Can you summarize what happened on my account?',
  ], index)
}

function assistantAnswer(index: number, channel: string, seedId: string) {
  const marker = seedMarker(seedId)
  const noAnswer = index % 11 === 0
  const lowConfidence = index % 9 === 0

  if (noAnswer) {
    return {
      content: 'I do not have enough verified information in the knowledge base to answer that confidently. I can route this to the support team so they can help directly.',
      metadata: {
        ...marker,
        type: 'ask_handoff',
        confidence: 0.18,
        noVerifiedAnswer: true,
        sources: [],
        handoffReason: 'No verified answer',
      },
    }
  }

  if (lowConfidence) {
    return {
      content: 'Based on the available workspace knowledge, this looks related to setup and account configuration. A support agent should verify the final step before the customer changes production settings.',
      metadata: {
        ...marker,
        type: 'answer',
        confidence: 0.42,
        sources: [{ title: 'Setup guide', sourceType: 'text', similarity: 0.44 }],
      },
    }
  }

  const channelTail = channel === 'email'
    ? 'I have included the full steps so the customer can keep this as a reference.'
    : channel === 'whatsapp'
      ? 'Short version: this can be handled from the dashboard.'
      : channel === 'voice'
        ? 'The answer is short enough to say clearly on a call.'
        : 'The agent can take over any time if the customer needs human help.'

  return {
    content: pick([
      `Order ORDER-12345 is out for delivery. ETA: today by 6:00 PM. Courier: DHL. Tracking: TRK-103708. ${channelTail}`,
      `Tinfiz combines website chat, AI replies, human handoff, email, WhatsApp, voice, knowledge base, actions, SLA tracking, contacts, and analytics in one support workspace. ${channelTail}`,
      `You can customize the widget from Widget settings: choose light and dark colors, set bottom-left or bottom-right launcher position, add help content, and test the preview before publishing. ${channelTail}`,
      `The knowledge base keeps AI grounded. Add text notes, URLs, or files, then review source health, stale sources, failed indexing, duplicate warnings, and AI improvement suggestions. ${channelTail}`,
      `Agent Copilot helps the support team draft replies, summarize the conversation, rewrite text, translate, suggest the next action, and find similar resolved conversations. ${channelTail}`,
    ], index),
    metadata: {
      ...marker,
      type: 'answer',
      confidence: 0.88 + ((index % 8) / 100),
      sources: [
        { title: 'Tinfiz product overview', sourceType: 'text', similarity: 0.92 },
        { title: 'Launch support operations guide', sourceType: 'url', similarity: 0.86 },
      ],
    },
  }
}

function buildContacts(orgId: string, seedId: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const name = supportName(index)
    return {
      org_id: orgId,
      name,
      email: `${slug(name)}.${seedId}@example.test`,
      phone: `+155510${String(index + 1).padStart(4, '0')}`,
      meta: {
        ...seedMarker(seedId),
        visitorId: `screenshot-${seedId}-${index + 1}`,
        segment: pick(SEGMENTS, index),
        company: { name: `${pick(['Northstar', 'BrightCart', 'OrbitDesk', 'FreshLayer'], index)} ${pick(['Labs', 'Studio', 'Commerce', 'Systems'], index + 2)}` },
        traits: { plan: pick(['free', 'starter', 'pro', 'scale'], index), lifecycle: pick(['trial', 'active', 'at_risk', 'expansion'], index + 1) },
        customFields: { MRR: `$${(49 + index * 8).toLocaleString()}`, Priority: pick(['Normal', 'High', 'VIP'], index) },
        tags: [pick(['trial', 'vip', 'billing', 'setup', 'renewal'], index), pick(['chat', 'email', 'whatsapp', 'voice'], index + 1)],
        lastPage: {
          title: pick(['Pricing', 'Checkout', 'Docs', 'Dashboard', 'Integrations'], index),
          url: `https://demo.example.test/${pick(['pricing', 'checkout', 'docs', 'dashboard', 'integrations'], index)}`,
        },
        lastSeenAt: iso(nowMinus(index % 8, 9 + (index % 8), index % 55)),
      },
      created_at: iso(nowMinus(Math.floor(index / 3), 8 + (index % 9), index % 50)),
    }
  })
}

function buildConversation(params: {
  orgId: string
  seedId: string
  contactId: string
  users: UserRow[]
  index: number
  dayOffset: number
}) {
  const channel = pick(CHANNELS, params.index)
  const status = pick(STATUSES, params.index + params.dayOffset)
  const startedAt = nowMinus(params.dayOffset, 8 + (params.index % 10), (params.index * 7) % 55)
  const firstDue = addMinutes(startedAt, channel === 'email' ? 180 : 10)
  const nextDue = addMinutes(startedAt, channel === 'email' ? 360 : 30)
  const resolutionDue = addMinutes(startedAt, channel === 'email' ? 1440 : 240)
  const isResolved = status === 'resolved'
  const isBreached = params.index % 8 === 0
  const hasAgent = status === 'open' || status === 'pending' || isResolved
  const assignedUser = params.users.length > 0 ? pick(params.users, params.index + params.dayOffset) : null
  const assignedTo = hasAgent ? assignedUser?.id ?? null : null
  const firstResponseAt = hasAgent ? addMinutes(startedAt, isBreached ? 22 : 3 + (params.index % 8)) : null
  const lastCustomerMessageAt = status === 'open' || status === 'pending'
    ? addMinutes(startedAt, 45 + (params.index % 110))
    : addMinutes(startedAt, 2)
  const lastAgentReplyAt = hasAgent && status !== 'pending'
    ? addMinutes(startedAt, isBreached ? 70 : 12 + (params.index % 35))
    : null
  const resolvedAt = isResolved ? addMinutes(startedAt, isBreached ? 290 : 55 + (params.index % 130)) : null
  const queueState = status === 'resolved'
    ? 'resolved'
    : status === 'bot'
      ? 'bot'
      : status === 'pending'
        ? 'waiting_customer'
        : assignedTo
          ? 'in_progress'
          : 'queued'

  return {
    org_id: params.orgId,
    contact_id: params.contactId,
    status,
    queue_state: queueState,
    queue_entered_at: iso(addMinutes(startedAt, 2)),
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
    routing_assigned_at: assignedTo ? iso(addMinutes(startedAt, 4)) : null,
    ai_context: {
      ...seedMarker(params.seedId),
      screenshotDemoIndex: params.index,
      inboxLabels: [channel, isBreached ? 'SLA risk' : 'Launch demo'],
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
  const answer = assistantAnswer(params.index, params.conversation.channel, params.seedId)
  const question = conversationQuestion(params.index)
  const rows: Array<Record<string, unknown>> = [
    {
      org_id: params.orgId,
      conversation_id: params.conversation.id,
      role: 'user',
      content: question,
      attachments: [],
      ai_metadata: { ...marker, demoMessageType: 'customer' },
      created_at: iso(addMinutes(started, 1)),
    },
    {
      org_id: params.orgId,
      conversation_id: params.conversation.id,
      role: 'assistant',
      content: answer.content,
      attachments: [],
      ai_metadata: { ...answer.metadata, demoMessageType: 'assistant' },
      created_at: iso(addMinutes(started, 3)),
    },
  ]

  if (params.conversation.assigned_to && params.conversation.status !== 'bot') {
    rows.push({
      org_id: params.orgId,
      conversation_id: params.conversation.id,
      role: 'agent',
      content: pick([
        'I checked this and can help with the next step.',
        'Thanks for waiting. I am reviewing the account now.',
        'I have taken over from AI and will keep this thread updated.',
      ], params.index),
      attachments: [],
      ai_metadata: {
        ...marker,
        agentId: params.conversation.assigned_to,
        demoMessageType: 'agent',
      },
      created_at: iso(addMinutes(started, 12 + (params.index % 24))),
    })
  }

  return rows
}

function buildTimelineEvents(params: {
  orgId: string
  seedId: string
  conversation: ConversationRow
  index: number
}) {
  const started = new Date(params.conversation.started_at)
  const marker = seedMarker(params.seedId)
  const base = {
    org_id: params.orgId,
    conversation_id: params.conversation.id,
    actor_user_id: params.conversation.assigned_to,
    metadata: marker,
  }

  return [
    {
      ...base,
      event_type: 'customer_message_received',
      title: 'Customer message received',
      body: conversationQuestion(params.index),
      created_at: iso(addMinutes(started, 1)),
    },
    {
      ...base,
      event_type: 'ai_response_sent',
      title: 'AI response sent',
      body: 'AI answered using demo knowledge and action context.',
      created_at: iso(addMinutes(started, 3)),
    },
    ...(params.conversation.assigned_to ? [{
      ...base,
      event_type: 'assigned',
      title: 'Conversation assigned',
      body: 'Routing engine assigned this conversation for screenshot demo workload.',
      created_at: iso(addMinutes(started, 5)),
    }] : []),
  ]
}

async function main() {
  const { orgId, seedId, days, scale, reset } = readCliOptions()
  const supabase = getSupabaseAdmin()
  const marker = seedMarker(seedId)

  console.log(`[screenshot-demo] seed started org=${orgId} seed=${seedId} days=${days} scale=${scale} reset=${reset}`)

  if (reset) {
    await cleanupScreenshotDemo({ orgId, seedId })
  }

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
  if (users.length === 0) console.warn('[screenshot-demo] no users found; conversations will be unassigned.')

  const contactRows = await insertBatched(
    supabase,
    'contacts',
    buildContacts(orgId, seedId, Math.max(28, days * scale * 2)),
    { select: 'id, name, email' }
  ) as ContactRow[]

  const kbRows = await insertBatched(supabase, 'knowledge_bases', [{
    org_id: orgId,
    name: 'Demo Knowledge Base',
    source_type: 'mixed',
    settings: {
      ...marker,
      description: 'Temporary demo knowledge base for documentation screenshots.',
    },
  }], { select: 'id' })
  const kbId = String(kbRows[0]?.id)

  const sourcePayload = [
    {
      org_id: orgId,
      kb_id: kbId,
      source_type: 'text_note',
      source_title: 'Tinfiz product overview',
      source_url: null,
      status: 'indexed',
      chunk_count: 5,
      quality_score: 92,
      warning_codes: [],
      error_message: null,
      last_indexed_at: iso(nowMinus(0, 8, 12)),
      last_checked_at: iso(nowMinus(0, 8, 12)),
      metadata: { ...marker, rawText: 'Tinfiz is a customer support platform for chat, AI, handoff, channels, actions, and analytics.' },
    },
    {
      org_id: orgId,
      kb_id: kbId,
      source_type: 'url',
      source_title: 'Launch operations guide',
      source_url: 'https://demo.example.test/docs/support-operations',
      status: 'indexed',
      chunk_count: 8,
      quality_score: 86,
      warning_codes: [],
      error_message: null,
      last_indexed_at: iso(nowMinus(1, 11, 10)),
      last_checked_at: iso(nowMinus(1, 11, 10)),
      metadata: marker,
    },
    {
      org_id: orgId,
      kb_id: kbId,
      source_type: 'url',
      source_title: 'Legacy pricing page',
      source_url: 'https://demo.example.test/pricing-old',
      status: 'stale',
      chunk_count: 3,
      quality_score: 52,
      warning_codes: ['stale_source', 'low_quality'],
      error_message: null,
      last_indexed_at: iso(nowMinus(18, 9, 0)),
      last_checked_at: iso(nowMinus(0, 7, 50)),
      metadata: marker,
    },
    {
      org_id: orgId,
      kb_id: kbId,
      source_type: 'url',
      source_title: 'Broken help article',
      source_url: 'https://demo.example.test/help/missing',
      status: 'failed',
      chunk_count: 0,
      quality_score: 0,
      warning_codes: ['indexing_failed'],
      error_message: 'Demo 404 while crawling source.',
      last_indexed_at: null,
      last_checked_at: iso(nowMinus(0, 7, 48)),
      metadata: marker,
    },
  ]
  const sourceRows = await insertBatched(supabase, 'kb_sources', sourcePayload, { select: 'id, source_title, source_url' })

  const chunks = sourceRows.flatMap((source, sourceIndex) => Array.from({ length: sourceIndex === 3 ? 0 : 3 + sourceIndex }, (_, index) => ({
    org_id: orgId,
    kb_id: kbId,
    source_id: source.id,
    content: pick([
      'Tinfiz helps teams support customers with AI-first chat, unified inbox operations, human handoff, and analytics.',
      'The widget supports light mode, dark mode, bottom left and bottom right launcher placement, help content, chat history, and voice entry points.',
      'Agent Copilot is available on Pro and Scale plans for internal reply drafting, summaries, rewrites, translations, next action suggestions, and similar resolved conversations.',
      'AI Actions v1 can safely call approved API endpoints with secrets, allowlists, logs, preview testing, and approval flows for risky write actions.',
      'SLA policies track first response, next response, and resolution targets by channel so teams can see at-risk and breached conversations.',
    ], index + sourceIndex),
    source_url: source.source_url,
    source_title: source.source_title,
    metadata: { ...marker, sourceType: sourcePayload[sourceIndex]?.source_type, demoChunkIndex: index },
  })))
  await insertBatched(supabase, 'kb_chunks', chunks)

  const conversationsToInsert: Array<Record<string, unknown>> = []
  let cursor = 0
  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const dailyVolume = Math.max(2, scale * (2 + ((days - dayOffset) % 4)))
    for (let dailyIndex = 0; dailyIndex < dailyVolume; dailyIndex += 1) {
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

  const conversationRows = await insertBatched(supabase, 'conversations', conversationsToInsert, { select: '*' }) as ConversationRow[]
  const messages = conversationRows.flatMap((conversation, index) => buildMessages({ orgId, seedId, conversation, index }))
  const messageRows = await insertBatched(supabase, 'messages', messages, { select: 'id, conversation_id, role, created_at' })

  const emailMessages = conversationRows
    .filter((conversation) => conversation.channel === 'email')
    .slice(0, days * scale)
    .map((conversation, index) => ({
      org_id: orgId,
      conversation_id: conversation.id,
      external_message_id: `screenshot-email-${seedId}-${index}`,
      subject: pick(['Billing question', 'Widget installation help', 'Upgrade request', 'SLA follow-up'], index),
      from_email: pick(contactRows, index).email,
      from_name: pick(contactRows, index).name,
      to_emails: ['support@example.test'],
      direction: 'inbound',
      status: 'received',
      text_body: conversationQuestion(index),
      raw_headers: marker,
      created_at: iso(addMinutes(new Date(conversation.started_at), 1)),
    }))
  await insertBatched(supabase, 'email_messages', emailMessages)

  const whatsappMessages = conversationRows
    .filter((conversation) => conversation.channel === 'whatsapp')
    .slice(0, days * scale)
    .map((conversation, index) => ({
      org_id: orgId,
      conversation_id: conversation.id,
      wa_message_id: `wamid.screenshot.${seedId}.${index}`,
      wa_contact_id: `155510${String(index + 1).padStart(4, '0')}`,
      direction: 'inbound',
      status: pick(['sent', 'delivered', 'read'], index),
      message_type: 'text',
      raw_payload: marker,
      created_at: iso(addMinutes(new Date(conversation.started_at), 1)),
    }))
  await insertBatched(supabase, 'whatsapp_messages', whatsappMessages)

  const notes = conversationRows.slice(0, Math.min(18, conversationRows.length)).map((conversation, index) => ({
    org_id: orgId,
    conversation_id: conversation.id,
    author_user_id: conversation.assigned_to,
    body: pick([
      'Customer is evaluating Pro plan and cares about WhatsApp support.',
      'Good candidate for onboarding follow-up. They asked about widget installation.',
      'Check billing context before making changes. Keep response concise.',
      'AI answer was useful, but agent should verify policy details before refund discussion.',
    ], index),
    metadata: marker,
    created_at: iso(addMinutes(new Date(conversation.started_at), 8)),
    updated_at: iso(addMinutes(new Date(conversation.started_at), 8)),
  }))
  const noteRows = await insertBatched(supabase, 'conversation_internal_notes', notes, { select: 'id, conversation_id' })

  const timelineEvents = conversationRows.flatMap((conversation, index) => buildTimelineEvents({ orgId, seedId, conversation, index }))
  const noteEvents = noteRows.map((note, index) => ({
    org_id: orgId,
    conversation_id: note.conversation_id,
    note_id: note.id,
    actor_user_id: users.length > 0 ? pick(users, index).id : null,
    event_type: 'note_created',
    title: 'Internal note added',
    body: 'Agent added private customer context for the team.',
    metadata: marker,
    created_at: iso(addMinutes(nowMinus(index % days, 10, 0), 18)),
  }))
  await insertBatched(supabase, 'conversation_timeline_events', [...timelineEvents, ...noteEvents])

  const actionsPayload = demoActionNames(seedId).map((name, index) => ({
    org_id: orgId,
    name,
    display_name: pick(['Order Status Lookup', 'Cancel Order', 'Subscription Check', 'Booking Lookup'], index),
    description: pick([
      'Read-only demo action that checks order status by order ID.',
      'Write demo action that requires confirmation before canceling an order.',
      'Read-only demo action that checks a subscription state.',
      'Read-only demo action that finds booking details.',
    ], index),
    method: pick(['GET', 'POST', 'GET', 'GET'], index),
    url_template: pick([
      'http://localhost:3001/api/action-mock/orders/{{orderId}}',
      'http://localhost:3001/api/action-mock/orders/{{orderId}}/cancel',
      'http://localhost:3001/api/action-mock/subscriptions/{{customerId}}',
      'http://localhost:3001/api/action-mock/bookings/{{bookingId}}',
    ], index),
    headers_template: { 'X-Demo-Seed': seedId },
    body_template: index === 1 ? '{"reason":"{{reason}}"}' : null,
    response_path: null,
    response_template: pick([
      'Order {id} is {status}. ETA: {estimatedDelivery}.',
      'Order {id} cancellation request is {status}.',
      'Subscription {id} is {status}. Renewal: {renewalDate}.',
      'Booking {id} is scheduled for {scheduledAt}.',
    ], index),
    parameters: pick([
      [{ name: 'orderId', type: 'string', required: true, description: 'Customer order ID, for example ORDER-12345.' }],
      [
        { name: 'orderId', type: 'string', required: true, description: 'Customer order ID.' },
        { name: 'reason', type: 'string', required: true, description: 'Reason for cancellation.' },
      ],
      [{ name: 'customerId', type: 'string', required: true, description: 'Customer ID from account metadata.' }],
      [{ name: 'bookingId', type: 'string', required: true, description: 'Booking reference ID.' }],
    ], index),
    requires_confirmation: index === 1,
    human_approval_required: index === 1,
    timeout_seconds: 10,
    is_active: true,
    category: 'demo',
  }))

  const actionRows = await insertBatched(supabase, 'ai_actions', actionsPayload, { select: 'id, name, display_name' }) as ActionRow[]

  const actionLogs = conversationRows.slice(0, Math.min(conversationRows.length, days * scale * 3)).map((conversation, index) => {
    const action = pick(actionRows, index)
    const createdAt = addMinutes(new Date(conversation.started_at), 6 + (index % 18))
    const durationMs = 180 + ((index * 149) % 6200)
    const status = index % 17 === 0 ? 'pending_approval' : index % 10 === 0 ? 'failed' : index % 23 === 0 ? 'timeout' : 'success'
    return {
      org_id: orgId,
      action_id: action.id,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      parameters_used: action.name.includes('order') ? { orderId: 'ORDER-12345', reason: 'Customer request' } : { customerId: conversation.contact_id, bookingId: 'BOOK-4481' },
      request_payload: { ...marker, actionName: action.name, durationMs, statusCode: status === 'success' ? 200 : status === 'timeout' ? 504 : 422 },
      response_raw: status === 'success' ? { ok: true, id: 'ORDER-12345', status: 'out_for_delivery', estimatedDelivery: 'Today by 6:00 PM' } : { ok: false, demo: true },
      response_parsed: status === 'success' ? 'Demo action completed successfully.' : null,
      status,
      error_message: status === 'success' ? null : pick(['Required parameter missing', 'Provider timeout', 'Demo upstream rejected request'], index),
      duration_ms: durationMs,
      status_code: status === 'success' ? 200 : status === 'timeout' ? 504 : 422,
      retry_count: status === 'success' ? (index % 13 === 0 ? 1 : 0) : 1,
      executed_at: iso(addMinutes(createdAt, 1)),
      completed_at: status === 'pending_approval' ? null : iso(addMinutes(createdAt, 2)),
      created_at: iso(createdAt),
    }
  })
  const actionLogRows = await insertBatched(supabase, 'ai_action_logs', actionLogs, { select: 'id, conversation_id, action_id, created_at' })

  const approvals = actionLogRows
    .filter((_, index) => index % 17 === 0)
    .map((log, index) => ({
      log_id: log.id,
      conversation_id: log.conversation_id,
      action_name: pick(actionRows, index).name,
      parameters: { orderId: 'ORDER-12345', reason: 'Customer requested cancellation' },
      requested_at: log.created_at,
      expires_at: iso(addMinutes(new Date(String(log.created_at)), 30)),
    }))
  await insertBatched(supabase, 'ai_action_approvals', approvals)

  const feedback = conversationRows
    .filter((conversation) => conversation.status === 'resolved')
    .slice(0, Math.max(8, days * scale))
    .map((conversation, index) => ({
      org_id: orgId,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      rating: pick([5, 5, 4, 4, 3, 5, 2], index),
      comment: pick([
        'Fast answer and clear next step.',
        'The AI answer was helpful and the agent followed up quickly.',
        'I got what I needed from the widget.',
        'Good support, but the policy answer could be clearer.',
      ], index),
      source: 'widget',
      channel: conversation.channel,
      handled_by: conversation.assigned_to ? 'human' : 'ai',
      assigned_to: conversation.assigned_to,
      metadata: marker,
      created_at: iso(addMinutes(new Date(conversation.started_at), 80 + (index % 120))),
    }))
  await insertBatched(supabase, 'conversation_feedback', feedback)

  const calls = conversationRows
    .filter((conversation, index) => conversation.channel === 'voice' || index % 9 === 0)
    .slice(0, days * scale)
    .map((conversation, index) => {
      const startedAt = addMinutes(new Date(conversation.started_at), 5)
      const durationSeconds = 80 + ((index * 37) % 620)
      return {
        org_id: orgId,
        contact_id: conversation.contact_id,
        conversation_id: conversation.id,
        vapi_call_id: `screenshot-${seedId}-${conversation.id}`,
        vapi_assistant_id: 'demo-assistant',
        status: pick(['ended', 'ended', 'missed'], index),
        type: 'webCall',
        direction: 'inbound',
        duration_seconds: durationSeconds,
        transcript: 'Customer asked about setup. AI confirmed the account context and offered a human handoff if needed.',
        summary: 'Demo support call about onboarding and account setup.',
        ended_reason: 'customer-ended-call',
        visitor_id: `screenshot-${seedId}-${index}`,
        metadata: marker,
        started_at: iso(startedAt),
        ended_at: iso(addMinutes(startedAt, Math.ceil(durationSeconds / 60))),
        created_at: iso(startedAt),
        updated_at: iso(addMinutes(startedAt, Math.ceil(durationSeconds / 60))),
      }
    })
  await insertBatched(supabase, 'calls', calls)

  if (users.length > 0) {
    const notifications = Array.from({ length: Math.min(18, conversationRows.length) }, (_, index) => {
      const conversation = pick(conversationRows, index)
      const recipient = pick(users, index)
      return {
        org_id: orgId,
        recipient_user_id: recipient.id,
        actor_user_id: conversation.assigned_to,
        type: pick(['new_conversation', 'assigned_to_me', 'sla_at_risk', 'ai_handoff_request', 'action_approval_request'], index),
        severity: pick(['info', 'info', 'warning', 'warning', 'critical'], index),
        title: pick(['New conversation', 'Assigned to you', 'SLA at risk', 'Human handoff requested', 'Action approval required'], index),
        body: pick([
          'A new customer conversation is waiting in the inbox.',
          'A conversation was assigned to your queue.',
          'A response target is close to breach.',
          'AI requested human help for this conversation.',
          'A write action needs approval before execution.',
        ], index),
        href: `/inbox?conversation=${conversation.id}`,
        metadata: marker,
        dedupe_key: `screenshot-${seedId}-${index}`,
        read_at: index % 4 === 0 ? iso(nowMinus(index % days, 12, 0)) : null,
        email_status: index % 3 === 0 ? 'sent' : 'not_queued',
        email_sent_at: index % 3 === 0 ? iso(nowMinus(index % days, 12, 5)) : null,
        created_at: iso(nowMinus(index % days, 12, index * 2)),
        updated_at: iso(nowMinus(index % days, 12, index * 2)),
      }
    })
    await insertBatched(supabase, 'notifications', notifications)
  }

  console.log('[screenshot-demo] seed complete')
  console.table({
    actions: actionRows.length,
    actionLogs: actionLogs.length,
    approvals: approvals.length,
    calls: calls.length,
    contacts: contactRows.length,
    conversations: conversationRows.length,
    csatResponses: feedback.length,
    kbChunks: chunks.length,
    kbSources: sourceRows.length,
    messages: messageRows.length,
    notes: noteRows.length,
    seedId,
  })
}

main().catch((error) => {
  console.error('[screenshot-demo] seed failed:', error)
  process.exit(1)
})


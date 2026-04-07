import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { queryRAG, isHandoffConfirmation } from '@workspace/ai'

// ─── Socket type ──────────────────────────────────────────────────────────────

interface TinfinSocket extends WebSocket {
  orgId?: string
  visitorId?: string
  conversationId?: string        // ← key: visitor socket tracks its own convId
  isAlive?: boolean
  isAgent?: boolean
  agentId?: string
  awaitingHandoffConfirm?: boolean
}

type ConversationStatus = 'bot' | 'pending' | 'open' | 'resolved' | 'closed'

interface VisitorConversationSummary {
  id: string
  status: ConversationStatus
  startedAt: string
  resolvedAt: string | null
  contactName: string | null
  contactEmail: string | null
  lastMessage: string
  lastMessageAt: string
}

// orgId → all sockets in that org
const rooms = new Map<string, Set<TinfinSocket>>()

// ─── Utils ────────────────────────────────────────────────────────────────────

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function send(socket: TinfinSocket, data: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data))
  }
}

function broadcastToAgents(orgId: string, data: unknown) {
  rooms.get(orgId)?.forEach(s => {
    if (s.isAgent && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(data))
    }
  })
}

async function authenticateAgentSocket(params: {
  orgId: string
  requestedAgentId?: string
  token?: string
}): Promise<string | null> {
  const token = params.token?.trim()
  if (!token) return null

  const supabase = getSupabase()

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    const user = authData?.user
    if (authError || !user) return null

    if (params.requestedAgentId && params.requestedAgentId !== user.id) {
      return null
    }

    const { data: member } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .eq('org_id', params.orgId)
      .maybeSingle()

    if (!member) return null

    return user.id
  } catch (e) {
    console.error('[ws] authenticateAgentSocket:', e)
    return null
  }
}

/** Deliver a message to the visitor who owns this conversationId */
async function getConversationVisitorId(orgId: string, conversationId: string): Promise<string | null> {
  const supabase = getSupabase()
  try {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('id', conversationId)
      .eq('org_id', orgId)
      .maybeSingle()

    const contactId = conversation?.contact_id as string | null | undefined
    if (!contactId) return null

    const { data: contact } = await supabase
      .from('contacts')
      .select('meta')
      .eq('org_id', orgId)
      .eq('id', contactId)
      .maybeSingle()

    const visitorId = (contact?.meta as { visitorId?: string } | null | undefined)?.visitorId
    return typeof visitorId === 'string' && visitorId.length > 0 ? visitorId : null
  } catch (e) {
    console.error('[ws] getConversationVisitorId:', e)
    return null
  }
}

async function sendToVisitor(orgId: string, conversationId: string, data: unknown) {
  const visitorId = await getConversationVisitorId(orgId, conversationId)
  if (!visitorId) {
    console.warn(`[ws] No visitor found for conv ${conversationId}`)
    return
  }

  let delivered = false
  rooms.get(orgId)?.forEach(s => {
    if (!s.isAgent && s.visitorId === visitorId && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(data))
      delivered = true
    }
  })
  if (!delivered) {
    console.warn(`[ws] No open visitor socket for visitor ${visitorId} (conv ${conversationId})`)
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getConversationStatus(orgId: string, conversationId: string): Promise<ConversationStatus | null> {
  try {
    const { data } = await getSupabase()
      .from('conversations')
      .select('status')
      .eq('id', conversationId)
      .eq('org_id', orgId)
      .maybeSingle()
    return (data?.status as ConversationStatus) ?? null
  } catch { return null }
}

async function conversationExistsInOrg(orgId: string, conversationId: string): Promise<boolean> {
  try {
    const { data } = await getSupabase()
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('org_id', orgId)
      .maybeSingle()
    return Boolean(data)
  } catch {
    return false
  }
}

async function getVisitorContactIds(orgId: string, visitorId: string): Promise<string[]> {
  try {
    const { data } = await getSupabase()
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('meta->>visitorId', visitorId)

    return (data ?? []).map((contact: { id: string }) => contact.id)
  } catch (e) {
    console.error('[ws] getVisitorContactIds:', e)
    return []
  }
}

async function fetchVisitorConversations(orgId: string, visitorId: string): Promise<VisitorConversationSummary[]> {
  const supabase = getSupabase()

  try {
    const contactIds = await getVisitorContactIds(orgId, visitorId)
    if (!contactIds.length) return []

    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, status, started_at, resolved_at, contact_id')
      .eq('org_id', orgId)
      .in('contact_id', contactIds)
      .order('started_at', { ascending: false })
      .limit(80)

    const list = conversations ?? []
    if (!list.length) return []

    const conversationIds = list.map((conversation: { id: string }) => conversation.id)

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email')
      .eq('org_id', orgId)
      .in('id', contactIds)

    const contactById = new Map<string, { name: string | null; email: string | null }>()
    for (const contact of contacts ?? []) {
      contactById.set(contact.id, {
        name: (contact as { name: string | null }).name,
        email: (contact as { email: string | null }).email,
      })
    }

    const { data: messages } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at')
      .eq('org_id', orgId)
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })

    const latestMessageByConversation = new Map<string, { content: string; created_at: string }>()
    for (const message of messages ?? []) {
      const conversationId = (message as { conversation_id: string }).conversation_id
      if (!latestMessageByConversation.has(conversationId)) {
        latestMessageByConversation.set(conversationId, {
          content: (message as { content: string }).content,
          created_at: (message as { created_at: string }).created_at,
        })
      }
    }

    return list
      .map((conversation) => {
        const contact = contactById.get((conversation as { contact_id: string | null }).contact_id ?? '')
        const last = latestMessageByConversation.get(conversation.id)

        return {
          id: conversation.id,
          status: conversation.status as ConversationStatus,
          startedAt: conversation.started_at,
          resolvedAt: conversation.resolved_at,
          contactName: contact?.name ?? null,
          contactEmail: contact?.email ?? null,
          lastMessage: last?.content ?? '',
          lastMessageAt: last?.created_at ?? conversation.started_at,
        }
      })
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
  } catch (e) {
    console.error('[ws] fetchVisitorConversations:', e)
    return []
  }
}

async function visitorOwnsConversation(orgId: string, visitorId: string, conversationId: string): Promise<boolean> {
  const supabase = getSupabase()

  try {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('id', conversationId)
      .eq('org_id', orgId)
      .maybeSingle()

    const contactId = conversation?.contact_id as string | null | undefined
    if (!contactId) return false

    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('id', contactId)
      .eq('meta->>visitorId', visitorId)
      .maybeSingle()

    return Boolean(contact)
  } catch (e) {
    console.error('[ws] visitorOwnsConversation:', e)
    return false
  }
}

async function fetchConversationMessages(orgId: string, conversationId: string) {
  try {
    const { data } = await getSupabase()
      .from('messages')
      .select('id, role, content, created_at, ai_metadata')
      .eq('org_id', orgId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    return data ?? []
  } catch (e) {
    console.error('[ws] fetchConversationMessages:', e)
    return []
  }
}

async function updateConversation(
  orgId: string,
  conversationId: string,
  fields: Record<string, unknown>
): Promise<boolean> {
  try {
    const { data } = await getSupabase()
      .from('conversations')
      .update(fields)
      .eq('id', conversationId)
      .eq('org_id', orgId)
      .select('id')
      .maybeSingle()
    return Boolean(data)
  } catch (e) {
    console.error('[ws] updateConversation:', e)
    return false
  }
}

async function persistMessage(params: {
  conversationId: string
  orgId: string
  role: 'user' | 'assistant' | 'agent'
  content: string
  aiMetadata?: Record<string, unknown>
}) {
  if (!params.conversationId) return
  try {
    const exists = await conversationExistsInOrg(params.orgId, params.conversationId)
    if (!exists) {
      console.warn(`[ws] persistMessage blocked: conversation ${params.conversationId} not in org ${params.orgId}`)
      return
    }

    await getSupabase().from('messages').insert({
      conversation_id: params.conversationId,
      org_id: params.orgId,
      role: params.role,
      content: params.content,
      ai_metadata: params.aiMetadata ?? null,
    })
  } catch (e) { console.error('[ws] persistMessage:', e) }
}

interface ContactIdentityRow {
  id: string
  name: string | null
  email: string | null
  meta: Record<string, unknown> | null
  created_at: string
}

function normalizeEmail(email?: string): string | undefined {
  const value = email?.trim().toLowerCase()
  return value || undefined
}

function readVisitorId(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null
  const visitorId = (meta as { visitorId?: unknown }).visitorId
  return typeof visitorId === 'string' && visitorId.trim().length > 0 ? visitorId.trim() : null
}

function mergeMeta(meta: unknown, visitorId: string): Record<string, unknown> {
  const base = (meta && typeof meta === 'object') ? (meta as Record<string, unknown>) : {}
  return { ...base, visitorId }
}

function pickCanonicalContact(
  contacts: ContactIdentityRow[],
  visitorId: string,
  email?: string
): ContactIdentityRow | null {
  if (!contacts.length) return null

  const withBoth = contacts.find(contact =>
    readVisitorId(contact.meta) === visitorId &&
    Boolean(email) &&
    contact.email === email
  )
  if (withBoth) return withBoth

  const byVisitor = contacts.find(contact => readVisitorId(contact.meta) === visitorId)
  if (byVisitor) return byVisitor

  if (email) {
    const byEmail = contacts.find(contact => contact.email === email)
    if (byEmail) return byEmail
  }

  return contacts[0] ?? null
}

async function fetchContactsByVisitor(orgId: string, visitorId: string): Promise<ContactIdentityRow[]> {
  const { data } = await getSupabase()
    .from('contacts')
    .select('id, name, email, meta, created_at')
    .eq('org_id', orgId)
    .eq('meta->>visitorId', visitorId)
    .order('created_at', { ascending: true })

  return (data as ContactIdentityRow[] | null) ?? []
}

async function fetchContactsByEmail(orgId: string, email?: string): Promise<ContactIdentityRow[]> {
  if (!email) return []

  const { data } = await getSupabase()
    .from('contacts')
    .select('id, name, email, meta, created_at')
    .eq('org_id', orgId)
    .eq('email', email)
    .order('created_at', { ascending: true })

  return (data as ContactIdentityRow[] | null) ?? []
}

async function relinkDuplicateContacts(orgId: string, canonicalId: string, duplicateIds: string[]) {
  if (!duplicateIds.length) return

  try {
    await getSupabase()
      .from('conversations')
      .update({ contact_id: canonicalId })
      .eq('org_id', orgId)
      .in('contact_id', duplicateIds)
  } catch (e) {
    console.error('[ws] relinkDuplicateContacts:', e)
  }
}

async function upsertContact(params: {
  orgId: string
  visitorId: string
  name?: string
  email?: string
}): Promise<string | null> {
  const email = normalizeEmail(params.email)

  try {
    const [visitorContacts, emailContacts] = await Promise.all([
      fetchContactsByVisitor(params.orgId, params.visitorId),
      fetchContactsByEmail(params.orgId, email),
    ])

    const map = new Map<string, ContactIdentityRow>()
    for (const contact of [...visitorContacts, ...emailContacts]) {
      map.set(contact.id, contact)
    }
    const candidates = [...map.values()].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const canonical = pickCanonicalContact(candidates, params.visitorId, email)

    if (canonical) {
      const nextName = params.name?.trim() || canonical.name || null
      const nextEmail = email || canonical.email || null
      const nextMeta = mergeMeta(canonical.meta, params.visitorId)

      await getSupabase()
        .from('contacts')
        .update({ name: nextName, email: nextEmail, meta: nextMeta })
        .eq('id', canonical.id)
        .eq('org_id', params.orgId)

      const duplicateIds = candidates
        .filter(contact => contact.id !== canonical.id)
        .map(contact => contact.id)
      await relinkDuplicateContacts(params.orgId, canonical.id, duplicateIds)

      return canonical.id
    }

    const { data: created } = await getSupabase().from('contacts').insert({
      org_id: params.orgId,
      name: params.name?.trim() || null,
      email: email || null,
      meta: { visitorId: params.visitorId },
    }).select('id').maybeSingle()

    return created?.id ?? null
  } catch (e) {
    console.error('[ws] upsertContact:', e)
    return null
  }
}

async function getOrCreateContactForVisitor(orgId: string, visitorId: string): Promise<string | null> {
  try {
    const contacts = await fetchContactsByVisitor(orgId, visitorId)
    const canonical = pickCanonicalContact(contacts, visitorId)
    if (canonical) {
      const duplicates = contacts.filter(contact => contact.id !== canonical.id).map(contact => contact.id)
      await relinkDuplicateContacts(orgId, canonical.id, duplicates)
      return canonical.id
    }

    const { data: created } = await getSupabase()
      .from('contacts')
      .insert({ org_id: orgId, meta: { visitorId } })
      .select('id')
      .maybeSingle()

    return created?.id ?? null
  } catch (e) {
    console.error('[ws] getOrCreateContactForVisitor:', e)
    return null
  }
}

async function getOrCreateConversation(params: {
  orgId: string
  visitorId: string
  conversationId?: string | null
}): Promise<{ conversationId: string; isNew: boolean }> {
  const supabase = getSupabase()

  if (params.conversationId) {
    const { data } = await supabase
      .from('conversations').select('id, status')
      .eq('id', params.conversationId).eq('org_id', params.orgId).maybeSingle()

    if (data && data.status !== 'resolved' && data.status !== 'closed') {
      return { conversationId: data.id, isNew: false }
    }
  }

  // Find/create canonical contact for this visitor.
  let contactId = await getOrCreateContactForVisitor(params.orgId, params.visitorId)

  if (!contactId) {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({ org_id: params.orgId, meta: { visitorId: params.visitorId } })
      .select('id').maybeSingle()
    contactId = newContact?.id ?? null
  }

  const { data: newConv } = await supabase
    .from('conversations')
    .insert({ org_id: params.orgId, contact_id: contactId, status: 'bot', channel: 'chat' })
    .select('id').maybeSingle()

  if (!newConv?.id) {
    throw new Error('[ws] Failed to create conversation')
  }

  return { conversationId: newConv.id, isNew: true }
}

// ─── Handoff ──────────────────────────────────────────────────────────────────

async function triggerHandoff(socket: TinfinSocket, conversationId: string, orgId: string) {
  socket.awaitingHandoffConfirm = false
  await updateConversation(orgId, conversationId, { status: 'pending' })

  const msg = "I'm connecting you with a human agent now. Please hold on! 🙏"
  send(socket, { type: 'ai:response', content: msg, conversationId, createdAt: new Date().toISOString(), handoff: true })
  broadcastToAgents(orgId, { type: 'handoff:requested', visitorId: socket.visitorId, conversationId, createdAt: new Date().toISOString() })
  await persistMessage({ conversationId, orgId, role: 'assistant', content: msg, aiMetadata: { shouldHandoff: true } })
}

// ─── Visitor: identify ────────────────────────────────────────────────────────

async function handleVisitorIdentify(socket: TinfinSocket, msg: Record<string, unknown>) {
  const orgId = socket.orgId!
  const name = (msg.name as string | undefined)?.trim()
  const email = (msg.email as string | undefined)?.trim().toLowerCase()

  if (!name && !email) return

  const contactId = await upsertContact({
    orgId,
    visitorId: socket.visitorId!,
    name,
    email,
  })

  // Update conversation's contact_id if we have a conversation
  if (contactId && socket.conversationId) {
    await getSupabase()
      .from('conversations')
      .update({ contact_id: contactId })
      .eq('id', socket.conversationId)
      .eq('org_id', orgId)
  }

  // Notify agents to refresh this conversation
  broadcastToAgents(orgId, {
    type: 'contact:updated',
    conversationId: socket.conversationId,
    contact: { name, email },
  })
}

// ─── Visitor: message ─────────────────────────────────────────────────────────

async function handleVisitorMessage(socket: TinfinSocket, msg: Record<string, unknown>) {
  const content = (msg.content as string | undefined)?.trim() ?? ''
  const orgId = socket.orgId!
  if (!content) return
  const requestedConversationId = ((msg.conversationId as string | undefined) ?? '').trim()

  const visitorInfo = (msg.visitorInfo as Record<string, unknown> | undefined) ?? {}
  const name = ((msg.name as string | undefined) ?? (visitorInfo.name as string | undefined))?.trim()
  const email = ((msg.email as string | undefined) ?? (visitorInfo.email as string | undefined))?.trim().toLowerCase()

  // Respect the requested conversation when visitor switches threads.
  if (requestedConversationId) {
    const ownsConversation = await visitorOwnsConversation(orgId, socket.visitorId!, requestedConversationId)
    if (!ownsConversation) {
      send(socket, { type: 'error', message: 'Conversation not found.' })
      return
    }
    socket.conversationId = requestedConversationId
  }

  // Ensure conversation
  if (!socket.conversationId) {
    const result = await getOrCreateConversation({
      orgId,
      visitorId: socket.visitorId!,
      conversationId: requestedConversationId || null,
    })
    socket.conversationId = result.conversationId
    send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: result.isNew })
  }

  const conversationId = socket.conversationId

  // Message payload can carry identity as a fallback when identify raced socket open.
  if (name || email) {
    const contactId = await upsertContact({
      orgId,
      visitorId: socket.visitorId!,
      name,
      email,
    })
    if (contactId) {
      await getSupabase()
        .from('conversations')
        .update({ contact_id: contactId })
        .eq('id', conversationId)
        .eq('org_id', orgId)
    }
  }

  const status = await getConversationStatus(orgId, conversationId)
  if (!status) {
    send(socket, { type: 'error', message: 'Conversation not found.' })
    return
  }

  if (status === 'resolved' || status === 'closed') {
    send(socket, {
      type: 'conversation:resolved',
      content: 'This conversation has been resolved. Thank you! 😊',
      conversationId,
      createdAt: new Date().toISOString(),
    })
    return
  }

  // Broadcast to agents (inbox real-time)
  broadcastToAgents(orgId, {
    type: 'visitor:message',
    visitorId: socket.visitorId,
    content,
    conversationId,
    createdAt: new Date().toISOString(),
  })

  await persistMessage({ conversationId, orgId, role: 'user', content })

  // If agent is handling → skip AI
  if (status === 'open') return

  // Handoff confirmation flow
  if (socket.awaitingHandoffConfirm) {
    if (isHandoffConfirmation(content)) {
      await triggerHandoff(socket, conversationId, orgId)
    } else {
      socket.awaitingHandoffConfirm = false
      const reply = "No problem! Feel free to ask me anything else. 😊"
      send(socket, { type: 'ai:response', content: reply, conversationId, createdAt: new Date().toISOString() })
      await persistMessage({ conversationId, orgId, role: 'assistant', content: reply })
    }
    return
  }

  // AI typing
  setTimeout(() => send(socket, { type: 'typing:start', conversationId }), 300)

  // RAG
  ;(async () => {
    try {
      const ragResult = await queryRAG({ query: content, orgId, threshold: 0.3, maxChunks: 5 })
      send(socket, { type: 'typing:stop', conversationId })

      if (ragResult.type === 'handoff') {
        await triggerHandoff(socket, conversationId, orgId)
      } else if (ragResult.type === 'ask_handoff') {
        socket.awaitingHandoffConfirm = true
        send(socket, { type: 'ai:response', content: ragResult.message, conversationId, createdAt: new Date().toISOString() })
        await persistMessage({ conversationId, orgId, role: 'assistant', content: ragResult.message, aiMetadata: { confidence: ragResult.confidence, awaitingConfirm: true } })
      } else {
        send(socket, { type: 'ai:response', content: ragResult.message, conversationId, createdAt: new Date().toISOString(), confidence: ragResult.confidence })
        await persistMessage({ conversationId, orgId, role: 'assistant', content: ragResult.message, aiMetadata: { confidence: ragResult.confidence } })
      }
    } catch (err) {
      console.error('[ws] RAG error:', err)
      send(socket, { type: 'typing:stop', conversationId })
      const fallback = "I'm having a little trouble right now. Would you like me to connect you with a human agent? (Reply **yes** to connect)"
      send(socket, { type: 'ai:response', content: fallback, conversationId, createdAt: new Date().toISOString() })
      socket.awaitingHandoffConfirm = true
    }
  })()
}

// ─── Agent: message ───────────────────────────────────────────────────────────

async function handleAgentMessage(socket: TinfinSocket, msg: Record<string, unknown>) {
  const content = (msg.content as string | undefined)?.trim() ?? ''
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!
  if (!content || !conversationId) return

  const status = await getConversationStatus(orgId, conversationId)
  if (!status) {
    send(socket, { type: 'error', message: 'Conversation not found.' })
    return
  }
  if (status === 'bot' || status === 'pending') {
    send(socket, { type: 'error', message: 'Take over the conversation first before sending messages.' })
    return
  }

  // ← CRITICAL FIX: deliver to visitor socket
  await sendToVisitor(orgId, conversationId, {
    type: 'agent:message',
    content,
    conversationId,
    createdAt: new Date().toISOString(),
  })

  send(socket, { type: 'message:sent', conversationId })
  await persistMessage({ conversationId, orgId, role: 'agent', content })
}

// ─── Agent: takeover ──────────────────────────────────────────────────────────

async function handleAgentTakeover(socket: TinfinSocket, msg: Record<string, unknown>) {
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!
  if (!conversationId) return

  const updated = await updateConversation(orgId, conversationId, { status: 'open', assigned_to: socket.agentId ?? null })
  if (!updated) {
    send(socket, { type: 'error', message: 'Conversation not found.' })
    return
  }

  await sendToVisitor(orgId, conversationId, {
    type: 'agent:joined',
    conversationId,
    createdAt: new Date().toISOString(),
  })

  broadcastToAgents(orgId, { type: 'conversation:status_changed', conversationId, status: 'open', assignedTo: socket.agentId })
  send(socket, { type: 'takeover:success', conversationId })

  await persistMessage({
    conversationId, orgId, role: 'assistant',
    content: '— Agent joined the conversation —',
    aiMetadata: { system: true, event: 'agent_joined' },
  })
}

// ─── Agent: release ───────────────────────────────────────────────────────────

async function handleAgentRelease(socket: TinfinSocket, msg: Record<string, unknown>) {
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!
  if (!conversationId) return

  const updated = await updateConversation(orgId, conversationId, { status: 'bot', assigned_to: null })
  if (!updated) {
    send(socket, { type: 'error', message: 'Conversation not found.' })
    return
  }

  const reply = "You've been transferred back to our AI assistant. How can I help you?"
  await sendToVisitor(orgId, conversationId, {
    type: 'bot:resumed', content: reply, conversationId, createdAt: new Date().toISOString(),
  })

  broadcastToAgents(orgId, { type: 'conversation:status_changed', conversationId, status: 'bot', assignedTo: null })
  await persistMessage({ conversationId, orgId, role: 'assistant', content: reply, aiMetadata: { system: true, event: 'released_to_bot' } })
}

// ─── Agent: resolve ───────────────────────────────────────────────────────────

async function handleAgentResolve(socket: TinfinSocket, msg: Record<string, unknown>) {
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!
  if (!conversationId) return

  const updated = await updateConversation(orgId, conversationId, { status: 'resolved' })
  if (!updated) {
    send(socket, { type: 'error', message: 'Conversation not found.' })
    return
  }

  await sendToVisitor(orgId, conversationId, {
    type: 'conversation:resolved',
    content: 'This conversation has been resolved. Thank you! 😊',
    conversationId,
    createdAt: new Date().toISOString(),
  })

  broadcastToAgents(orgId, { type: 'conversation:status_changed', conversationId, status: 'resolved' })
}

// ─── Conversation: resume ─────────────────────────────────────────────────────

async function handleConversationResume(socket: TinfinSocket, msg: Record<string, unknown>) {
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!
  if (!conversationId) return

  const ownsConversation = await visitorOwnsConversation(orgId, socket.visitorId!, conversationId)
  if (!ownsConversation) {
    const result = await getOrCreateConversation({ orgId, visitorId: socket.visitorId! })
    socket.conversationId = result.conversationId
    send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: true })
    return
  }

  const status = await getConversationStatus(orgId, conversationId)

  if (!status || status === 'resolved' || status === 'closed') {
    const result = await getOrCreateConversation({ orgId, visitorId: socket.visitorId! })
    socket.conversationId = result.conversationId
    send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: true })
    return
  }

  socket.conversationId = conversationId
  send(socket, { type: 'conversation:ready', conversationId, isNew: false, status })
}

async function handleConversationsList(socket: TinfinSocket) {
  if (socket.isAgent) return
  if (!socket.orgId || !socket.visitorId) return

  const conversations = await fetchVisitorConversations(socket.orgId, socket.visitorId)
  send(socket, {
    type: 'conversations:list',
    conversations,
    activeConversationId: socket.conversationId ?? null,
  })
}

async function handleConversationSelect(socket: TinfinSocket, msg: Record<string, unknown>) {
  if (socket.isAgent) return

  const orgId = socket.orgId!
  const visitorId = socket.visitorId!
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  if (!conversationId) return

  const ownsConversation = await visitorOwnsConversation(orgId, visitorId, conversationId)
  if (!ownsConversation) {
    send(socket, { type: 'error', message: 'Conversation not found.' })
    return
  }

  socket.conversationId = conversationId

  const status = await getConversationStatus(orgId, conversationId)
  if (!status) {
    send(socket, { type: 'error', message: 'Conversation not found.' })
    return
  }
  send(socket, { type: 'conversation:ready', conversationId, isNew: false, status })

  const messages = await fetchConversationMessages(orgId, conversationId)
  send(socket, {
    type: 'conversation:history',
    conversationId,
    messages,
  })
}

// ─── Conversation: new ────────────────────────────────────────────────────────

async function handleNewChat(socket: TinfinSocket) {
  const orgId = socket.orgId!
  const result = await getOrCreateConversation({ orgId, visitorId: socket.visitorId! })
  socket.conversationId = result.conversationId
  socket.awaitingHandoffConfirm = false
  send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: true })
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function handleMessage(socket: TinfinSocket, msg: Record<string, unknown>) {
  switch (msg.type) {
    case 'conversations:list': await handleConversationsList(socket); break
    case 'conversation:select': await handleConversationSelect(socket, msg); break
    case 'visitor:message':    await handleVisitorMessage(socket, msg); break
    case 'visitor:identify':   await handleVisitorIdentify(socket, msg); break
    case 'conversation:resume': await handleConversationResume(socket, msg); break
    case 'conversation:new':   await handleNewChat(socket); break
    case 'agent:message':      await handleAgentMessage(socket, msg); break
    case 'agent:takeover':     await handleAgentTakeover(socket, msg); break
    case 'agent:release':      await handleAgentRelease(socket, msg); break
    case 'agent:resolve':      await handleAgentResolve(socket, msg); break
    case 'typing:start':
    case 'typing:stop':
      broadcastToAgents(socket.orgId!, { type: msg.type, visitorId: socket.visitorId, conversationId: socket.conversationId })
      break
    case 'ping':
      send(socket, { type: 'pong' })
      break
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────

export function createWsServer(port: number) {
  const wss = new WebSocketServer({ port })

  wss.on('connection', async (socket: TinfinSocket, req: IncomingMessage) => {
    try {
      const url = new URL(req.url || '/', `http://localhost`)
      const orgId = (url.searchParams.get('orgId') || '').trim()
      const visitorId = url.searchParams.get('visitorId') || crypto.randomUUID()
      const isAgent = url.searchParams.get('type') === 'agent'
      const requestedAgentId = url.searchParams.get('agentId') || undefined
      const token = url.searchParams.get('token') || undefined

      if (!orgId) return socket.close(1008, 'orgId required')

      let verifiedAgentId: string | undefined
      if (isAgent) {
        verifiedAgentId = await authenticateAgentSocket({
          orgId,
          requestedAgentId,
          token,
        }) ?? undefined

        if (!verifiedAgentId) {
          return socket.close(1008, 'Unauthorized agent socket')
        }
      }

      socket.orgId = orgId
      socket.visitorId = visitorId
      socket.isAgent = isAgent
      socket.agentId = verifiedAgentId
      socket.isAlive = true
      socket.awaitingHandoffConfirm = false

      if (!rooms.has(orgId)) rooms.set(orgId, new Set())
      rooms.get(orgId)!.add(socket)

      send(socket, { type: 'connected', visitorId })
      if (!isAgent) {
        void handleConversationsList(socket)
      }

      socket.on('pong', () => { socket.isAlive = true })

      socket.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as Record<string, unknown>
          await handleMessage(socket, msg)
        } catch (e) { console.error('[ws] parse:', e) }
      })

      socket.on('close', () => {
        rooms.get(orgId)?.delete(socket)
        if (rooms.get(orgId)?.size === 0) rooms.delete(orgId)
      })

      socket.on('error', () => socket.terminate())
    } catch (e) {
      console.error('[ws] connection setup failed:', e)
      socket.close(1011, 'Connection setup failed')
    }
  })

  setInterval(() => {
    wss.clients.forEach(ws => {
      const s = ws as TinfinSocket
      if (!s.isAlive) return s.terminate()
      s.isAlive = false
      s.ping()
    })
  }, 30_000)

  console.log(`WS: ws://localhost:${port}`)
  return wss
}
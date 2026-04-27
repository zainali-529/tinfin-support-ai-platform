// ── Key changes vs original:
// 1. handleVisitorMessage now reads msg.attachments and passes to persistMessage
// 2. handleAgentMessage now reads msg.attachments and passes to visitor + persistMessage
// 3. persistMessage accepts optional attachments param
// 4. broadcast messages now carry attachments to relevant sockets

import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { queryRAG, isHandoffConfirmation } from '@workspace/ai'
import { getOrgSubscription } from '../lib/subscriptions'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Attachment {
  url: string
  name: string
  size: number
  type: string
}

interface TinfinSocket extends WebSocket {
  orgId?: string
  visitorId?: string
  conversationId?: string
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

const DEFAULT_WELCOME_MESSAGE = 'Hi 👋 How can we help?'

// ── Utils ──────────────────────────────────────────────────────────────────────

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

function getBillingPeriodStart(currentPeriodEnd: string | null): Date {
  if (currentPeriodEnd) {
    const end = new Date(currentPeriodEnd)
    const start = new Date(end)
    start.setMonth(start.getMonth() - 1)
    return start
  }
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function broadcastToAgents(orgId: string, data: unknown) {
  rooms.get(orgId)?.forEach(s => {
    if (s.isAgent && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(data))
    }
  })
}

async function getWelcomeMessage(orgId: string): Promise<string> {
  try {
    const { data } = await getSupabase()
      .from('widget_configs')
      .select('welcome_message')
      .eq('org_id', orgId)
      .maybeSingle()

    const message = (data?.welcome_message as string | null | undefined)?.trim()
    return message && message.length > 0 ? message : DEFAULT_WELCOME_MESSAGE
  } catch (e) {
    console.error('[ws] getWelcomeMessage:', e)
    return DEFAULT_WELCOME_MESSAGE
  }
}

async function sendWelcomeMessage(params: {
  socket: TinfinSocket
  conversationId: string
  orgId: string
}) {
  const message = await getWelcomeMessage(params.orgId)
  if (!message) return

  send(params.socket, {
    type: 'ai:response',
    content: message,
    conversationId: params.conversationId,
    createdAt: new Date().toISOString(),
  })

  await persistMessage({
    conversationId: params.conversationId,
    orgId: params.orgId,
    role: 'assistant',
    content: message,
    aiMetadata: { system: true, event: 'welcome' },
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
    if (params.requestedAgentId && params.requestedAgentId !== user.id) return null

    const { data: member } = await supabase
      .from('user_organizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', params.orgId)
      .maybeSingle()

    if (!member) return null
    return user.id
  } catch (e) {
    console.error('[ws] authenticateAgentSocket:', e)
    return null
  }
}

async function getConversationVisitorId(orgId: string, conversationId: string): Promise<string | null> {
  const supabase = getSupabase()
  try {
    const { data: conversation } = await supabase
      .from('conversations').select('contact_id')
      .eq('id', conversationId).eq('org_id', orgId).maybeSingle()

    const contactId = conversation?.contact_id as string | null | undefined
    if (!contactId) return null

    const { data: contact } = await supabase
      .from('contacts').select('meta')
      .eq('org_id', orgId).eq('id', contactId).maybeSingle()

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

// ── DB helpers ─────────────────────────────────────────────────────────────────

async function getConversationStatus(orgId: string, conversationId: string): Promise<ConversationStatus | null> {
  try {
    const { data } = await getSupabase()
      .from('conversations').select('status')
      .eq('id', conversationId).eq('org_id', orgId).maybeSingle()
    return (data?.status as ConversationStatus) ?? null
  } catch { return null }
}

async function conversationExistsInOrg(orgId: string, conversationId: string): Promise<boolean> {
  try {
    const { data } = await getSupabase()
      .from('conversations').select('id')
      .eq('id', conversationId).eq('org_id', orgId).maybeSingle()
    return Boolean(data)
  } catch { return false }
}

async function getVisitorContactIds(orgId: string, visitorId: string): Promise<string[]> {
  try {
    const { data } = await getSupabase()
      .from('contacts').select('id')
      .eq('org_id', orgId).eq('meta->>visitorId', visitorId)
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
      .from('conversations').select('id, status, started_at, resolved_at, contact_id')
      .eq('org_id', orgId).in('contact_id', contactIds)
      .order('started_at', { ascending: false }).limit(80)

    const list = conversations ?? []
    if (!list.length) return []

    const conversationIds = list.map((c: { id: string }) => c.id)

    const { data: contacts } = await supabase
      .from('contacts').select('id, name, email')
      .eq('org_id', orgId).in('id', contactIds)

    const contactById = new Map<string, { name: string | null; email: string | null }>()
    for (const contact of contacts ?? []) {
      contactById.set(contact.id, {
        name: (contact as { name: string | null }).name,
        email: (contact as { email: string | null }).email,
      })
    }

    const { data: messages } = await supabase
      .from('messages').select('conversation_id, content, attachments, created_at')
      .eq('org_id', orgId).in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })

    const latestMsgByConv = new Map<string, { content: string; attachments: Attachment[]; created_at: string }>()
    for (const message of messages ?? []) {
      const cid = (message as { conversation_id: string }).conversation_id
      if (!latestMsgByConv.has(cid)) {
        latestMsgByConv.set(cid, {
          content: (message as { content: string }).content,
          attachments: (message as { attachments?: Attachment[] }).attachments ?? [],
          created_at: (message as { created_at: string }).created_at,
        })
      }
    }

    return list
      .map((conversation) => {
        const contact = contactById.get((conversation as { contact_id: string | null }).contact_id ?? '')
        const last = latestMsgByConv.get(conversation.id)
        const lastContent = last?.attachments?.length
          ? `📎 ${last.attachments[0]?.name ?? 'File'}`
          : (last?.content ?? '')

        return {
          id: conversation.id,
          status: conversation.status as ConversationStatus,
          startedAt: conversation.started_at,
          resolvedAt: conversation.resolved_at,
          contactName: contact?.name ?? null,
          contactEmail: contact?.email ?? null,
          lastMessage: lastContent,
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
      .from('conversations').select('contact_id')
      .eq('id', conversationId).eq('org_id', orgId).maybeSingle()

    const contactId = conversation?.contact_id as string | null | undefined
    if (!contactId) return false

    const { data: contact } = await supabase
      .from('contacts').select('id')
      .eq('org_id', orgId).eq('id', contactId).eq('meta->>visitorId', visitorId).maybeSingle()

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
      .select('id, role, content, attachments, created_at, ai_metadata')
      .eq('org_id', orgId).eq('conversation_id', conversationId)
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
      .from('conversations').update(fields)
      .eq('id', conversationId).eq('org_id', orgId).select('id').maybeSingle()
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
  attachments?: Attachment[]
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
      attachments: params.attachments && params.attachments.length > 0
        ? params.attachments
        : [],
      ai_metadata: params.aiMetadata ?? null,
    })
  } catch (e) { console.error('[ws] persistMessage:', e) }
}

// ── Contact helpers (unchanged from original) ──────────────────────────────────

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
  const withBoth = contacts.find(c => readVisitorId(c.meta) === visitorId && Boolean(email) && c.email === email)
  if (withBoth) return withBoth
  const byVisitor = contacts.find(c => readVisitorId(c.meta) === visitorId)
  if (byVisitor) return byVisitor
  if (email) { const byEmail = contacts.find(c => c.email === email); if (byEmail) return byEmail }
  return contacts[0] ?? null
}

async function fetchContactsByVisitor(orgId: string, visitorId: string): Promise<ContactIdentityRow[]> {
  const { data } = await getSupabase()
    .from('contacts').select('id, name, email, meta, created_at')
    .eq('org_id', orgId).eq('meta->>visitorId', visitorId)
    .order('created_at', { ascending: true })
  return (data as ContactIdentityRow[] | null) ?? []
}

async function fetchContactsByEmail(orgId: string, email?: string): Promise<ContactIdentityRow[]> {
  if (!email) return []
  const { data } = await getSupabase()
    .from('contacts').select('id, name, email, meta, created_at')
    .eq('org_id', orgId).eq('email', email).order('created_at', { ascending: true })
  return (data as ContactIdentityRow[] | null) ?? []
}

async function relinkDuplicateContacts(orgId: string, canonicalId: string, duplicateIds: string[]) {
  if (!duplicateIds.length) return
  try {
    await getSupabase().from('conversations').update({ contact_id: canonicalId })
      .eq('org_id', orgId).in('contact_id', duplicateIds)
  } catch (e) { console.error('[ws] relinkDuplicateContacts:', e) }
}

async function upsertContact(params: { orgId: string; visitorId: string; name?: string; email?: string }): Promise<string | null> {
  const email = normalizeEmail(params.email)
  try {
    const [visitorContacts, emailContacts] = await Promise.all([
      fetchContactsByVisitor(params.orgId, params.visitorId),
      fetchContactsByEmail(params.orgId, email),
    ])
    const map = new Map<string, ContactIdentityRow>()
    for (const c of [...visitorContacts, ...emailContacts]) map.set(c.id, c)
    const candidates = [...map.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const canonical = pickCanonicalContact(candidates, params.visitorId, email)

    if (canonical) {
      const nextName = params.name?.trim() || canonical.name || null
      const nextEmail = email || canonical.email || null
      const nextMeta = mergeMeta(canonical.meta, params.visitorId)
      await getSupabase().from('contacts').update({ name: nextName, email: nextEmail, meta: nextMeta })
        .eq('id', canonical.id).eq('org_id', params.orgId)
      const duplicateIds = candidates.filter(c => c.id !== canonical.id).map(c => c.id)
      await relinkDuplicateContacts(params.orgId, canonical.id, duplicateIds)
      return canonical.id
    }

    const { data: created } = await getSupabase().from('contacts').insert({
      org_id: params.orgId, name: params.name?.trim() || null,
      email: email || null, meta: { visitorId: params.visitorId },
    }).select('id').maybeSingle()
    return created?.id ?? null
  } catch (e) { console.error('[ws] upsertContact:', e); return null }
}

async function getOrCreateContactForVisitor(orgId: string, visitorId: string): Promise<string | null> {
  try {
    const contacts = await fetchContactsByVisitor(orgId, visitorId)
    const canonical = pickCanonicalContact(contacts, visitorId)
    if (canonical) {
      const duplicates = contacts.filter(c => c.id !== canonical.id).map(c => c.id)
      await relinkDuplicateContacts(orgId, canonical.id, duplicates)
      return canonical.id
    }
    const { data: created } = await getSupabase().from('contacts')
      .insert({ org_id: orgId, meta: { visitorId } }).select('id').maybeSingle()
    return created?.id ?? null
  } catch (e) { console.error('[ws] getOrCreateContactForVisitor:', e); return null }
}

async function getOrCreateConversation(params: { orgId: string; visitorId: string; conversationId?: string | null }): Promise<{ conversationId: string; isNew: boolean }> {
  const supabase = getSupabase()

  if (params.conversationId) {
    const { data } = await supabase.from('conversations').select('id, status')
      .eq('id', params.conversationId).eq('org_id', params.orgId).maybeSingle()
    if (data && data.status !== 'resolved' && data.status !== 'closed') {
      return { conversationId: data.id, isNew: false }
    }
  }

  let contactId = await getOrCreateContactForVisitor(params.orgId, params.visitorId)
  if (!contactId) {
    const { data: newContact } = await supabase.from('contacts')
      .insert({ org_id: params.orgId, meta: { visitorId: params.visitorId } })
      .select('id').maybeSingle()
    contactId = newContact?.id ?? null
  }

  const orgSub = await getOrgSubscription(supabase, params.orgId)
  const periodStart = getBillingPeriodStart(orgSub.currentPeriodEnd ?? null)
  const { count: convCount } = await supabase.from('conversations').select('id', { count: 'exact', head: true })
    .eq('org_id', params.orgId).gte('started_at', periodStart.toISOString())

  const plan = orgSub.plan
  const limit = plan.limits.conversationsPerMonth
  if (limit !== -1 && (convCount ?? 0) >= limit) throw new Error('CHAT_LIMIT_REACHED')

  const { data: newConv } = await supabase.from('conversations')
    .insert({ org_id: params.orgId, contact_id: contactId, status: 'bot', channel: 'chat' })
    .select('id').maybeSingle()
  if (!newConv?.id) throw new Error('[ws] Failed to create conversation')
  return { conversationId: newConv.id, isNew: true }
}

// ── Handoff ────────────────────────────────────────────────────────────────────

async function triggerHandoff(socket: TinfinSocket, conversationId: string, orgId: string) {
  socket.awaitingHandoffConfirm = false
  await updateConversation(orgId, conversationId, { status: 'pending' })
  const msg = "I'm connecting you with a human agent now. Please hold on! 🙏"
  send(socket, { type: 'ai:response', content: msg, conversationId, createdAt: new Date().toISOString(), handoff: true })
  broadcastToAgents(orgId, { type: 'handoff:requested', visitorId: socket.visitorId, conversationId, createdAt: new Date().toISOString() })
  await persistMessage({ conversationId, orgId, role: 'assistant', content: msg, aiMetadata: { shouldHandoff: true } })
}

// ── Visitor: identify ─────────────────────────────────────────────────────────

async function handleVisitorIdentify(socket: TinfinSocket, msg: Record<string, unknown>) {
  const orgId = socket.orgId!
  const name = (msg.name as string | undefined)?.trim()
  const email = (msg.email as string | undefined)?.trim().toLowerCase()
  if (!name && !email) return

  const contactId = await upsertContact({ orgId, visitorId: socket.visitorId!, name, email })
  if (contactId && socket.conversationId) {
    await getSupabase().from('conversations').update({ contact_id: contactId })
      .eq('id', socket.conversationId).eq('org_id', orgId)
  }
  broadcastToAgents(orgId, { type: 'contact:updated', conversationId: socket.conversationId, contact: { name, email } })
}

// ── Visitor: message (with attachments) ───────────────────────────────────────

async function handleVisitorMessage(socket: TinfinSocket, msg: Record<string, unknown>) {
  const content = (msg.content as string | undefined)?.trim() ?? ''
  const attachments = (msg.attachments as Attachment[] | undefined) ?? []
  const orgId = socket.orgId!

  // Must have either text or attachments
  if (!content && attachments.length === 0) return

  const requestedConversationId = ((msg.conversationId as string | undefined) ?? '').trim()
  const visitorInfo = (msg.visitorInfo as Record<string, unknown> | undefined) ?? {}
  const name = ((msg.name as string | undefined) ?? (visitorInfo.name as string | undefined))?.trim()
  const email = ((msg.email as string | undefined) ?? (visitorInfo.email as string | undefined))?.trim().toLowerCase()

  if (requestedConversationId) {
    const ownsConversation = await visitorOwnsConversation(orgId, socket.visitorId!, requestedConversationId)
    if (!ownsConversation) { send(socket, { type: 'error', message: 'Conversation not found.' }); return }
    socket.conversationId = requestedConversationId
  }

  if (!socket.conversationId) {
    try {
      const result = await getOrCreateConversation({
        orgId, visitorId: socket.visitorId!, conversationId: requestedConversationId || null,
      })
      socket.conversationId = result.conversationId
      send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: result.isNew })
    } catch (error) {
      if (error instanceof Error && error.message === 'CHAT_LIMIT_REACHED') {
        send(socket, { type: 'error', message: 'Chat limit reached for this workspace. Please try again next billing period.' })
        return
      }
      send(socket, { type: 'error', message: 'Unable to start a new conversation right now.' })
      return
    }
  }

  const conversationId = socket.conversationId

  if (name || email) {
    const contactId = await upsertContact({ orgId, visitorId: socket.visitorId!, name, email })
    if (contactId) {
      await getSupabase().from('conversations').update({ contact_id: contactId })
        .eq('id', conversationId).eq('org_id', orgId)
    }
  }

  const status = await getConversationStatus(orgId, conversationId)
  if (!status) { send(socket, { type: 'error', message: 'Conversation not found.' }); return }

  if (status === 'resolved' || status === 'closed') {
    send(socket, {
      type: 'conversation:resolved',
      content: 'This conversation has been resolved. Thank you! 😊',
      conversationId, createdAt: new Date().toISOString(),
    })
    return
  }

  // Notify agents (include attachments for agent inbox display)
  broadcastToAgents(orgId, {
    type: 'visitor:message', visitorId: socket.visitorId,
    content, attachments, conversationId, createdAt: new Date().toISOString(),
  })

  await persistMessage({ conversationId, orgId, role: 'user', content, attachments })

  // If agent is handling → skip AI
  if (status === 'open') return

  // If only file attachment, no text → just acknowledge, don't run AI
  if (!content && attachments.length > 0) return

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

    ; (async () => {
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

// ── Agent: message (with attachments) ─────────────────────────────────────────

async function handleAgentMessage(socket: TinfinSocket, msg: Record<string, unknown>) {
  const content = (msg.content as string | undefined)?.trim() ?? ''
  const attachments = (msg.attachments as Attachment[] | undefined) ?? []
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!

  // Must have text or attachments
  if ((!content && attachments.length === 0) || !conversationId) return

  const status = await getConversationStatus(orgId, conversationId)
  if (!status) { send(socket, { type: 'error', message: 'Conversation not found.' }); return }
  if (status === 'bot' || status === 'pending') {
    send(socket, { type: 'error', message: 'Take over the conversation first before sending messages.' })
    return
  }

  // Deliver to visitor (include attachments)
  await sendToVisitor(orgId, conversationId, {
    type: 'agent:message', content, attachments, conversationId, createdAt: new Date().toISOString(),
  })

  send(socket, { type: 'message:sent', conversationId })
  await persistMessage({ conversationId, orgId, role: 'agent', content, attachments })
}

// ── Agent: takeover, release, resolve (unchanged) ─────────────────────────────

async function handleAgentTakeover(socket: TinfinSocket, msg: Record<string, unknown>) {
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!
  if (!conversationId) return

  const updated = await updateConversation(orgId, conversationId, { status: 'open', assigned_to: socket.agentId ?? null })
  if (!updated) { send(socket, { type: 'error', message: 'Conversation not found.' }); return }

  await sendToVisitor(orgId, conversationId, { type: 'agent:joined', conversationId, createdAt: new Date().toISOString() })
  broadcastToAgents(orgId, { type: 'conversation:status_changed', conversationId, status: 'open', assignedTo: socket.agentId })
  send(socket, { type: 'takeover:success', conversationId })
  await persistMessage({ conversationId, orgId, role: 'assistant', content: '— Agent joined the conversation —', aiMetadata: { system: true, event: 'agent_joined' } })
}

async function handleAgentRelease(socket: TinfinSocket, msg: Record<string, unknown>) {
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!
  if (!conversationId) return

  const updated = await updateConversation(orgId, conversationId, { status: 'bot', assigned_to: null })
  if (!updated) { send(socket, { type: 'error', message: 'Conversation not found.' }); return }

  const reply = "You've been transferred back to our AI assistant. How can I help you?"
  await sendToVisitor(orgId, conversationId, { type: 'bot:resumed', content: reply, conversationId, createdAt: new Date().toISOString() })
  broadcastToAgents(orgId, { type: 'conversation:status_changed', conversationId, status: 'bot', assignedTo: null })
  await persistMessage({ conversationId, orgId, role: 'assistant', content: reply, aiMetadata: { system: true, event: 'released_to_bot' } })
}

async function handleAgentResolve(socket: TinfinSocket, msg: Record<string, unknown>) {
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!
  if (!conversationId) return

  const updated = await updateConversation(orgId, conversationId, { status: 'resolved' })
  if (!updated) { send(socket, { type: 'error', message: 'Conversation not found.' }); return }

  await sendToVisitor(orgId, conversationId, {
    type: 'conversation:resolved', content: 'This conversation has been resolved. Thank you! 😊',
    conversationId, createdAt: new Date().toISOString(),
  })
  broadcastToAgents(orgId, { type: 'conversation:status_changed', conversationId, status: 'resolved' })
}

// ── Conversation helpers ───────────────────────────────────────────────────────

async function handleConversationResume(socket: TinfinSocket, msg: Record<string, unknown>) {
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!
  if (!conversationId) return

  const ownsConversation = await visitorOwnsConversation(orgId, socket.visitorId!, conversationId)
  if (!ownsConversation) {
    const result = await getOrCreateConversation({ orgId, visitorId: socket.visitorId! })
    socket.conversationId = result.conversationId
    send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: true })
    await sendWelcomeMessage({ socket, conversationId: result.conversationId, orgId })
    return
  }

  const status = await getConversationStatus(orgId, conversationId)
  if (!status || status === 'resolved' || status === 'closed') {
    const result = await getOrCreateConversation({ orgId, visitorId: socket.visitorId! })
    socket.conversationId = result.conversationId
    send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: true })
    await sendWelcomeMessage({ socket, conversationId: result.conversationId, orgId })
    return
  }

  socket.conversationId = conversationId
  send(socket, { type: 'conversation:ready', conversationId, isNew: false, status })
}

async function handleConversationsList(socket: TinfinSocket) {
  if (socket.isAgent) return
  if (!socket.orgId || !socket.visitorId) return
  const conversations = await fetchVisitorConversations(socket.orgId, socket.visitorId)
  send(socket, { type: 'conversations:list', conversations, activeConversationId: socket.conversationId ?? null })
}

async function handleConversationSelect(socket: TinfinSocket, msg: Record<string, unknown>) {
  if (socket.isAgent) return
  const orgId = socket.orgId!
  const visitorId = socket.visitorId!
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  if (!conversationId) return

  const ownsConversation = await visitorOwnsConversation(orgId, visitorId, conversationId)
  if (!ownsConversation) { send(socket, { type: 'error', message: 'Conversation not found.' }); return }

  socket.conversationId = conversationId
  const status = await getConversationStatus(orgId, conversationId)
  if (!status) { send(socket, { type: 'error', message: 'Conversation not found.' }); return }
  send(socket, { type: 'conversation:ready', conversationId, isNew: false, status })

  const messages = await fetchConversationMessages(orgId, conversationId)
  send(socket, { type: 'conversation:history', conversationId, messages })
}

async function handleNewChat(socket: TinfinSocket) {
  const orgId = socket.orgId!
  const result = await getOrCreateConversation({ orgId, visitorId: socket.visitorId! })
  socket.conversationId = result.conversationId
  socket.awaitingHandoffConfirm = false
  send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: true })
  if (result.isNew) {
    await sendWelcomeMessage({ socket, conversationId: result.conversationId, orgId })
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

async function handleMessage(socket: TinfinSocket, msg: Record<string, unknown>) {
  switch (msg.type) {
    case 'conversations:list': await handleConversationsList(socket); break
    case 'conversation:select': await handleConversationSelect(socket, msg); break
    case 'visitor:message': await handleVisitorMessage(socket, msg); break
    case 'visitor:identify': await handleVisitorIdentify(socket, msg); break
    case 'conversation:resume': await handleConversationResume(socket, msg); break
    case 'conversation:new': await handleNewChat(socket); break
    case 'agent:message': await handleAgentMessage(socket, msg); break
    case 'agent:takeover': await handleAgentTakeover(socket, msg); break
    case 'agent:release': await handleAgentRelease(socket, msg); break
    case 'agent:resolve': await handleAgentResolve(socket, msg); break
    case 'typing:start':
    case 'typing:stop':
      broadcastToAgents(socket.orgId!, { type: msg.type, visitorId: socket.visitorId, conversationId: socket.conversationId })
      break
    case 'ping':
      send(socket, { type: 'pong' })
      break
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

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
        verifiedAgentId = await authenticateAgentSocket({ orgId, requestedAgentId, token }) ?? undefined
        if (!verifiedAgentId) return socket.close(1008, 'Unauthorized agent socket')
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
      if (!isAgent) void handleConversationsList(socket)

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

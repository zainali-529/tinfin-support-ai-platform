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

/** Deliver a message to the visitor who owns this conversationId */
function sendToVisitor(orgId: string, conversationId: string, data: unknown) {
  let delivered = false
  rooms.get(orgId)?.forEach(s => {
    if (!s.isAgent && s.conversationId === conversationId && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(data))
      delivered = true
    }
  })
  if (!delivered) {
    console.warn(`[ws] No open visitor socket for conv ${conversationId}`)
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getConversationStatus(conversationId: string): Promise<ConversationStatus | null> {
  try {
    const { data } = await getSupabase()
      .from('conversations').select('status').eq('id', conversationId).single()
    return (data?.status as ConversationStatus) ?? null
  } catch { return null }
}

async function updateConversation(
  conversationId: string,
  fields: Record<string, unknown>
) {
  try {
    await getSupabase().from('conversations').update(fields).eq('id', conversationId)
  } catch (e) { console.error('[ws] updateConversation:', e) }
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
    await getSupabase().from('messages').insert({
      conversation_id: params.conversationId,
      org_id: params.orgId,
      role: params.role,
      content: params.content,
      ai_metadata: params.aiMetadata ?? null,
    })
  } catch (e) { console.error('[ws] persistMessage:', e) }
}

async function upsertContact(params: {
  orgId: string
  visitorId: string
  name?: string
  email?: string
}): Promise<string | null> {
  const supabase = getSupabase()
  try {
    // Try by email first
    if (params.email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('org_id', params.orgId)
        .eq('email', params.email)
        .single()

      if (existing) {
        await supabase.from('contacts').update({
          name: params.name || undefined,
          meta: { visitorId: params.visitorId },
        }).eq('id', existing.id)
        return existing.id
      }
    }

    // Try by visitorId in meta
    const { data: byVisitor } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', params.orgId)
      .eq('meta->>visitorId', params.visitorId)
      .single()

    if (byVisitor) {
      await supabase.from('contacts').update({
        name: params.name || undefined,
        email: params.email || undefined,
      }).eq('id', byVisitor.id)
      return byVisitor.id
    }

    // Create new
    const { data: created } = await supabase.from('contacts').insert({
      org_id: params.orgId,
      name: params.name || null,
      email: params.email || null,
      meta: { visitorId: params.visitorId },
    }).select('id').single()

    return created?.id ?? null
  } catch (e) {
    console.error('[ws] upsertContact:', e)
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
      .eq('id', params.conversationId).eq('org_id', params.orgId).single()

    if (data && data.status !== 'resolved' && data.status !== 'closed') {
      return { conversationId: data.id, isNew: false }
    }
  }

  // Find existing open conversation for this visitor
  const { data: contactData } = await supabase
    .from('contacts').select('id')
    .eq('org_id', params.orgId)
    .eq('meta->>visitorId', params.visitorId)
    .single()

  let contactId = contactData?.id ?? null

  if (!contactId) {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({ org_id: params.orgId, meta: { visitorId: params.visitorId } })
      .select('id').single()
    contactId = newContact?.id ?? null
  }

  const { data: newConv } = await supabase
    .from('conversations')
    .insert({ org_id: params.orgId, contact_id: contactId, status: 'bot', channel: 'chat' })
    .select('id').single()

  return { conversationId: newConv!.id, isNew: true }
}

// ─── Handoff ──────────────────────────────────────────────────────────────────

async function triggerHandoff(socket: TinfinSocket, conversationId: string, orgId: string) {
  socket.awaitingHandoffConfirm = false
  await updateConversation(conversationId, { status: 'pending' })

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

  // Ensure conversation
  if (!socket.conversationId) {
    const result = await getOrCreateConversation({
      orgId,
      visitorId: socket.visitorId!,
      conversationId: msg.conversationId as string | null,
    })
    socket.conversationId = result.conversationId
    send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: result.isNew })
  }

  const conversationId = socket.conversationId
  const status = await getConversationStatus(conversationId)

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
  setTimeout(() => send(socket, { type: 'typing:start' }), 300)

  // RAG
  ;(async () => {
    try {
      const ragResult = await queryRAG({ query: content, orgId, threshold: 0.3, maxChunks: 5 })
      send(socket, { type: 'typing:stop' })

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
      send(socket, { type: 'typing:stop' })
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

  const status = await getConversationStatus(conversationId)
  if (status === 'bot' || status === 'pending') {
    send(socket, { type: 'error', message: 'Take over the conversation first before sending messages.' })
    return
  }

  // ← CRITICAL FIX: deliver to visitor socket
  sendToVisitor(orgId, conversationId, {
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

  await updateConversation(conversationId, { status: 'open', assigned_to: socket.agentId ?? null })

  sendToVisitor(orgId, conversationId, {
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

  await updateConversation(conversationId, { status: 'bot', assigned_to: null })

  const reply = "You've been transferred back to our AI assistant. How can I help you?"
  sendToVisitor(orgId, conversationId, {
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

  await updateConversation(conversationId, { status: 'resolved' })

  sendToVisitor(orgId, conversationId, {
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

  const status = await getConversationStatus(conversationId)

  if (!status || status === 'resolved' || status === 'closed') {
    const result = await getOrCreateConversation({ orgId, visitorId: socket.visitorId! })
    socket.conversationId = result.conversationId
    send(socket, { type: 'conversation:ready', conversationId: result.conversationId, isNew: true })
    return
  }

  socket.conversationId = conversationId
  send(socket, { type: 'conversation:ready', conversationId, isNew: false, status })
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

  wss.on('connection', (socket: TinfinSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://localhost`)
    const orgId    = (url.searchParams.get('orgId') || '').trim()
    const visitorId = url.searchParams.get('visitorId') || crypto.randomUUID()
    const isAgent  = url.searchParams.get('type') === 'agent'
    const agentId  = url.searchParams.get('agentId') || undefined

    if (!orgId) return socket.close(1008, 'orgId required')

    socket.orgId    = orgId
    socket.visitorId = visitorId
    socket.isAgent  = isAgent
    socket.agentId  = agentId
    socket.isAlive  = true
    socket.awaitingHandoffConfirm = false

    if (!rooms.has(orgId)) rooms.set(orgId, new Set())
    rooms.get(orgId)!.add(socket)

    send(socket, { type: 'connected', visitorId })

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
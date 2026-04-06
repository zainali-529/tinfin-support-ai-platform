import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { createClient } from '@supabase/supabase-js'
import { queryRAG, isHandoffConfirmation } from '@workspace/ai'

interface TinfinSocket extends WebSocket {
  orgId?: string
  visitorId?: string
  isAlive?: boolean
  isAgent?: boolean
  awaitingHandoffConfirm?: boolean  // true jab AI ne ask_handoff bheja ho
}

const rooms = new Map<string, Set<TinfinSocket>>()

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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function persistMessage(params: {
  conversationId: string
  orgId: string
  role: 'user' | 'assistant'
  content: string
  aiMetadata?: Record<string, unknown>
}) {
  try {
    const supabase = getSupabase()
    await supabase.from('messages').insert({
      conversation_id: params.conversationId,
      org_id: params.orgId,
      role: params.role,
      content: params.content,
      ai_metadata: params.aiMetadata ?? null,
    })
  } catch (err) {
    console.error('[ws] Failed to persist message:', err)
  }
}

async function triggerHandoff(
  socket: TinfinSocket,
  conversationId: string,
  orgId: string
) {
  socket.awaitingHandoffConfirm = false

  send(socket, {
    type: 'ai:response',
    content: "I'm connecting you with a human agent now. Please hold on, someone will be with you shortly! 🙏",
    conversationId,
    createdAt: new Date().toISOString(),
    handoff: true,
    confidence: 1,
  })

  // Update conversation status to pending
  try {
    const supabase = getSupabase()
    await supabase
      .from('conversations')
      .update({ status: 'pending' })
      .eq('id', conversationId)
  } catch (err) {
    console.error('[ws] Failed to update conversation status:', err)
  }

  // Notify agents
  broadcastToAgents(orgId, {
    type: 'handoff:requested',
    visitorId: socket.visitorId,
    conversationId,
    createdAt: new Date().toISOString(),
  })

  // Persist
  if (conversationId) {
    await persistMessage({
      conversationId,
      orgId,
      role: 'assistant',
      content: "Connecting you with a human agent now.",
      aiMetadata: { shouldHandoff: true, confidence: 1 },
    })
  }
}

async function handleVisitorMessage(
  socket: TinfinSocket,
  msg: Record<string, unknown>
) {
  const content = (msg.content as string | undefined)?.trim() ?? ''
  const conversationId = (msg.conversationId as string | undefined) ?? ''
  const orgId = socket.orgId!.trim()

  if (!content) return

  // Broadcast to agents
  broadcastToAgents(orgId, {
    type: 'visitor:message',
    visitorId: socket.visitorId,
    content,
    conversationId,
    createdAt: new Date().toISOString(),
  })

  // Persist visitor message
  if (conversationId) {
    await persistMessage({ conversationId, orgId, role: 'user', content })
  }

  // ── If we were waiting for handoff confirmation ───────────────────────────
  if (socket.awaitingHandoffConfirm) {
    if (isHandoffConfirmation(content)) {
      // User said yes → do handoff
      await triggerHandoff(socket, conversationId, orgId)
      return
    } else {
      // User said no or asked something else → reset flag, continue normally
      socket.awaitingHandoffConfirm = false
      send(socket, {
        type: 'ai:response',
        content: "No problem! Feel free to ask me anything else. 😊",
        conversationId,
        createdAt: new Date().toISOString(),
        handoff: false,
        confidence: 1,
      })
      return
    }
  }

  // Show typing indicator
  setTimeout(() => send(socket, { type: 'typing:start' }), 300)

  // Run RAG
  ;(async () => {
    try {
      const ragResult = await queryRAG({
        query: content,
        orgId,
        threshold: 0.3,
        maxChunks: 5,
      })

      send(socket, { type: 'typing:stop' })

      if (ragResult.type === 'handoff') {
        // Explicit handoff (user asked for human)
        await triggerHandoff(socket, conversationId, orgId)

      } else if (ragResult.type === 'ask_handoff') {
        // Out of scope → ask user if they want human agent
        socket.awaitingHandoffConfirm = true

        send(socket, {
          type: 'ai:response',
          content: ragResult.message,
          conversationId,
          createdAt: new Date().toISOString(),
          handoff: false,
          confidence: ragResult.confidence,
        })

        if (conversationId) {
          await persistMessage({
            conversationId,
            orgId,
            role: 'assistant',
            content: ragResult.message,
            aiMetadata: {
              confidence: ragResult.confidence,
              shouldHandoff: false,
              awaitingConfirm: true,
              sources: ragResult.sources,
            },
          })
        }

      } else {
        // 'answer' or 'casual' — normal response
        send(socket, {
          type: 'ai:response',
          content: ragResult.message,
          conversationId,
          createdAt: new Date().toISOString(),
          handoff: false,
          confidence: ragResult.confidence,
        })

        if (conversationId) {
          await persistMessage({
            conversationId,
            orgId,
            role: 'assistant',
            content: ragResult.message,
            aiMetadata: {
              confidence: ragResult.confidence,
              shouldHandoff: false,
              sources: ragResult.sources,
              tokensUsed: ragResult.tokensUsed,
            },
          })
        }
      }

    } catch (err) {
      console.error('[ws] RAG pipeline error:', err)
      send(socket, { type: 'typing:stop' })
      send(socket, {
        type: 'ai:response',
        content: "I'm having a little trouble right now. Would you like me to connect you with a human agent? (Reply **yes** to connect)",
        conversationId,
        createdAt: new Date().toISOString(),
        handoff: false,
        confidence: 0,
      })
      socket.awaitingHandoffConfirm = true
    }
  })()
}

export function createWsServer(port: number) {
  const wss = new WebSocketServer({ port })

  wss.on('connection', (socket: TinfinSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://localhost`)
    const orgId = (url.searchParams.get('orgId') || '').trim()
    const visitorId = url.searchParams.get('visitorId') || crypto.randomUUID()
    const isAgent = url.searchParams.get('type') === 'agent'

    if (!orgId) return socket.close(1008, 'orgId required')

    socket.orgId = orgId
    socket.visitorId = visitorId
    socket.isAgent = isAgent
    socket.isAlive = true
    socket.awaitingHandoffConfirm = false

    if (!rooms.has(orgId)) rooms.set(orgId, new Set())
    rooms.get(orgId)!.add(socket)

    send(socket, { type: 'connected', visitorId })

    socket.on('pong', () => { socket.isAlive = true })

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>
        await handleMessage(socket, msg)
      } catch {}
    })

    socket.on('close', () => {
      rooms.get(orgId)?.delete(socket)
      if (rooms.get(orgId)?.size === 0) rooms.delete(orgId)
    })

    socket.on('error', () => socket.terminate())
  })

  setInterval(() => {
    wss.clients.forEach((ws) => {
      const s = ws as TinfinSocket
      if (!s.isAlive) return s.terminate()
      s.isAlive = false
      s.ping()
    })
  }, 30_000)

  console.log(`WS: ws://localhost:${port}`)
  return wss
}

async function handleMessage(
  socket: TinfinSocket,
  msg: Record<string, unknown>
) {
  const { type } = msg

  switch (type) {
    case 'visitor:message': {
      await handleVisitorMessage(socket, msg)
      break
    }

    case 'agent:message': {
      rooms.get(socket.orgId!)?.forEach(s => {
        if (!s.isAgent && s.readyState === WebSocket.OPEN) {
          send(s, {
            type: 'agent:message',
            content: msg.content,
            conversationId: msg.conversationId,
            createdAt: new Date().toISOString(),
          })
        }
      })
      send(socket, { type: 'message:sent', conversationId: msg.conversationId })
      break
    }

    case 'typing:start':
    case 'typing:stop': {
      broadcastToAgents(socket.orgId!, { type, visitorId: socket.visitorId })
      break
    }

    case 'ping':
      send(socket, { type: 'pong' })
      break
  }
}
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Message, StoredChat, VisitorInfo, WidgetConversation, ConversationStatus, Attachment } from './types'

const WS_URL = (import.meta as any).env?.VITE_API_WS_URL || 'ws://localhost:3003'
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getStorageKey(orgId: string) {
  return `tinfin_chat_${orgId}`
}

function loadStoredChat(orgId: string): StoredChat {
  try {
    const raw = localStorage.getItem(getStorageKey(orgId))
    if (raw) {
      const parsed = JSON.parse(raw) as StoredChat

      if (!parsed.messagesByConversation) {
        const legacyConversationId = parsed.activeConversationId ?? parsed.conversationId ?? null
        const legacyMessages = parsed.messages ?? []
        return {
          visitorId: parsed.visitorId,
          visitorInfo: parsed.visitorInfo,
          activeConversationId: legacyConversationId,
          conversations: parsed.conversations ?? [],
          messagesByConversation: legacyConversationId
            ? { [legacyConversationId]: legacyMessages }
            : {},
        }
      }

      return parsed
    }
  } catch {}
  return {
    visitorId: uid(),
    visitorInfo: null,
    activeConversationId: null,
    conversations: [],
    messagesByConversation: {},
  }
}

function saveStoredChat(orgId: string, data: StoredChat) {
  try {
    localStorage.setItem(getStorageKey(orgId), JSON.stringify(data))
  } catch {}
}

function sortConversations(items: WidgetConversation[]) {
  return [...items].sort((a, b) => {
    const aTs = new Date(a.lastMessageAt || a.startedAt).getTime()
    const bTs = new Date(b.lastMessageAt || b.startedAt).getTime()
    return bTs - aTs
  })
}

export function useChat(orgId: string) {
  const stored = useRef<StoredChat>(loadStoredChat(orgId))
  const visitorIdRef = useRef<string>(stored.current.visitorId)
  const visitorInfoRef = useRef<VisitorInfo | null>(stored.current.visitorInfo)
  const conversationsRef = useRef<WidgetConversation[]>(stored.current.conversations ?? [])
  const activeConversationIdRef = useRef<string | null>(stored.current.activeConversationId)
  const pendingUserMessagesRef = useRef<Message[]>([])

  const normalizeMessages = useCallback((items: Array<{
    id: string
    role: 'user' | 'assistant' | 'agent'
    content: string
    createdAt: string
    attachments?: Attachment[]
  }>) => {
    return items.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: new Date(message.createdAt),
      attachments: message.attachments ?? [],
    }))
  }, [])

  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>(() => {
    const next: Record<string, Message[]> = {}
    const source = stored.current.messagesByConversation ?? {}
    for (const conversationId of Object.keys(source)) {
      next[conversationId] = normalizeMessages(source[conversationId] ?? [])
    }
    return next
  })

  const messagesByConversationRef = useRef<Record<string, Message[]>>(messagesByConversation)
  useEffect(() => {
    messagesByConversationRef.current = messagesByConversation
  }, [messagesByConversation])

  const [conversations, setConversations] = useState<WidgetConversation[]>(
    sortConversations(stored.current.conversations ?? [])
  )
  const [activeConversationId, setActiveConversationId] = useState<string | null>(stored.current.activeConversationId)
  const [typing, setTyping] = useState(false)
  const [connected, setConnected] = useState(false)
  const [agentActive, setAgentActive] = useState(false)
  const [visitorId, setVisitorId] = useState<string>(stored.current.visitorId)
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo | null>(stored.current.visitorInfo)

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const status = conversations.find(item => item.id === activeConversationId)?.status
    setAgentActive(status === 'open')
  }, [conversations, activeConversationId])

  const persist = useCallback(() => {
    const data: StoredChat = {
      visitorId: visitorIdRef.current,
      visitorInfo: visitorInfoRef.current,
      activeConversationId: activeConversationIdRef.current,
      conversations: conversationsRef.current,
      messagesByConversation: Object.fromEntries(
        Object.entries(messagesByConversationRef.current).map(([conversationId, list]) => [
          conversationId,
          list.map(message => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
            attachments: message.attachments ?? [],
          })),
        ])
      ),
    }
    stored.current = data
    saveStoredChat(orgId, data)
  }, [orgId])

  const setConversationList = useCallback((next: WidgetConversation[]) => {
    const sorted = sortConversations(next)
    conversationsRef.current = sorted
    setConversations(sorted)
    persist()
  }, [persist])

  const updateConversation = useCallback((conversationId: string, patch: Partial<WidgetConversation>) => {
    const current = conversationsRef.current
    const idx = current.findIndex(item => item.id === conversationId)
    if (idx === -1) {
      const fresh: WidgetConversation = {
        id: conversationId,
        status: (patch.status as ConversationStatus | undefined) ?? 'bot',
        startedAt: patch.startedAt ?? new Date().toISOString(),
        resolvedAt: patch.resolvedAt ?? null,
        contactName: patch.contactName ?? visitorInfoRef.current?.name ?? null,
        contactEmail: patch.contactEmail ?? visitorInfoRef.current?.email ?? null,
        lastMessage: patch.lastMessage ?? '',
        lastMessageAt: patch.lastMessageAt ?? patch.startedAt ?? new Date().toISOString(),
      }
      setConversationList([fresh, ...current])
      return
    }

    const next = [...current]
    const existing = next[idx]
    if (!existing) return
    next[idx] = { ...existing, ...patch }
    setConversationList(next)
  }, [setConversationList])

  const setConversationMessages = useCallback((conversationId: string, list: Message[]) => {
    setMessagesByConversation(prev => {
      const next = { ...prev, [conversationId]: list }
      messagesByConversationRef.current = next
      persist()
      return next
    })
  }, [persist])

  const addMessage = useCallback((conversationId: string, msg: Message) => {
    setMessagesByConversation(prev => {
      const current = prev[conversationId] ?? []
      if (current.find(item => item.id === msg.id)) return prev
      const next = { ...prev, [conversationId]: [...current, msg] }
      messagesByConversationRef.current = next
      persist()
      return next
    })

    const preview = msg.attachments?.length
      ? `📎 ${msg.attachments[0]?.name ?? 'File'}`
      : msg.content

    updateConversation(conversationId, {
      lastMessage: preview,
      lastMessageAt: msg.createdAt.toISOString(),
    })
  }, [persist, updateConversation])

  const requestInbox = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'conversations:list' }))
    }
  }, [])

  const openConversation = useCallback((conversationId: string) => {
    activeConversationIdRef.current = conversationId
    setActiveConversationId(conversationId)
    persist()

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'conversation:select', conversationId }))
    }
  }, [persist])

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>
    let ws: WebSocket
    let dead = false

    const connect = () => {
      if (dead) return
      ws = new WebSocket(
        `${WS_URL}?orgId=${encodeURIComponent(orgId)}&visitorId=${encodeURIComponent(visitorIdRef.current)}&type=visitor`
      )
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        requestInbox()

        if (activeConversationIdRef.current) {
          ws.send(JSON.stringify({
            type: 'conversation:select',
            conversationId: activeConversationIdRef.current,
          }))
        }

        if (stored.current.visitorInfo) {
          ws.send(JSON.stringify({
            type: 'visitor:identify',
            name: stored.current.visitorInfo.name,
            email: stored.current.visitorInfo.email,
            visitorId: visitorIdRef.current,
          }))
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (!dead) reconnectTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => setConnected(false)

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as Record<string, unknown>

          switch (msg.type) {
            case 'connected':
              if (typeof msg.visitorId === 'string' && msg.visitorId.length > 0) {
                visitorIdRef.current = msg.visitorId
                setVisitorId(msg.visitorId)
                persist()
              }
              break

            case 'conversations:list': {
              const list = ((msg.conversations as WidgetConversation[] | undefined) ?? []).map(item => ({
                ...item,
                contactName: item.contactName ?? visitorInfoRef.current?.name ?? null,
                contactEmail: item.contactEmail ?? visitorInfoRef.current?.email ?? null,
              }))
              setConversationList(list)

              if (!activeConversationIdRef.current && list.length > 0) {
                const first = list[0]
                if (!first) break
                activeConversationIdRef.current = first.id
                setActiveConversationId(first.id)
                persist()
              }
              break
            }

            case 'conversation:ready': {
              const cid = msg.conversationId as string
              activeConversationIdRef.current = cid
              setActiveConversationId(cid)
              updateConversation(cid, {
                status: (msg.status as ConversationStatus | undefined) ?? 'bot',
              })

              setAgentActive((msg.status as ConversationStatus | undefined) === 'open')

              if (msg.isNew) {
                const pendingMessages = pendingUserMessagesRef.current
                pendingUserMessagesRef.current = []
                setConversationMessages(cid, pendingMessages)
                requestInbox()
              }
              persist()
              break
            }

            case 'conversation:history': {
              const cid = msg.conversationId as string
              const history = ((msg.messages as Array<Record<string, unknown>> | undefined) ?? []).map(item => ({
                id: (item.id as string) || uid(),
                role: (item.role as 'user' | 'assistant' | 'agent') || 'assistant',
                content: (item.content as string) || '',
                createdAt: new Date((item.created_at as string) || Date.now()),
                attachments: (item.attachments as Attachment[] | undefined) ?? [],
              }))
              setConversationMessages(cid, history)
              const latest = history[history.length - 1]
              if (!latest) break
              const preview = latest.attachments?.length
                ? `📎 ${latest.attachments[0]?.name ?? 'File'}`
                : latest.content
              updateConversation(cid, {
                lastMessage: preview,
                lastMessageAt: latest.createdAt.toISOString(),
              })
              break
            }

            case 'typing:start': {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid || cid === activeConversationIdRef.current) setTyping(true)
              break
            }
            case 'typing:stop': {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid || cid === activeConversationIdRef.current) setTyping(false)
              break
            }

            case 'ai:response': {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid) break
              if (cid === activeConversationIdRef.current) setTyping(false)
              addMessage(cid, {
                id: uid(),
                role: 'assistant',
                content: msg.content as string,
                createdAt: new Date(),
                attachments: [],
              })
              break
            }

            case 'agent:message': {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid) break
              if (cid === activeConversationIdRef.current) setTyping(false)
              addMessage(cid, {
                id: uid(),
                role: 'agent',
                content: (msg.content as string) || '',
                createdAt: new Date(),
                attachments: (msg.attachments as Attachment[] | undefined) ?? [],
              })
              break
            }

            case 'agent:joined': {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid) break
              if (cid === activeConversationIdRef.current) setAgentActive(true)
              updateConversation(cid, { status: 'open' })
              addMessage(cid, {
                id: uid(),
                role: 'assistant',
                content: '— A support agent has joined the chat —',
                createdAt: new Date(),
                attachments: [],
              })
              break
            }

            case 'bot:resumed': {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid) break
              if (cid === activeConversationIdRef.current) setAgentActive(false)
              updateConversation(cid, { status: 'bot' })
              addMessage(cid, {
                id: uid(),
                role: 'assistant',
                content: msg.content as string,
                createdAt: new Date(),
                attachments: [],
              })
              break
            }

            case 'conversation:resolved': {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid) break
              if (cid === activeConversationIdRef.current) {
                setAgentActive(false)
                setTyping(false)
              }
              updateConversation(cid, { status: 'resolved' })
              addMessage(cid, {
                id: uid(),
                role: 'assistant',
                content: (msg.content as string) || '— This conversation has been resolved. Thank you! 😊 —',
                createdAt: new Date(),
                attachments: [],
              })
              break
            }
          }
        } catch (e) {
          console.error('[widget ws] parse error', e)
        }
      }
    }

    connect()
    return () => {
      dead = true
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [orgId, addMessage, persist, requestInbox, setConversationList, setConversationMessages, updateConversation])

  // ── Send text message ─────────────────────────────────────────────────────

  const sendMessage = useCallback((content: string, attachments?: Attachment[]) => {
    const message: Message = {
      id: uid(),
      role: 'user',
      content,
      createdAt: new Date(),
      attachments: attachments ?? [],
    }
    const conversationId = activeConversationIdRef.current

    if (conversationId) {
      const currentConversation = conversationsRef.current.find(item => item.id === conversationId)
      if (currentConversation?.status === 'resolved' || currentConversation?.status === 'closed') {
        return
      }
    }

    if (conversationId) {
      addMessage(conversationId, message)
    } else {
      pendingUserMessagesRef.current = [...pendingUserMessagesRef.current, message]
    }

    const visitor = stored.current.visitorInfo
    wsRef.current?.send(JSON.stringify({
      type: 'visitor:message',
      content,
      conversationId,
      visitorId: visitorIdRef.current,
      attachments: attachments ?? [],
      ...(visitor ? {
        name: visitor.name,
        email: visitor.email,
        visitorInfo: visitor,
      } : {}),
    }))
  }, [addMessage])

  // ── Upload file to storage ────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File): Promise<Attachment> => {
    const conversationId = activeConversationIdRef.current

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = reader.result as string

          const res = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64,
              filename: file.name,
              mimeType: file.type,
              orgId,
              conversationId: conversationId ?? undefined,
            }),
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string }
            throw new Error(err.error ?? 'Upload failed')
          }

          const data = await res.json() as Attachment
          resolve(data)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }, [orgId])

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: isTyping ? 'typing:start' : 'typing:stop' }))
    }
  }, [])

  const startNewChat = useCallback(() => {
    activeConversationIdRef.current = null
    setActiveConversationId(null)
    setAgentActive(false)
    pendingUserMessagesRef.current = []
    persist()
    wsRef.current?.send(JSON.stringify({ type: 'conversation:new' }))
  }, [persist])

  const initWithVisitorInfo = useCallback((info: VisitorInfo) => {
    setVisitorInfo(info)
    visitorInfoRef.current = info
    stored.current.visitorInfo = info
    persist()
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'visitor:identify',
        name: info.name,
        email: info.email,
        visitorId: visitorIdRef.current,
      }))
      requestInbox()
    }
  }, [persist, requestInbox])

  const messages = useMemo(
    () => (activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : []),
    [activeConversationId, messagesByConversation]
  )

  const activeConversation = useMemo(
    () => conversations.find(item => item.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  )

  return {
    messages,
    conversations,
    activeConversation,
    activeConversationId,
    typing,
    connected,
    agentActive,
    visitorId,
    visitorInfo,
    sendMessage,
    uploadFile,
    sendTyping,
    startNewChat,
    openConversation,
    refreshInbox: requestInbox,
    initWithVisitorInfo,
  }
}
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Message, StoredChat, VisitorInfo, WidgetConversation, ConversationStatus } from './types'

const WS_URL = (import.meta as any).env?.VITE_API_WS_URL || 'ws://localhost:3003'

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

      // Backward compatibility with old storage shape.
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

  const normalizeMessages = useCallback((items: Array<{ id: string; role: 'user' | 'assistant' | 'agent'; content: string; createdAt: string }>) => {
    return items.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: new Date(message.createdAt),
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
    const updated: WidgetConversation = { ...existing, ...patch }
    next[idx] = updated
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

    updateConversation(conversationId, {
      lastMessage: msg.content,
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

        // Restore active conversation if we have one.
        if (activeConversationIdRef.current) {
          ws.send(JSON.stringify({
            type: 'conversation:select',
            conversationId: activeConversationIdRef.current,
          }))
        }

        // Re-identify after reconnect/page load to avoid contact race conditions.
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
              visitorIdRef.current = msg.visitorId as string
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
              }))
              setConversationMessages(cid, history)
              const latest = history[history.length - 1]
              if (!latest) break
              updateConversation(cid, {
                lastMessage: latest.content,
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

            case 'ai:response':
            {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid) break
              if (cid === activeConversationIdRef.current) setTyping(false)
              addMessage(cid, {
                id: uid(),
                role: 'assistant',
                content: msg.content as string,
                createdAt: new Date(),
              })
              break
            }

            // ← THIS IS THE FIX: agent:message must update widget
            case 'agent:message':
            {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid) break
              if (cid === activeConversationIdRef.current) setTyping(false)
              addMessage(cid, {
                id: uid(),
                role: 'agent',
                content: msg.content as string,
                createdAt: new Date(),
              })
              break
            }

            case 'agent:joined':
            {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid) break
              if (cid === activeConversationIdRef.current) setAgentActive(true)
              updateConversation(cid, { status: 'open' })
              addMessage(cid, {
                id: uid(),
                role: 'assistant',
                content: '— A support agent has joined the chat —',
                createdAt: new Date(),
              })
              break
            }

            case 'bot:resumed':
            {
              const cid = (msg.conversationId as string | undefined) ?? activeConversationIdRef.current
              if (!cid) break
              if (cid === activeConversationIdRef.current) setAgentActive(false)
              updateConversation(cid, { status: 'bot' })
              addMessage(cid, {
                id: uid(),
                role: 'assistant',
                content: msg.content as string,
                createdAt: new Date(),
              })
              break
            }

            case 'conversation:resolved':
            {
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

  const sendMessage = useCallback((content: string) => {
    const message: Message = { id: uid(), role: 'user', content, createdAt: new Date() }
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
      ...(visitor ? {
        name: visitor.name,
        email: visitor.email,
        visitorInfo: visitor,
      } : {}),
    }))
  }, [addMessage])

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

  // Called after pre-chat form submission
  const initWithVisitorInfo = useCallback((info: VisitorInfo) => {
    setVisitorInfo(info)
    visitorInfoRef.current = info
    stored.current.visitorInfo = info
    persist()
    // Send visitor info to server so contact gets updated
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
    visitorInfo,
    sendMessage,
    sendTyping,
    startNewChat,
    openConversation,
    refreshInbox: requestInbox,
    initWithVisitorInfo,
  }
}
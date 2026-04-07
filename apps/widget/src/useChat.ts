import { useState, useEffect, useRef, useCallback } from 'react'
import type { Message, StoredChat, VisitorInfo } from './types'

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
    if (raw) return JSON.parse(raw) as StoredChat
  } catch {}
  return { visitorId: uid(), visitorInfo: null, conversationId: null, messages: [] }
}

function saveStoredChat(orgId: string, data: StoredChat) {
  try {
    localStorage.setItem(getStorageKey(orgId), JSON.stringify(data))
  } catch {}
}

export function useChat(orgId: string) {
  const stored = useRef<StoredChat>(loadStoredChat(orgId))
  const visitorIdRef = useRef<string>(stored.current.visitorId)
  const conversationIdRef = useRef<string | null>(stored.current.conversationId)

  const [messages, setMessages] = useState<Message[]>(() =>
    stored.current.messages.map(m => ({ ...m, createdAt: new Date(m.createdAt) }))
  )
  const [typing, setTyping] = useState(false)
  const [connected, setConnected] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(stored.current.conversationId)
  const [agentActive, setAgentActive] = useState(false)
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo | null>(stored.current.visitorInfo)

  const wsRef = useRef<WebSocket | null>(null)

  const persist = useCallback((msgs: Message[], convId: string | null, info: VisitorInfo | null) => {
    const data: StoredChat = {
      visitorId: visitorIdRef.current,
      visitorInfo: info,
      conversationId: convId,
      messages: msgs.map(m => ({
        id: m.id, role: m.role, content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    }
    stored.current = data
    saveStoredChat(orgId, data)
  }, [orgId])

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => {
      // Deduplicate
      if (prev.find(m => m.id === msg.id)) return prev
      const next = [...prev, msg]
      persist(next, conversationIdRef.current, stored.current.visitorInfo)
      return next
    })
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
        // Resume existing conversation if we have one
        if (conversationIdRef.current) {
          ws.send(JSON.stringify({
            type: 'conversation:resume',
            conversationId: conversationIdRef.current,
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

            case 'conversation:ready': {
              const cid = msg.conversationId as string
              conversationIdRef.current = cid
              setConversationId(cid)
              if (msg.isNew) {
                setMessages([])
                persist([], cid, stored.current.visitorInfo)
              }
              break
            }

            case 'typing:start': setTyping(true); break
            case 'typing:stop':  setTyping(false); break

            case 'ai:response':
              setTyping(false)
              addMessage({ id: uid(), role: 'assistant', content: msg.content as string, createdAt: new Date() })
              break

            // ← THIS IS THE FIX: agent:message must update widget
            case 'agent:message':
              setTyping(false)
              addMessage({ id: uid(), role: 'agent', content: msg.content as string, createdAt: new Date() })
              break

            case 'agent:joined':
              setAgentActive(true)
              addMessage({ id: uid(), role: 'assistant', content: '— A support agent has joined the chat —', createdAt: new Date() })
              break

            case 'bot:resumed':
              setAgentActive(false)
              addMessage({ id: uid(), role: 'assistant', content: msg.content as string, createdAt: new Date() })
              break

            case 'conversation:resolved':
              setAgentActive(false)
              addMessage({ id: uid(), role: 'assistant', content: '— This conversation has been resolved. Thank you! 😊 —', createdAt: new Date() })
              break
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
  }, [orgId, addMessage, persist])

  const sendMessage = useCallback((content: string) => {
    addMessage({ id: uid(), role: 'user', content, createdAt: new Date() })
    wsRef.current?.send(JSON.stringify({
      type: 'visitor:message',
      content,
      conversationId: conversationIdRef.current,
      visitorId: visitorIdRef.current,
    }))
  }, [addMessage])

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: isTyping ? 'typing:start' : 'typing:stop' }))
    }
  }, [])

  const startNewChat = useCallback(() => {
    conversationIdRef.current = null
    setConversationId(null)
    setMessages([])
    setAgentActive(false)
    persist([], null, stored.current.visitorInfo)
    wsRef.current?.send(JSON.stringify({ type: 'conversation:new' }))
  }, [persist])

  // Called after pre-chat form submission
  const initWithVisitorInfo = useCallback((info: VisitorInfo) => {
    setVisitorInfo(info)
    stored.current.visitorInfo = info
    persist(stored.current.messages.map(m => ({ ...m, createdAt: new Date(m.createdAt) })), conversationIdRef.current, info)
    // Send visitor info to server so contact gets updated
    wsRef.current?.send(JSON.stringify({
      type: 'visitor:identify',
      name: info.name,
      email: info.email,
      visitorId: visitorIdRef.current,
    }))
  }, [persist])

  return {
    messages, typing, connected, conversationId,
    agentActive, visitorInfo,
    sendMessage, sendTyping, startNewChat, initWithVisitorInfo,
  }
}
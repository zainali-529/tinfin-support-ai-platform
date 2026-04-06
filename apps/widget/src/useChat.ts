import { useState, useEffect, useRef, useCallback } from 'react'
import type { Message } from './types'

const WS_URL = (import.meta as any).env?.VITE_API_WS_URL || 'ws://localhost:3003'

function uid() { return Math.random().toString(36).slice(2) }

export function useChat(orgId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [typing, setTyping] = useState(false)
  const [connected, setConnected] = useState(false)
  const [conversationId] = useState(() => uid())
  const wsRef = useRef<WebSocket | null>(null)
  const visitorIdRef = useRef<string>(uid())

  useEffect(() => {
    const ws = new WebSocket(
      `${WS_URL}?orgId=${orgId}&visitorId=${visitorIdRef.current}&type=visitor`
    )
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'connected') {
          visitorIdRef.current = msg.visitorId
          return
        }

        if (msg.type === 'typing:start') { setTyping(true); return }
        if (msg.type === 'typing:stop') { setTyping(false); return }

        if (msg.type === 'ai:response' || msg.type === 'agent:message') {
          setTyping(false)
          setMessages(prev => [...prev, {
            id: uid(),
            role: msg.type === 'agent:message' ? 'agent' : 'assistant',
            content: msg.content as string,
            createdAt: new Date(),
          }])
        }
      } catch {}
    }

    return () => ws.close()
  }, [orgId])

  const sendMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      id: uid(), role: 'user', content, createdAt: new Date()
    }])

    wsRef.current?.send(JSON.stringify({
      type: 'visitor:message',
      content,
      conversationId,
      visitorId: visitorIdRef.current,
    }))
  }, [conversationId])

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: isTyping ? 'typing:start' : 'typing:stop',
      }))
    }
  }, [])

  return { messages, typing, connected, sendMessage, sendTyping }
}
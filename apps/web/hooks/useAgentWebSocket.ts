'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export interface AgentWebSocketPayload {
  [key: string]: unknown
}

export function useAgentWebSocket(
  orgId: string,
  agentId: string,
  onMessage?: (payload: AgentWebSocketPayload) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef<typeof onMessage>(onMessage)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!orgId || !agentId) return

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3003'
    const supabase = createClient()
    let ws: WebSocket | null = null
    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token

      if (cancelled) {
        setConnected(false)
        return
      }
      if (!token) {
        setConnected(false)
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          void connect()
        }, 900)
        return
      }

      const params = new URLSearchParams({
        orgId,
        type: 'agent',
        agentId,
        token,
      })

      ws = new WebSocket(`${wsUrl}?${params.toString()}`)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (!cancelled) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            void connect()
          }, 1200)
        }
      }
      ws.onerror = () => setConnected(false)
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as AgentWebSocketPayload
          onMessageRef.current?.(payload)
        } catch {
          // ignore malformed payload
        }
      }
    }

    void connect()
    return () => {
      cancelled = true
      setConnected(false)
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      ws?.close()
    }
  }, [agentId, orgId])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false
    wsRef.current.send(JSON.stringify(data))
    return true
  }, [])

  return { send, connected }
}

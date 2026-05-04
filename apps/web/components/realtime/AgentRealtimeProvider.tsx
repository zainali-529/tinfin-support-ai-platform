'use client'

import * as React from 'react'
import type { AgentRealtimeEvent, AgentRealtimeOutboundEvent } from '@workspace/types'
import { isAgentRealtimeEvent } from '@workspace/types'
import { useActiveOrg } from '@/components/org/OrgContext'
import { createClient } from '@/lib/supabase'

type AgentRealtimeListener = (event: AgentRealtimeEvent) => void

interface AgentRealtimeContextValue {
  connected: boolean
  send: (event: AgentRealtimeOutboundEvent) => boolean
  subscribe: (listener: AgentRealtimeListener) => () => void
}

const AgentRealtimeContext = React.createContext<AgentRealtimeContextValue | null>(null)

export function AgentRealtimeProvider({ children }: { children: React.ReactNode }) {
  const activeOrg = useActiveOrg()
  const orgId = activeOrg.id
  const [agentId, setAgentId] = React.useState<string | null>(null)
  const [connected, setConnected] = React.useState(false)
  const wsRef = React.useRef<WebSocket | null>(null)
  const listenersRef = React.useRef(new Set<AgentRealtimeListener>())

  React.useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setAgentId(data.session?.user.id ?? null)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAgentId(session?.user.id ?? null)
    })

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    if (!orgId || !agentId) {
      setConnected(false)
      return
    }

    const supabase = createClient()
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3003'
    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let socket: WebSocket | null = null

    const clearReconnectTimer = () => {
      if (!reconnectTimer) return
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        void connect()
      }, 1200)
    }

    const connect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token

      if (cancelled) return
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

      socket = new WebSocket(`${wsUrl}?${params.toString()}`)
      wsRef.current = socket

      socket.onopen = () => {
        if (!cancelled) setConnected(true)
      }

      socket.onclose = () => {
        if (wsRef.current === socket) wsRef.current = null
        setConnected(false)
        scheduleReconnect()
      }

      socket.onerror = () => {
        setConnected(false)
      }

      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data) as unknown
          if (!isAgentRealtimeEvent(payload)) return
          listenersRef.current.forEach((listener) => listener(payload))
        } catch {
          // Ignore malformed realtime payloads instead of breaking the shared socket.
        }
      }
    }

    void connect()

    return () => {
      cancelled = true
      setConnected(false)
      clearReconnectTimer()
      if (wsRef.current === socket) wsRef.current = null
      socket?.close()
    }
  }, [agentId, orgId])

  const subscribe = React.useCallback((listener: AgentRealtimeListener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const send = React.useCallback((event: AgentRealtimeOutboundEvent) => {
    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(event))
    return true
  }, [])

  const value = React.useMemo<AgentRealtimeContextValue>(
    () => ({
      connected,
      send,
      subscribe,
    }),
    [connected, send, subscribe]
  )

  return (
    <AgentRealtimeContext.Provider value={value}>
      {children}
    </AgentRealtimeContext.Provider>
  )
}

export function useAgentRealtime() {
  const context = React.useContext(AgentRealtimeContext)
  if (!context) {
    throw new Error('useAgentRealtime must be used inside AgentRealtimeProvider')
  }
  return context
}

export function useAgentRealtimeListener(listener: AgentRealtimeListener | null | undefined) {
  const { subscribe } = useAgentRealtime()

  React.useEffect(() => {
    if (!listener) return
    return subscribe(listener)
  }, [listener, subscribe])
}

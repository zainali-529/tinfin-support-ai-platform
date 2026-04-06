'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRealtimeTable } from './useRealtime'
import type { Conversation } from '@/types/database'

export function useConversations(orgId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!orgId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('conversations')
      .select('*, contacts(*), messages(id, role, content, created_at)')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(100)

    setConversations((data as Conversation[]) ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  useRealtimeTable<Conversation>('conversations', orgId, '*', useCallback((payload) => {
    if (payload.eventType === 'INSERT') {
      setConversations(prev => [payload.new, ...prev])
    } else if (payload.eventType === 'UPDATE') {
      setConversations(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c))
    } else if (payload.eventType === 'DELETE') {
      setConversations(prev => prev.filter(c => c.id !== (payload.old as any).id))
    }
  }, []))

  return { conversations, loading, refetch: fetch }
}
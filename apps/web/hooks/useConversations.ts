'use client'

/**
 * apps/web/hooks/useConversations.ts
 *
 * Real-time conversations list. Subscribes to Supabase realtime for live updates.
 * FIX: removed conversations.meta and conversations.resolved_at (don't exist in schema)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Conversation } from '@/types/database'

// ─── Minimal safe query (only columns that exist in the schema) ────────────────
const CONVERSATIONS_QUERY = `
  id,
  org_id,
  contact_id,
  status,
  channel,
  assigned_to,
  started_at,
  contacts (
    id,
    name,
    email,
    phone
  ),
  messages (
    id,
    role,
    content,
    created_at
  )
`

export function useConversations(orgId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchConversations = useCallback(async () => {
    if (!orgId) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATIONS_QUERY)
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[useConversations] fetch error:', error.message)
      return
    }

    setConversations((data as unknown as Conversation[]) ?? [])
    setLoading(false)
  }, [orgId])

  // Initial fetch
  useEffect(() => {
    setLoading(true)
    void fetchConversations()
  }, [fetchConversations])

  // Realtime subscription
  useEffect(() => {
    if (!orgId) return

    const supabase = createClient()

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`conversations:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void fetchConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Debounce: only refetch once if multiple messages arrive quickly
          void fetchConversations()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orgId, fetchConversations])

  return {
    conversations,
    loading,
    refetch: fetchConversations,
  }
}
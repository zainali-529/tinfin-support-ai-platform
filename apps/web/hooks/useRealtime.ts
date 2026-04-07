'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export function useRealtimeTable<T>(
  table: string,
  orgId: string,
  event: RealtimeEvent = '*',
  callback: (payload: { eventType: string; new: T; old: T }) => void
) {
  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()
    const eventKey = event === '*' ? 'all' : event.toLowerCase()
    const subscriptionId = `rt_${Math.random().toString(36).slice(2, 10)}`
    const channel = supabase
      .channel(`${table}:${orgId}:${eventKey}:${subscriptionId}`)
      .on(
        'postgres_changes' as any,
        { event, schema: 'public', table, filter: `org_id=eq.${orgId}` },
        callback
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [table, orgId, event, callback])
}
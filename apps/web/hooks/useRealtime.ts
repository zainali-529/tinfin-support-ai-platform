'use client'

import { useEffect, useCallback } from 'react'
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
    const channel = supabase
      .channel(`${table}:${orgId}`)
      .on(
        'postgres_changes' as any,
        { event, schema: 'public', table, filter: `org_id=eq.${orgId}` },
        callback
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [table, orgId, event, callback])
}
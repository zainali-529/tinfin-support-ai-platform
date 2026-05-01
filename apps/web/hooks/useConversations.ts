'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { createClient } from '@/lib/supabase'
import type { Conversation } from '@/types/database'

type StatusFilter = 'all' | 'bot' | 'open' | 'pending' | 'resolved'
type ChannelFilter = 'all' | 'chat' | 'email' | 'whatsapp'
type QueueFilter = 'all' | 'bot' | 'queued' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved'

interface UseConversationsOptions {
  channelFilter?: ChannelFilter | null
  statusFilter?: StatusFilter
  queueFilter?: QueueFilter
  search?: string
  limit?: number
}

export function useConversations(orgId: string, options?: UseConversationsOptions) {
  const limit = options?.limit ?? 10
  const channelFilter = options?.channelFilter ?? 'all'
  const statusFilter = options?.statusFilter ?? 'all'
  const queueFilter = options?.queueFilter ?? 'all'
  const search = options?.search?.trim() ?? ''

  const [page, setPage] = useState(1)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const query = trpc.chat.getConversations.useQuery(
    {
      page,
      limit,
      channel: channelFilter,
      status: statusFilter,
      queue: queueFilter,
      search: search || undefined,
    },
    {
      enabled: Boolean(orgId),
      staleTime: 30_000,
    }
  )

  useEffect(() => {
    setPage(1)
    setConversations([])
    setTotalCount(0)
  }, [orgId, channelFilter, statusFilter, queueFilter, search, limit])

  useEffect(() => {
    const payload = query.data
    if (!payload) return
    if (payload.page !== page) return

    const pageItems = (payload.items ?? []) as Conversation[]

    setTotalCount(payload.totalCount ?? 0)
    setConversations((previous) => {
      if (page <= 1) {
        return pageItems
      }

      const seen = new Set(previous.map((item) => item.id))
      const appended = pageItems.filter((item) => !seen.has(item.id))
      return [...previous, ...appended]
    })
  }, [page, query.data])

  const hasMore = useMemo(() => {
    if (!query.data) return false
    return query.data.hasMore
  }, [query.data])

  const isLoadingInitial = query.isLoading && page === 1 && conversations.length === 0
  const isFetchingMore = query.isFetching && page > 1

  const loadMore = useCallback(() => {
    if (isLoadingInitial || isFetchingMore || !hasMore) return
    setPage((current) => current + 1)
  }, [hasMore, isFetchingMore, isLoadingInitial])

  const refreshFirstPage = useCallback(async () => {
    if (page === 1) {
      await query.refetch()
      return
    }
    setPage(1)
  }, [page, query.refetch])

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!orgId) return

    const supabase = createClient()
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) return
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        void refreshFirstPage()
      }, 120)
    }

    const channel = supabase
      .channel(`inbox:list:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `org_id=eq.${orgId}`,
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `org_id=eq.${orgId}`,
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_messages',
          filter: `org_id=eq.${orgId}`,
        },
        scheduleRefresh
      )
      .subscribe()

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [orgId, refreshFirstPage])

  return {
    conversations,
    totalCount,
    loading: isLoadingInitial,
    hasMore,
    isFetchingMore,
    loadMore,
    refetch: refreshFirstPage,
  }
}

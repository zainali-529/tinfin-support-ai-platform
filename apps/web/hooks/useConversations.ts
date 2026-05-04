'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { createClient } from '@/lib/supabase'
import type { InboxSavedViewId, RealtimeConversationSnapshot } from '@workspace/types'
import type { Conversation } from '@/types/database'

type StatusFilter = 'all' | 'bot' | 'open' | 'pending' | 'resolved'
type ChannelFilter = 'all' | 'chat' | 'email' | 'whatsapp'
type QueueFilter = 'all' | 'bot' | 'queued' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved'

interface UseConversationsOptions {
  channelFilter?: ChannelFilter | null
  statusFilter?: StatusFilter
  queueFilter?: QueueFilter
  savedView?: InboxSavedViewId
  search?: string
  limit?: number
  currentUserId?: string | null
}

function snapshotToConversation(snapshot: RealtimeConversationSnapshot): Conversation {
  return {
    ...snapshot,
    channel: snapshot.channel as Conversation['channel'],
    status: snapshot.status as Conversation['status'],
    queue_state: snapshot.queue_state as Conversation['queue_state'],
    backlog_state: snapshot.backlog_state as Conversation['backlog_state'],
    sla_state: snapshot.sla_state as Conversation['sla_state'],
    sla_stage: snapshot.sla_stage as Conversation['sla_stage'],
    contacts: snapshot.contacts
      ? {
          ...snapshot.contacts,
          org_id: snapshot.org_id,
          meta: null,
          created_at: snapshot.started_at,
        }
      : null,
  }
}

function conversationMatchesStatus(conversation: Conversation, status: StatusFilter): boolean {
  if (status === 'all') return true
  if (status === 'resolved') return conversation.status === 'resolved' || conversation.status === 'closed'
  return conversation.status === status
}

function conversationMatchesSavedView(
  conversation: Conversation,
  savedView: InboxSavedViewId,
  currentUserId?: string | null
): boolean {
  switch (savedView) {
    case 'my_open':
      return conversation.status === 'open' && Boolean(currentUserId) && conversation.assigned_to === currentUserId
    case 'unassigned':
      return !['resolved', 'closed'].includes(conversation.status) && conversation.assigned_to === null
    case 'sla_at_risk':
      return conversation.sla_is_live === true && conversation.sla_state === 'at_risk'
    case 'sla_breached':
      return conversation.sla_is_live === true && conversation.sla_state === 'breached'
    case 'waiting_customer':
      return conversation.queue_state === 'waiting_customer'
    case 'human_takeover':
      return conversation.status === 'pending'
    case 'email_only':
      return conversation.channel === 'email'
    case 'whatsapp_only':
      return conversation.channel === 'whatsapp'
    case 'ai_handled':
      return conversation.status === 'bot' || conversation.queue_state === 'bot'
    case 'low_confidence':
      return false
    case 'actions_failed':
      return false
    case 'all':
    default:
      return true
  }
}

export function useConversations(orgId: string, options?: UseConversationsOptions) {
  const limit = options?.limit ?? 10
  const channelFilter = options?.channelFilter ?? 'all'
  const statusFilter = options?.statusFilter ?? 'all'
  const queueFilter = options?.queueFilter ?? 'all'
  const savedView = options?.savedView ?? 'all'
  const search = options?.search?.trim() ?? ''
  const currentUserId = options?.currentUserId ?? null

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
      savedView,
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
  }, [orgId, channelFilter, statusFilter, queueFilter, savedView, search, limit])

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

  const patchConversation = useCallback((conversationId: string, patch: Partial<Conversation>) => {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, ...patch }
          : conversation
      )
    )
  }, [])

  const conversationMatchesCurrentView = useCallback((conversation: Conversation) => {
    if (search) return false
    if (channelFilter !== 'all' && conversation.channel !== channelFilter) return false
    if (!conversationMatchesStatus(conversation, statusFilter)) return false
    if (queueFilter !== 'all' && conversation.queue_state !== queueFilter) return false
    return conversationMatchesSavedView(conversation, savedView, currentUserId)
  }, [channelFilter, currentUserId, queueFilter, savedView, search, statusFilter])

  const upsertConversation = useCallback((snapshot: RealtimeConversationSnapshot, options?: { bump?: boolean }) => {
    const conversation = snapshotToConversation(snapshot)
    const shouldInsert = conversationMatchesCurrentView(conversation)
    const shouldBump = options?.bump !== false
    let inserted = false

    setConversations((previous) => {
      const existingIndex = previous.findIndex((item) => item.id === conversation.id)
      if (existingIndex >= 0) {
        const next = [...previous]
        const merged = { ...next[existingIndex], ...conversation }
        next.splice(existingIndex, 1)
        return shouldBump ? [merged, ...next] : [
          ...next.slice(0, existingIndex),
          merged,
          ...next.slice(existingIndex),
        ]
      }

      if (!shouldInsert) return previous
      inserted = true
      return [conversation, ...previous]
    })

    setTotalCount((previous) => {
      if (!inserted) return previous
      return previous + 1
    })
  }, [conversationMatchesCurrentView])

  const refreshFirstPage = useCallback(async () => {
    if (page === 1) {
      await query.refetch()
      return
    }
    setPage(1)
  }, [page, query.refetch])

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshFirstPageRef = useRef(refreshFirstPage)

  useEffect(() => {
    refreshFirstPageRef.current = refreshFirstPage
  }, [refreshFirstPage])

  useEffect(() => {
    if (!orgId) return

    const supabase = createClient()
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) return
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        void refreshFirstPageRef.current()
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
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
  }, [orgId])

  return {
    conversations,
    totalCount,
    loading: isLoadingInitial,
    hasMore,
    isFetchingMore,
    loadMore,
    refetch: refreshFirstPage,
    patchConversation,
    upsertConversation,
  }
}

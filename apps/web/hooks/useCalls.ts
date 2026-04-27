'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc'

interface UseCallsOptions {
  search?: string
  status?: string
  type?: string
  limit?: number
}

interface CallRow {
  id: string
  vapi_call_id: string
  status: string
  type: string
  direction: string
  duration_seconds: number | null
  durationFormatted: string
  recording_url: string | null
  transcript: string | null
  summary: string | null
  ended_reason: string | null
  caller_number: string | null
  cost_cents: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
  contacts?: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
}

export function useCalls(orgId: string, options?: UseCallsOptions) {
  const search = options?.search?.trim() ?? ''
  const status = options?.status
  const type = options?.type
  const limit = options?.limit ?? 10

  const [page, setPage] = useState(1)
  const [calls, setCalls] = useState<CallRow[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const callsQuery = trpc.vapi.getCalls.useQuery(
    {
      page,
      limit,
      search: search || undefined,
      status,
      type,
    },
    {
      enabled: Boolean(orgId),
      staleTime: 30_000,
    }
  )

  const {
    data: stats,
    isLoading: statsLoading,
  } = trpc.vapi.getCallStats.useQuery(undefined, {
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  useEffect(() => {
    setPage(1)
    setCalls([])
    setTotalCount(0)
  }, [orgId, search, status, type, limit])

  useEffect(() => {
    const payload = callsQuery.data
    if (!payload) return
    if (payload.page !== page) return

    const pageItems = (payload.calls ?? []) as CallRow[]
    setTotalCount(payload.totalCount ?? 0)

    setCalls((previous) => {
      if (page <= 1) {
        return pageItems
      }

      const seen = new Set(previous.map((row) => row.id))
      const appended = pageItems.filter((row) => !seen.has(row.id))
      return [...previous, ...appended]
    })
  }, [callsQuery.data, page])

  const hasMore = useMemo(() => {
    if (!callsQuery.data) return false
    return callsQuery.data.hasMore
  }, [callsQuery.data])

  const isLoading = callsQuery.isLoading && page === 1 && calls.length === 0
  const isFetchingMore = callsQuery.isFetching && page > 1

  const loadMore = useCallback(() => {
    if (isLoading || isFetchingMore || !hasMore) return
    setPage((current) => current + 1)
  }, [hasMore, isFetchingMore, isLoading])

  const refetch = useCallback(async () => {
    if (page === 1) {
      await callsQuery.refetch()
      return
    }
    setPage(1)
  }, [callsQuery.refetch, page])

  const syncCalls = trpc.vapi.syncCallsFromVapi.useMutation({
    onSuccess: () => {
      void refetch()
    },
  })

  return {
    calls,
    totalCount,
    stats,
    isLoading,
    statsLoading,
    hasMore,
    isFetchingMore,
    loadMore,
    refetch,
    syncCalls,
  }
}

export function useCallDetail(id: string) {
  return trpc.vapi.getCall.useQuery({ id }, { enabled: !!id })
}

export function useVapiAssistantConfig() {
  const utils = trpc.useUtils()

  const { data: config, isLoading } = trpc.vapi.getAssistantConfig.useQuery(undefined, {
    staleTime: 60_000,
  })

  const upsert = trpc.vapi.upsertAssistantConfig.useMutation({
    onSuccess: () => utils.vapi.getAssistantConfig.invalidate(),
  })

  const remove = trpc.vapi.deleteAssistant.useMutation({
    onSuccess: () => utils.vapi.getAssistantConfig.invalidate(),
  })

  return { config, isLoading, upsert, remove }
}

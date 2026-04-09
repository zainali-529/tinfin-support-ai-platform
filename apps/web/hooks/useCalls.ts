'use client'

import { trpc } from '@/lib/trpc'

export function useCalls(orgId: string) {
  const {
    data: calls = [],
    isLoading,
    refetch,
  } = trpc.vapi.getCalls.useQuery(
    { limit: 50, offset: 0 },
    { enabled: !!orgId, staleTime: 30_000 }
  )

  const {
    data: stats,
    isLoading: statsLoading,
  } = trpc.vapi.getCallStats.useQuery(undefined, {
    enabled: !!orgId,
    staleTime: 60_000,
  })

  const syncCalls = trpc.vapi.syncCallsFromVapi.useMutation({
    onSuccess: () => void refetch(),
  })

  return {
    calls,
    stats,
    isLoading,
    statsLoading,
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
'use client'

import { trpc } from '@/lib/trpc'
import type { CannedResponseCategory } from '@/types/database'

export function useCannedResponsesList(params?: {
  query?: string
  category?: CannedResponseCategory
  includeInactive?: boolean
  limit?: number
}) {
  return trpc.cannedResponses.list.useQuery(
    {
      query: params?.query,
      category: params?.category,
      includeInactive: params?.includeInactive ?? false,
      limit: params?.limit ?? 30,
    },
    {
      staleTime: 20_000,
    }
  )
}

export function useCannedResponseSuggestions(conversationId: string | null, limit = 4) {
  return trpc.cannedResponses.suggestForConversation.useQuery(
    { conversationId: conversationId ?? '', limit },
    {
      enabled: !!conversationId,
      staleTime: 15_000,
    }
  )
}

export function useCannedResponsesAdmin() {
  const utils = trpc.useUtils()

  const list = trpc.cannedResponses.list.useQuery(
    { includeInactive: true, limit: 100 },
    { staleTime: 10_000 }
  )

  const create = trpc.cannedResponses.create.useMutation({
    onSuccess: () => void utils.cannedResponses.list.invalidate(),
  })

  const update = trpc.cannedResponses.update.useMutation({
    onSuccess: () => void utils.cannedResponses.list.invalidate(),
  })

  const remove = trpc.cannedResponses.delete.useMutation({
    onSuccess: () => void utils.cannedResponses.list.invalidate(),
  })

  return {
    list,
    create,
    update,
    remove,
  }
}

export function useCannedResponseUsage() {
  const utils = trpc.useUtils()

  return trpc.cannedResponses.recordUsage.useMutation({
    onSuccess: () => {
      void utils.cannedResponses.list.invalidate()
    },
  })
}

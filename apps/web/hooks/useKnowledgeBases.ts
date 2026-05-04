'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { trpc } from '@/lib/trpc'

export interface KBSource {
  id: string
  kb_id: string
  org_id: string
  source_type: 'url' | 'file' | 'text_note' | 'sitemap'
  source_url: string | null
  source_title: string | null
  status: 'indexing' | 'indexed' | 'failed' | 'stale'
  chunk_count: number
  quality_score: number | null
  warning_codes: string[]
  error_message: string | null
  last_indexed_at: string | null
  last_checked_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  type: 'url' | 'file' | 'text'
}

export interface KnowledgeBase {
  id: string
  org_id: string
  name: string
  source_type: string | null
  settings: Record<string, unknown>
  created_at: string
  _chunkCount?: number
  _sources?: KBSource[]
}

export interface UseKnowledgeBasesReturn {
  kbs: KnowledgeBase[]
  isLoading: boolean
  error: any
  createKB: any
  deleteKB: any
  ingestUrl: any
  ingestFile: any
  ingestText: any
}

export function useKnowledgeBases(orgId: string): UseKnowledgeBasesReturn {
  const utils = trpc.useUtils()

  const {
    data: kbs = [],
    isLoading,
    error,
  } = trpc.knowledge.getKnowledgeBases.useQuery(
    { orgId },
    { enabled: !!orgId, staleTime: 30_000 }
  )

  const createKB = trpc.knowledge.createKnowledgeBase.useMutation({
    onSuccess: () => utils.knowledge.getKnowledgeBases.invalidate(),
  })

  const deleteKB = trpc.knowledge.deleteKnowledgeBase.useMutation({
    onSuccess: () => utils.knowledge.getKnowledgeBases.invalidate(),
  })

  const ingestUrl = trpc.ingest.ingestUrl.useMutation({
    onSuccess: () => {
      void utils.knowledge.getKnowledgeBases.invalidate()
      void utils.knowledge.getKnowledgeSources.invalidate()
    },
  })
  const ingestFile = trpc.ingest.ingestFile.useMutation({
    onSuccess: () => {
      void utils.knowledge.getKnowledgeBases.invalidate()
      void utils.knowledge.getKnowledgeSources.invalidate()
    },
  })
  const ingestText = trpc.ingest.ingestText.useMutation({
    onSuccess: () => {
      void utils.knowledge.getKnowledgeBases.invalidate()
      void utils.knowledge.getKnowledgeSources.invalidate()
    },
  })

  return {
    kbs: kbs as KnowledgeBase[],
    isLoading,
    error,
    createKB,
    deleteKB,
    ingestUrl,
    ingestFile,
    ingestText,
  }
}

export function useKBSources(kbId: string | null, orgId: string) {
  const utils = trpc.useUtils()
  const [refreshing, setRefreshing] = useState(false)
  const {
    data = [],
    isLoading,
    isFetching,
    refetch: queryRefetch,
  } = trpc.knowledge.getKnowledgeSources.useQuery(
    { kbId: kbId ?? '00000000-0000-0000-0000-000000000000' },
    { enabled: !!kbId && !!orgId, staleTime: 15_000 }
  )

  const sources = data as KBSource[]
  const chunkCount = sources.reduce((sum, source) => sum + source.chunk_count, 0)

  useEffect(() => {
    if (!kbId) return
    void utils.knowledge.getKnowledgeSources.invalidate({ kbId })
  }, [kbId, utils])

  const refetch = async () => {
    setRefreshing(true)
    try {
      await queryRefetch()
    } finally {
      setRefreshing(false)
    }
  }

  return { sources, chunkCount, loading: isLoading || refreshing, isFetching, refetch }
}

export function useDeleteKBSource() {
  const utils = trpc.useUtils()

  return trpc.knowledge.deleteKnowledgeSource.useMutation({
    onSuccess: () => {
      void utils.knowledge.getKnowledgeBases.invalidate()
      void utils.knowledge.getKnowledgeSources.invalidate()
    },
  })
}

export function useReindexKBSource() {
  const utils = trpc.useUtils()

  return trpc.knowledge.reindexKnowledgeSource.useMutation({
    onSuccess: () => {
      void utils.knowledge.getKnowledgeBases.invalidate()
      void utils.knowledge.getKnowledgeSources.invalidate()
    },
  })
}

export function useSession() {
  const [session, setSession] = useState<{
    orgId: string
    userId: string
  } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id
      if (!userId) return
      const { data: user } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userId)
        .single()
      if (user) setSession({ orgId: user.org_id, userId })
    })
  }, [])

  return session
}

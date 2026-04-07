'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { trpc } from '@/lib/trpc'

export interface KBSource {
  source_url: string | null
  source_title: string | null
  chunk_count: number
  created_at: string
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

  const ingestUrl = trpc.ingest.ingestUrl.useMutation()
  const ingestFile = trpc.ingest.ingestFile.useMutation()

  return {
    kbs: kbs as KnowledgeBase[],
    isLoading,
    error,
    createKB,
    deleteKB,
    ingestUrl,
    ingestFile,
  }
}

export function useKBSources(kbId: string | null, orgId: string) {
  const [sources, setSources] = useState<KBSource[]>([])
  const [chunkCount, setChunkCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!kbId || !orgId) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('kb_chunks')
        .select('source_url, source_title, created_at')
        .eq('kb_id', kbId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      const rows = (data ?? []) as Array<{
        source_url: string | null
        source_title: string | null
        created_at: string
      }>

      setChunkCount(rows.length)

      // Deduplicate by source key
      const map = new Map<string, KBSource>()
      for (const row of rows) {
        const key = row.source_url ?? row.source_title ?? 'text'
        if (!map.has(key)) {
          const isUrl = !!row.source_url && row.source_url.startsWith('http')
          const isFile =
            !isUrl &&
            (row.source_title?.endsWith('.pdf') ||
              row.source_title?.endsWith('.docx'))
          map.set(key, {
            source_url: row.source_url,
            source_title: row.source_title,
            chunk_count: 0,
            created_at: row.created_at,
            type: isUrl ? 'url' : isFile ? 'file' : 'text',
          })
        }
        const src = map.get(key)!
        src.chunk_count++
      }

      setSources(Array.from(map.values()))
    } catch (e) {
      console.error('[useKBSources]', e)
    } finally {
      setLoading(false)
    }
  }, [kbId, orgId])

  useEffect(() => {
    void fetch()
  }, [fetch])

  return { sources, chunkCount, loading, refetch: fetch }
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
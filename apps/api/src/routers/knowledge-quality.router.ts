import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc/trpc'
import {
  requireAdminFromContext,
  requirePermissionFromContext,
} from '../lib/org-permissions'

type SourceStatus = 'healthy' | 'needs_review' | 'stale' | 'duplicate' | 'deprecated'

interface ChunkRow {
  id: string
  kb_id: string
  source_url: string | null
  source_title: string | null
  source_type: string | null
  is_pinned: boolean | null
  pinned_reason: string | null
  quality_status: string | null
  quality_notes: string | null
  last_reviewed_at: string | null
  last_verified_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface SourceGroup {
  sourceKey: string
  kbId: string
  kbName: string
  sourceUrl: string | null
  sourceTitle: string | null
  sourceType: string
  isPinned: boolean
  pinnedReason: string | null
  qualityStatus: string
  qualityNotes: string | null
  chunkCount: number
  firstIndexedAt: string
  lastIndexedAt: string
  lastReviewedAt: string | null
  lastVerifiedAt: string | null
  ageDays: number
  health: SourceStatus
  healthReasons: string[]
  duplicateGroupKey: string | null
  usageCount: number
  lastUsedAt: string | null
}

export interface TraceRow {
  id: string
  query: string
  detected_intent: string
  response_type: string
  response_preview: string | null
  sources_used: unknown
  confidence: number | null
  created_at: string
}

const SOURCE_TYPE_OPTIONS = [
  'general',
  'company_profile',
  'text_note',
  'url',
  'file',
  'policy',
  'product_doc',
  'troubleshooting',
  'pricing',
  'faq',
] as const

const QUALITY_STATUS_OPTIONS = [
  'active',
  'needs_review',
  'verified',
  'deprecated',
] as const

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function daysBetween(left: Date, right: Date): number {
  return Math.max(0, Math.floor((left.getTime() - right.getTime()) / 86_400_000))
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return value.trim().replace(/\/$/, '').toLowerCase()
  }
}

function normalizeTextKey(value: string | null): string | null {
  if (!value) return null
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferSourceType(row: ChunkRow): string {
  const metadata = asRecord(row.metadata)
  const fromColumn = asString(row.source_type)
  const fromMetadata = asString(metadata.sourceType)
  if (fromColumn && fromColumn !== 'general') return fromColumn
  if (fromMetadata) return fromMetadata
  if (row.source_url?.startsWith('http')) return 'url'
  const title = row.source_title?.toLowerCase() ?? ''
  if (title.endsWith('.pdf') || title.endsWith('.docx')) return 'file'
  return 'text_note'
}

function makeSourceKey(row: Pick<ChunkRow, 'kb_id' | 'source_url' | 'source_title'>): string {
  const url = normalizeUrl(row.source_url)
  if (url) return `${row.kb_id}:url:${url}`
  const title = normalizeTextKey(row.source_title)
  if (title) return `${row.kb_id}:title:${title}`
  return `${row.kb_id}:unknown`
}

function makeDuplicateKey(source: Pick<SourceGroup, 'sourceUrl' | 'sourceTitle'>): string | null {
  const url = normalizeUrl(source.sourceUrl)
  if (url) return `url:${url}`
  const title = normalizeTextKey(source.sourceTitle)
  if (title) return `title:${title}`
  return null
}

function getSourceIdentityFromKey(sourceKey: string): {
  kbId: string
  mode: 'url' | 'title' | 'unknown'
  value: string
} {
  const [kbId, mode, ...rest] = sourceKey.split(':')
  if (!kbId || !mode) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid source key.' })
  }
  const value = rest.join(':')
  if (mode !== 'url' && mode !== 'title' && mode !== 'unknown') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid source key mode.' })
  }
  return { kbId, mode, value }
}

function sourceMatchesIdentity(row: ChunkRow, identity: ReturnType<typeof getSourceIdentityFromKey>): boolean {
  if (row.kb_id !== identity.kbId) return false
  if (identity.mode === 'url') return normalizeUrl(row.source_url) === identity.value
  if (identity.mode === 'title') return normalizeTextKey(row.source_title) === identity.value
  return !row.source_url && !row.source_title
}

function extractTraceSources(trace: TraceRow): Array<{ title: string | null; url: string | null; sourceType: string | null }> {
  if (!Array.isArray(trace.sources_used)) return []
  return trace.sources_used
    .map((item) => {
      const source = asRecord(item)
      return {
        title: asString(source.title),
        url: asString(source.url),
        sourceType: asString(source.sourceType),
      }
    })
    .filter((source) => source.title || source.url)
}

function buildUsageMap(traces: TraceRow[]) {
  const usage = new Map<string, { count: number; lastUsedAt: string | null }>()

  for (const trace of traces) {
    for (const source of extractTraceSources(trace)) {
      const keys = [
        source.url ? `url:${normalizeUrl(source.url)}` : null,
        source.title ? `title:${normalizeTextKey(source.title)}` : null,
      ].filter((key): key is string => Boolean(key))

      for (const key of keys) {
        const current = usage.get(key) ?? { count: 0, lastUsedAt: null }
        current.count += 1
        if (!current.lastUsedAt || new Date(trace.created_at) > new Date(current.lastUsedAt)) {
          current.lastUsedAt = trace.created_at
        }
        usage.set(key, current)
      }
    }
  }

  return usage
}

function computeHealth(params: {
  source: Omit<SourceGroup, 'health' | 'healthReasons' | 'duplicateGroupKey' | 'usageCount' | 'lastUsedAt'>
  duplicateCount: number
  staleDays: number
}): { health: SourceStatus; reasons: string[] } {
  const { source, duplicateCount, staleDays } = params
  const reasons: string[] = []

  if (source.qualityStatus === 'deprecated') {
    return { health: 'deprecated', reasons: ['Marked deprecated'] }
  }

  if (duplicateCount > 1) reasons.push('Possible duplicate source')
  if (source.ageDays >= staleDays && source.qualityStatus !== 'verified') reasons.push(`Not reviewed in ${source.ageDays} days`)
  if (source.qualityStatus === 'needs_review') reasons.push('Marked needs review')
  if (source.chunkCount <= 1) reasons.push('Very small source coverage')

  if (source.qualityStatus === 'needs_review') return { health: 'needs_review', reasons }
  if (duplicateCount > 1) return { health: 'duplicate', reasons }
  if (source.ageDays >= staleDays && source.qualityStatus !== 'verified') return { health: 'stale', reasons }
  return { health: 'healthy', reasons: reasons.length > 0 ? reasons : ['Looks healthy'] }
}

function buildTopicKey(query: string, intent: string): string {
  const cleaned = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 8)
    .join(' ')
  return `${intent}:${cleaned || 'unknown'}`
}

function buildMissingTopics(traces: TraceRow[]) {
  const groups = new Map<string, {
    topicKey: string
    intent: string
    exampleQuery: string
    count: number
    avgConfidence: number
    lastSeenAt: string
    responseTypes: string[]
  }>()

  for (const trace of traces) {
    const confidence = trace.confidence ?? 0
    const isMissing =
      confidence < 0.45 ||
      ['ask_handoff', 'handoff'].includes(trace.response_type) ||
      (trace.response_type === 'casual' && trace.detected_intent !== 'small_talk')

    if (!isMissing) continue

    const topicKey = buildTopicKey(trace.query, trace.detected_intent)
    const current = groups.get(topicKey) ?? {
      topicKey,
      intent: trace.detected_intent,
      exampleQuery: trace.query,
      count: 0,
      avgConfidence: 0,
      lastSeenAt: trace.created_at,
      responseTypes: [],
    }

    current.count += 1
    current.avgConfidence =
      ((current.avgConfidence * (current.count - 1)) + confidence) / current.count
    if (new Date(trace.created_at) > new Date(current.lastSeenAt)) current.lastSeenAt = trace.created_at
    if (!current.responseTypes.includes(trace.response_type)) current.responseTypes.push(trace.response_type)
    groups.set(topicKey, current)
  }

  return Array.from(groups.values())
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count
      return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime()
    })
    .slice(0, 30)
}

async function loadQualityData(supabase: any, orgId: string, staleDays: number) {
  const [chunksResult, kbResult, traceResult] = await Promise.all([
    supabase
      .from('kb_chunks')
      .select('id, kb_id, source_url, source_title, source_type, is_pinned, pinned_reason, quality_status, quality_notes, last_reviewed_at, last_verified_at, metadata, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('knowledge_bases')
      .select('id, name')
      .eq('org_id', orgId),
    supabase
      .from('ai_answer_traces')
      .select('id, query, detected_intent, response_type, response_preview, sources_used, confidence, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  if (chunksResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load knowledge chunks: ${chunksResult.error.message}`,
    })
  }
  if (kbResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load knowledge bases: ${kbResult.error.message}`,
    })
  }
  if (traceResult.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load AI traces: ${traceResult.error.message}`,
    })
  }

  const chunks = (chunksResult.data ?? []) as ChunkRow[]
  const traces = (traceResult.data ?? []) as TraceRow[]
  const kbNames = new Map(((kbResult.data ?? []) as Array<{ id: string; name: string }>).map((kb) => [kb.id, kb.name]))
  const usageMap = buildUsageMap(traces)
  const now = new Date()

  const grouped = new Map<string, Omit<SourceGroup, 'health' | 'healthReasons' | 'duplicateGroupKey' | 'usageCount' | 'lastUsedAt'>>()

  for (const row of chunks) {
    const sourceKey = makeSourceKey(row)
    const createdAt = new Date(row.created_at)
    const existing = grouped.get(sourceKey)
    const sourceType = inferSourceType(row)
    const metadata = asRecord(row.metadata)
    const isPinned = row.is_pinned === true || metadata.pinned === true

    if (!existing) {
      grouped.set(sourceKey, {
        sourceKey,
        kbId: row.kb_id,
        kbName: kbNames.get(row.kb_id) ?? 'Knowledge Base',
        sourceUrl: row.source_url,
        sourceTitle: row.source_title,
        sourceType,
        isPinned,
        pinnedReason: row.pinned_reason,
        qualityStatus: row.quality_status ?? 'active',
        qualityNotes: row.quality_notes,
        chunkCount: 1,
        firstIndexedAt: row.created_at,
        lastIndexedAt: row.created_at,
        lastReviewedAt: row.last_reviewed_at,
        lastVerifiedAt: row.last_verified_at,
        ageDays: daysBetween(now, row.last_reviewed_at ? new Date(row.last_reviewed_at) : createdAt),
      })
      continue
    }

    existing.chunkCount += 1
    if (createdAt < new Date(existing.firstIndexedAt)) existing.firstIndexedAt = row.created_at
    if (createdAt > new Date(existing.lastIndexedAt)) existing.lastIndexedAt = row.created_at
    if (isPinned) existing.isPinned = true
    if (row.pinned_reason) existing.pinnedReason = row.pinned_reason
    if (row.quality_status === 'needs_review' || row.quality_status === 'deprecated') {
      existing.qualityStatus = row.quality_status
    }
    if (row.quality_notes) existing.qualityNotes = row.quality_notes
    if (row.last_reviewed_at && (!existing.lastReviewedAt || new Date(row.last_reviewed_at) > new Date(existing.lastReviewedAt))) {
      existing.lastReviewedAt = row.last_reviewed_at
    }
    if (row.last_verified_at && (!existing.lastVerifiedAt || new Date(row.last_verified_at) > new Date(existing.lastVerifiedAt))) {
      existing.lastVerifiedAt = row.last_verified_at
    }
    existing.ageDays = daysBetween(
      now,
      existing.lastReviewedAt ? new Date(existing.lastReviewedAt) : new Date(existing.lastIndexedAt)
    )
  }

  const duplicateCounts = new Map<string, number>()
  for (const source of grouped.values()) {
    const duplicateKey = makeDuplicateKey(source)
    if (!duplicateKey) continue
    duplicateCounts.set(duplicateKey, (duplicateCounts.get(duplicateKey) ?? 0) + 1)
  }

  const sources: SourceGroup[] = Array.from(grouped.values()).map((source) => {
    const duplicateGroupKey = makeDuplicateKey(source)
    const duplicateCount = duplicateGroupKey ? duplicateCounts.get(duplicateGroupKey) ?? 0 : 0
    const health = computeHealth({ source, duplicateCount, staleDays })
    const usageKeys = [
      source.sourceUrl ? `url:${normalizeUrl(source.sourceUrl)}` : null,
      source.sourceTitle ? `title:${normalizeTextKey(source.sourceTitle)}` : null,
    ].filter((key): key is string => Boolean(key))
    const usage = usageKeys
      .map((key) => usageMap.get(key))
      .filter((item): item is { count: number; lastUsedAt: string | null } => Boolean(item))
      .reduce(
        (acc, item) => ({
          count: acc.count + item.count,
          lastUsedAt:
            !acc.lastUsedAt || (item.lastUsedAt && new Date(item.lastUsedAt) > new Date(acc.lastUsedAt))
              ? item.lastUsedAt
              : acc.lastUsedAt,
        }),
        { count: 0, lastUsedAt: null as string | null }
      )

    return {
      ...source,
      duplicateGroupKey,
      health: health.health,
      healthReasons: health.reasons,
      usageCount: usage.count,
      lastUsedAt: usage.lastUsedAt,
    }
  }).sort((left, right) => {
    const rank: Record<SourceStatus, number> = {
      needs_review: 5,
      duplicate: 4,
      stale: 3,
      deprecated: 2,
      healthy: 1,
    }
    return rank[right.health] - rank[left.health] || right.ageDays - left.ageDays
  })

  const missingTopics = buildMissingTopics(traces)
  const healthCounts = sources.reduce(
    (acc, source) => {
      acc[source.health] += 1
      return acc
    },
    {
      healthy: 0,
      needs_review: 0,
      stale: 0,
      duplicate: 0,
      deprecated: 0,
    } as Record<SourceStatus, number>
  )

  return {
    summary: {
      totalSources: sources.length,
      totalChunks: chunks.length,
      pinnedSources: sources.filter((source) => source.isPinned).length,
      missingTopics: missingTopics.length,
      staleSources: healthCounts.stale,
      duplicateSources: healthCounts.duplicate,
      needsReviewSources: healthCounts.needs_review,
      deprecatedSources: healthCounts.deprecated,
      healthySources: healthCounts.healthy,
      traceWindow: traces.length,
    },
    healthCounts,
    sources,
    missingTopics,
    topUsedSources: [...sources]
      .filter((source) => source.usageCount > 0)
      .sort((left, right) => right.usageCount - left.usageCount)
      .slice(0, 20),
    recentLowConfidenceTraces: traces
      .filter((trace) => (trace.confidence ?? 0) < 0.55)
      .slice(0, 30),
  }
}

async function updateChunksBySourceKey(params: {
  supabase: any
  orgId: string
  sourceKey: string
  patch: Record<string, unknown>
}) {
  const identity = getSourceIdentityFromKey(params.sourceKey)
  const { data, error } = await params.supabase
    .from('kb_chunks')
    .select('id, kb_id, source_url, source_title')
    .eq('org_id', params.orgId)
    .eq('kb_id', identity.kbId)

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load source chunks: ${error.message}`,
    })
  }

  const ids = ((data ?? []) as ChunkRow[])
    .filter((row) => sourceMatchesIdentity(row, identity))
    .map((row) => row.id)

  if (ids.length === 0) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Source not found.' })
  }

  const update = await params.supabase
    .from('kb_chunks')
    .update(params.patch)
    .eq('org_id', params.orgId)
    .in('id', ids)

  if (update.error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to update source: ${update.error.message}`,
    })
  }

  return ids.length
}

export const knowledgeQualityRouter = router({
  getQualityCenter: protectedProcedure
    .input(z.object({
      staleDays: z.number().int().min(7).max(365).default(60),
    }).optional())
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      return loadQualityData(ctx.supabase, ctx.userOrgId, input?.staleDays ?? 60)
    }),

  updateSource: protectedProcedure
    .input(z.object({
      sourceKey: z.string().min(3),
      sourceType: z.enum(SOURCE_TYPE_OPTIONS).optional(),
      isPinned: z.boolean().optional(),
      pinnedReason: z.string().trim().max(300).nullable().optional(),
      qualityStatus: z.enum(QUALITY_STATUS_OPTIONS).optional(),
      qualityNotes: z.string().trim().max(1000).nullable().optional(),
      markReviewed: z.boolean().default(false),
      markVerified: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      const now = new Date().toISOString()
      const metadataPatch: Record<string, unknown> = {}
      const patch: Record<string, unknown> = {}

      if (input.sourceType) {
        patch.source_type = input.sourceType
        metadataPatch.sourceType = input.sourceType
      }
      if (input.isPinned !== undefined) {
        patch.is_pinned = input.isPinned
        metadataPatch.pinned = input.isPinned
      }
      if (input.pinnedReason !== undefined) patch.pinned_reason = input.pinnedReason
      if (input.qualityStatus) patch.quality_status = input.qualityStatus
      if (input.qualityNotes !== undefined) patch.quality_notes = input.qualityNotes
      if (input.markReviewed) patch.last_reviewed_at = now
      if (input.markVerified) {
        patch.last_verified_at = now
        patch.last_reviewed_at = now
        patch.quality_status = 'verified'
      }

      const updated = await updateChunksBySourceKey({
        supabase: ctx.supabase,
        orgId: ctx.userOrgId,
        sourceKey: input.sourceKey,
        patch,
      })

      if (Object.keys(metadataPatch).length > 0) {
        const identity = getSourceIdentityFromKey(input.sourceKey)
        const { data } = await ctx.supabase
          .from('kb_chunks')
          .select('id, kb_id, source_url, source_title, metadata')
          .eq('org_id', ctx.userOrgId)
          .eq('kb_id', identity.kbId)

        const rows = ((data ?? []) as ChunkRow[]).filter((row) => sourceMatchesIdentity(row, identity))
        await Promise.all(rows.map((row) =>
          ctx.supabase
            .from('kb_chunks')
            .update({ metadata: { ...asRecord(row.metadata), ...metadataPatch } })
            .eq('id', row.id)
            .eq('org_id', ctx.userOrgId)
        ))
      }

      return { success: true, updatedChunks: updated }
    }),

  deleteSource: protectedProcedure
    .input(z.object({ sourceKey: z.string().min(3) }))
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      const identity = getSourceIdentityFromKey(input.sourceKey)
      const { data, error } = await ctx.supabase
        .from('kb_chunks')
        .select('id, kb_id, source_url, source_title')
        .eq('org_id', ctx.userOrgId)
        .eq('kb_id', identity.kbId)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load source chunks: ${error.message}`,
        })
      }

      const ids = ((data ?? []) as ChunkRow[])
        .filter((row) => sourceMatchesIdentity(row, identity))
        .map((row) => row.id)

      if (ids.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Source not found.' })
      }

      const deleted = await ctx.supabase
        .from('kb_chunks')
        .delete()
        .eq('org_id', ctx.userOrgId)
        .in('id', ids)

      if (deleted.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete source: ${deleted.error.message}`,
        })
      }

      return { success: true, deletedChunks: ids.length }
    }),

  createGuidanceFromTrace: protectedProcedure
    .input(z.object({
      traceId: z.string().uuid(),
      guidanceText: z.string().trim().min(5).max(4000),
      name: z.string().trim().min(1).max(140).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      const { data: trace, error } = await ctx.supabase
        .from('ai_answer_traces')
        .select('id, query, detected_intent, channel')
        .eq('id', input.traceId)
        .eq('org_id', ctx.userOrgId)
        .maybeSingle()

      if (error || !trace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Trace not found.' })
      }

      const { data, error: insertError } = await ctx.supabase
        .from('ai_guidance_rules')
        .insert({
          org_id: ctx.userOrgId,
          name: input.name ?? `Guidance from ${trace.detected_intent}`,
          category: 'content',
          condition_text: `When the user asks something like: "${trace.query}"`,
          guidance_text: input.guidanceText,
          channel: trace.channel ?? 'all',
          priority: 150,
          is_active: true,
        })
        .select('*')
        .single()

      if (insertError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create guidance: ${insertError.message}`,
        })
      }

      return data
    }),

  addTraceToEvalSuite: protectedProcedure
    .input(z.object({
      traceId: z.string().uuid(),
      expectedContains: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
      forbiddenContains: z.array(z.string().trim().min(1).max(160)).max(20).default(['which company', 'what company', 'kaunsi company']),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      const { data: trace, error } = await ctx.supabase
        .from('ai_answer_traces')
        .select('id, query, detected_intent, channel')
        .eq('id', input.traceId)
        .eq('org_id', ctx.userOrgId)
        .maybeSingle()

      if (error || !trace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Trace not found.' })
      }

      const { data, error: insertError } = await ctx.supabase
        .from('ai_eval_cases')
        .insert({
          org_id: ctx.userOrgId,
          name: `Trace regression: ${String(trace.query).slice(0, 80)}`,
          input_message: trace.query,
          expected_intent: trace.detected_intent,
          expected_contains: input.expectedContains,
          forbidden_contains: input.forbiddenContains,
          channel: trace.channel ?? 'chat',
          language: 'auto',
          is_active: true,
        })
        .select('*')
        .single()

      if (insertError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create eval case: ${insertError.message}`,
        })
      }

      return data
    }),
})

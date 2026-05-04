import { TRPCError } from '@trpc/server'

export type KbSourceType = 'url' | 'file' | 'text_note' | 'sitemap'
export type KbSourceStatus = 'indexing' | 'indexed' | 'failed' | 'stale'

export interface IngestHealthInput {
  success: boolean
  chunksStored: number
  error?: string
  sourceTitle?: string
  contentLength?: number
}

export interface KbSourceRow {
  id: string
  kb_id: string
  org_id: string
  source_type: KbSourceType
  source_url: string | null
  source_title: string | null
  status: KbSourceStatus
  chunk_count: number
  quality_score: number | null
  warning_codes: unknown
  error_message: string | null
  last_indexed_at: string | null
  last_checked_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

type SupabaseClient = any

const URL_TYPES = new Set(['http:', 'https:'])

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)].sort()
}

export function normalizeSourceUrl(value: string): string {
  const trimmed = value.trim()
  const parsed = new URL(trimmed)
  if (!URL_TYPES.has(parsed.protocol)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Only http and https URLs can be indexed.',
    })
  }
  parsed.hash = ''
  parsed.searchParams.sort()
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
  return parsed.toString()
}

export function normalizeSourceTitle(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 240) : null
}

export function uiSourceType(sourceType: string | null | undefined): 'url' | 'file' | 'text' {
  if (sourceType === 'url' || sourceType === 'sitemap') return 'url'
  if (sourceType === 'file') return 'file'
  return 'text'
}

export function computeQualityScore(input: IngestHealthInput): number {
  if (!input.success) return 0
  if (input.chunksStored <= 0) return 20

  let score = 82
  if (input.chunksStored >= 3) score += 8
  if (input.chunksStored >= 8) score += 5
  if ((input.contentLength ?? 0) >= 1_000) score += 5
  if (input.chunksStored === 1) score -= 25

  return Math.max(0, Math.min(100, score))
}

export function buildSourceWarnings(input: IngestHealthInput & { sourceType: KbSourceType; sourceUrl?: string | null }): string[] {
  const warnings: string[] = []

  if (!input.success) warnings.push('ingestion_failed')
  if (input.chunksStored === 0) warnings.push('no_chunks')
  if (input.success && input.chunksStored === 1) warnings.push('low_chunk_count')
  if ((input.contentLength ?? 0) > 0 && (input.contentLength ?? 0) < 250) warnings.push('short_source')
  if (input.sourceType === 'url' && !input.sourceTitle) warnings.push('missing_page_title')

  return uniqueWarnings(warnings)
}

export function decorateDuplicateWarnings<T extends {
  source_url: string | null
  source_title: string | null
  source_type: string
  warning_codes: unknown
}>(rows: T[]): T[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const key = sourceIdentityKey(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return rows.map((row) => {
    const key = sourceIdentityKey(row)
    const warnings = normalizeWarnings(row.warning_codes)
    if ((counts.get(key) ?? 0) > 1) warnings.push('duplicate_source')
    return { ...row, warning_codes: uniqueWarnings(warnings) }
  })
}

export function sourceIdentityKey(source: { source_url: string | null; source_title: string | null; source_type: string }): string {
  if (source.source_url) {
    try {
      return `url:${normalizeSourceUrl(source.source_url).toLowerCase()}`
    } catch {
      return `url:${source.source_url.trim().toLowerCase()}`
    }
  }
  return `${source.source_type}:${(source.source_title ?? 'untitled source').trim().toLowerCase()}`
}

export async function assertKnowledgeBaseAccess(
  supabase: SupabaseClient,
  orgId: string,
  kbId: string
) {
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('id')
    .eq('id', kbId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
  }

  if (!data) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Knowledge base access denied.' })
  }
}

export async function getKbSource(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: string
): Promise<KbSourceRow> {
  const { data, error } = await supabase
    .from('kb_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
  }

  if (!data) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Knowledge source not found.' })
  }

  return normalizeSourceRow(data)
}

export async function findUrlSource(
  supabase: SupabaseClient,
  params: { orgId: string; kbId: string; sourceUrl: string }
): Promise<KbSourceRow | null> {
  const { data, error } = await supabase
    .from('kb_sources')
    .select('*')
    .eq('org_id', params.orgId)
    .eq('kb_id', params.kbId)
    .eq('source_url', params.sourceUrl)
    .maybeSingle()

  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
  }

  return data ? normalizeSourceRow(data) : null
}

export async function createIndexingSource(
  supabase: SupabaseClient,
  params: {
    orgId: string
    kbId: string
    sourceType: KbSourceType
    sourceUrl?: string | null
    sourceTitle?: string | null
    metadata?: Record<string, unknown>
    existingSourceId?: string
  }
): Promise<KbSourceRow> {
  const payload = {
    kb_id: params.kbId,
    org_id: params.orgId,
    source_type: params.sourceType,
    source_url: params.sourceUrl ?? null,
    source_title: normalizeSourceTitle(params.sourceTitle) ?? (params.sourceType === 'text_note' ? 'Text Note' : null),
    status: 'indexing',
    chunk_count: 0,
    quality_score: null,
    warning_codes: [],
    error_message: null,
    last_checked_at: new Date().toISOString(),
    metadata: params.metadata ?? {},
  }

  const query = params.existingSourceId
    ? supabase.from('kb_sources').update(payload).eq('id', params.existingSourceId).eq('org_id', params.orgId).select('*')
    : supabase.from('kb_sources').insert(payload).select('*')

  const { data, error } = await query.single()

  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to prepare source: ${error.message}` })
  }

  return normalizeSourceRow(data)
}

export async function updateSourceAfterIngest(
  supabase: SupabaseClient,
  source: KbSourceRow,
  result: IngestHealthInput,
  metadataPatch: Record<string, unknown> = {}
): Promise<void> {
  const previousMetadata = readRecord(source.metadata)
  const nextMetadata = {
    ...previousMetadata,
    ...metadataPatch,
    lastIngestedAt: new Date().toISOString(),
  }
  const warningCodes = buildSourceWarnings({
    ...result,
    sourceType: source.source_type,
    sourceUrl: source.source_url,
  })

  const { error } = await supabase
    .from('kb_sources')
    .update({
      status: result.success ? 'indexed' : 'failed',
      chunk_count: result.chunksStored,
      quality_score: computeQualityScore(result),
      warning_codes: warningCodes,
      error_message: result.success ? null : result.error ?? 'Ingestion failed.',
      last_indexed_at: result.success ? new Date().toISOString() : source.last_indexed_at,
      last_checked_at: new Date().toISOString(),
      source_title: normalizeSourceTitle(result.sourceTitle) ?? source.source_title,
      metadata: nextMetadata,
    })
    .eq('id', source.id)
    .eq('org_id', source.org_id)

  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to update source health: ${error.message}` })
  }
}

export async function deleteChunksForSource(supabase: SupabaseClient, source: KbSourceRow): Promise<void> {
  const bySourceId = await supabase
    .from('kb_chunks')
    .delete()
    .eq('org_id', source.org_id)
    .eq('kb_id', source.kb_id)
    .eq('source_id', source.id)

  if (bySourceId.error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to clear source chunks: ${bySourceId.error.message}` })
  }

  let fallbackQuery = supabase
    .from('kb_chunks')
    .delete()
    .eq('org_id', source.org_id)
    .eq('kb_id', source.kb_id)

  if (source.source_url) {
    fallbackQuery = fallbackQuery.eq('source_url', source.source_url)
  } else if (source.source_title) {
    fallbackQuery = fallbackQuery.is('source_url', null).eq('source_title', source.source_title)
  } else {
    return
  }

  const fallback = await fallbackQuery
  if (fallback.error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to clear legacy chunks: ${fallback.error.message}` })
  }
}

export function normalizeSourceRow(row: Record<string, unknown>): KbSourceRow {
  return {
    id: String(row.id),
    kb_id: String(row.kb_id),
    org_id: String(row.org_id),
    source_type: String(row.source_type ?? 'text_note') as KbSourceType,
    source_url: typeof row.source_url === 'string' ? row.source_url : null,
    source_title: typeof row.source_title === 'string' ? row.source_title : null,
    status: String(row.status ?? 'indexed') as KbSourceStatus,
    chunk_count: typeof row.chunk_count === 'number' ? row.chunk_count : 0,
    quality_score: typeof row.quality_score === 'number' ? row.quality_score : null,
    warning_codes: normalizeWarnings(row.warning_codes),
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    last_indexed_at: typeof row.last_indexed_at === 'string' ? row.last_indexed_at : null,
    last_checked_at: typeof row.last_checked_at === 'string' ? row.last_checked_at : null,
    metadata: readRecord(row.metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

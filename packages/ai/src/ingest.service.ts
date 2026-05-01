import { getSupabaseAdmin } from './lib/supabase'
import { crawlUrl } from './crawler.service'
import { parseFile } from './parser.service'
import { chunkRawContent } from './chunk.service'
import { generateEmbeddingsBatch } from './embeddings.service'

export interface IngestUrlParams {
  url: string
  kbId: string
  orgId: string
  openaiApiKey?: string
  sourceType?: string
  isPinned?: boolean
  pinnedReason?: string
}

export interface IngestFileParams {
  fileBuffer: Buffer
  mimeType: string
  filename?: string
  kbId: string
  orgId: string
  openaiApiKey?: string
  sourceType?: string
  isPinned?: boolean
  pinnedReason?: string
}

export interface IngestTextParams {
  content: string
  title?: string
  kbId: string
  orgId: string
  openaiApiKey?: string
  sourceType?: string
  isPinned?: boolean
  pinnedReason?: string
}

export interface IngestResult {
  success: boolean
  chunksStored: number
  sourceUrl?: string
  sourceTitle?: string
  error?: string
}

interface KbChunkInsert {
  kb_id: string
  org_id: string
  content: string
  embedding: number[]
  source_url: string | null
  source_title: string | null
  source_type?: string
  is_pinned?: boolean
  pinned_reason?: string | null
  metadata: Record<string, unknown>
}

// ─── Core storage helper ──────────────────────────────────────────────────────

async function storeChunks(records: KbChunkInsert[]): Promise<void> {
  if (records.length === 0) return

  const supabase = getSupabaseAdmin()

  // Insert in batches of 50 to avoid PostgREST payload limits
  const INSERT_BATCH = 50
  for (let i = 0; i < records.length; i += INSERT_BATCH) {
    const batch = records.slice(i, i + INSERT_BATCH)
    const { error } = await supabase.from('kb_chunks').insert(batch)

    if (error) {
      throw new Error(`[ingest] DB insert failed (batch ${Math.floor(i / INSERT_BATCH) + 1}): ${error.message}`)
    }
  }
}

// ─── URL ingestion ────────────────────────────────────────────────────────────

/**
 * Crawl a URL, chunk its content, embed, and store in kb_chunks.
 */
export async function ingestUrl(params: IngestUrlParams): Promise<IngestResult> {
  const { url, kbId, orgId, openaiApiKey, sourceType = 'url', isPinned = false, pinnedReason } = params

  try {
    // 1. Crawl
    const crawlResult = await crawlUrl(url)

    if (!crawlResult.content || crawlResult.content.length < 50) {
      return {
        success: false,
        chunksStored: 0,
        sourceUrl: url,
        error: 'Crawled page had insufficient text content.',
      }
    }

    // 2. Chunk
    const rawChunks = chunkRawContent(
      crawlResult.content,
      crawlResult.sourceUrl,
      crawlResult.title
    )

    if (rawChunks.length === 0) {
      return { success: true, chunksStored: 0, sourceUrl: url, sourceTitle: crawlResult.title }
    }

    // 3. Embed
    const texts = rawChunks.map(c => c.content)
    const embeddings = await generateEmbeddingsBatch(texts, openaiApiKey)

    // 4. Store
    const records: KbChunkInsert[] = rawChunks.map((chunk, i) => ({
      kb_id: kbId,
      org_id: orgId,
      content: chunk.content,
      embedding: embeddings[i] ?? [],
      source_url: chunk.sourceUrl ?? null,
      source_title: chunk.sourceTitle ?? null,
      source_type: sourceType,
      is_pinned: isPinned,
      pinned_reason: pinnedReason ?? null,
      metadata: {
        ...((chunk.metadata ?? {}) as Record<string, unknown>),
        sourceType,
        pinned: isPinned,
      },
    }))

    await storeChunks(records)

    return {
      success: true,
      chunksStored: records.length,
      sourceUrl: url,
      sourceTitle: crawlResult.title,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[ingest] URL ingestion failed for ${url}:`, message)
    return { success: false, chunksStored: 0, sourceUrl: url, error: message }
  }
}

// ─── File ingestion ───────────────────────────────────────────────────────────

/**
 * Parse a file buffer (PDF/DOCX), chunk, embed, and store in kb_chunks.
 */
export async function ingestFile(params: IngestFileParams): Promise<IngestResult> {
  const { fileBuffer, mimeType, filename, kbId, orgId, openaiApiKey, sourceType = 'file', isPinned = false, pinnedReason } = params

  try {
    // 1. Parse
    const parseResult = await parseFile(fileBuffer, mimeType)

    if (!parseResult.content || parseResult.content.length < 50) {
      return {
        success: false,
        chunksStored: 0,
        sourceTitle: filename,
        error: 'File had insufficient text content.',
      }
    }

    // 2. Chunk
    const sourceTitle = parseResult.title || filename || 'Uploaded Document'
    const rawChunks = chunkRawContent(parseResult.content, undefined, sourceTitle)

    if (rawChunks.length === 0) {
      return { success: true, chunksStored: 0, sourceTitle }
    }

    // 3. Embed
    const texts = rawChunks.map(c => c.content)
    const embeddings = await generateEmbeddingsBatch(texts, openaiApiKey)

    // 4. Store
    const records: KbChunkInsert[] = rawChunks.map((chunk, i) => ({
      kb_id: kbId,
      org_id: orgId,
      content: chunk.content,
      embedding: embeddings[i] ?? [],
      source_url: null,
      source_title: chunk.sourceTitle ?? null,
      source_type: sourceType,
      is_pinned: isPinned,
      pinned_reason: pinnedReason ?? null,
      metadata: {
        ...((chunk.metadata ?? {}) as Record<string, unknown>),
        sourceType,
        pinned: isPinned,
      },
    }))

    await storeChunks(records)

    return { success: true, chunksStored: records.length, sourceTitle }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ingest] File ingestion failed:', message)
    return { success: false, chunksStored: 0, sourceTitle: filename, error: message }
  }
}

// --- Text note ingestion -----------------------------------------------------

/**
 * Ingest a plain text note directly (without fake file conversion).
 */
export async function ingestText(params: IngestTextParams): Promise<IngestResult> {
  const {
    content,
    title,
    kbId,
    orgId,
    openaiApiKey,
    sourceType = 'text_note',
    isPinned = false,
    pinnedReason,
  } = params

  try {
    const trimmed = content.trim()
    if (trimmed.length < 50) {
      return {
        success: false,
        chunksStored: 0,
        sourceTitle: title ?? 'Text Note',
        error: 'Text note has insufficient content.',
      }
    }

    const sourceTitle = title?.trim() || 'Text Note'
    const rawChunks = chunkRawContent(trimmed, undefined, sourceTitle)

    if (rawChunks.length === 0) {
      return { success: true, chunksStored: 0, sourceTitle }
    }

    const texts = rawChunks.map((chunk) => chunk.content)
    const embeddings = await generateEmbeddingsBatch(texts, openaiApiKey)

    const records: KbChunkInsert[] = rawChunks.map((chunk, index) => ({
      kb_id: kbId,
      org_id: orgId,
      content: chunk.content,
      embedding: embeddings[index] ?? [],
      source_url: null,
      source_title: chunk.sourceTitle ?? sourceTitle,
      source_type: sourceType,
      is_pinned: isPinned,
      pinned_reason: pinnedReason ?? null,
      metadata: {
        ...(chunk.metadata ?? {}),
        sourceType,
        pinned: isPinned,
      },
    }))

    await storeChunks(records)

    return {
      success: true,
      chunksStored: records.length,
      sourceTitle,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ingest] Text note ingestion failed:', message)
    return {
      success: false,
      chunksStored: 0,
      sourceTitle: title ?? 'Text Note',
      error: message,
    }
  }
}

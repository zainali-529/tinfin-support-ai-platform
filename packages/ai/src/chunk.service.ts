import type { RawChunk } from '@workspace/types'

export interface ChunkOptions {
  /** Words per chunk. Default: 500 */
  wordsPerChunk?: number
  /** Overlap words between adjacent chunks. Default: 50 */
  overlapWords?: number
}

export interface TextChunk {
  content: string
  index: number
  metadata: {
    chunkIndex: number
    totalChunks: number
    wordCount: number
    charCount: number
  }
}

const DEFAULT_WORDS_PER_CHUNK = 500
const DEFAULT_OVERLAP_WORDS = 50

/**
 * Split text into overlapping word-based chunks.
 *
 * @param text        Raw text to split
 * @param options     Chunk size and overlap configuration
 * @returns           Array of TextChunk objects
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const wordsPerChunk = options.wordsPerChunk ?? DEFAULT_WORDS_PER_CHUNK
  const overlapWords = Math.min(
    options.overlapWords ?? DEFAULT_OVERLAP_WORDS,
    Math.floor(wordsPerChunk / 2)
  )

  const trimmed = text.trim()
  if (!trimmed) return []

  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return []

  const chunks: TextChunk[] = []
  let startIndex = 0

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + wordsPerChunk, words.length)
    const chunkWords = words.slice(startIndex, endIndex)
    const content = chunkWords.join(' ')

    chunks.push({
      content,
      index: chunks.length,
      metadata: {
        chunkIndex: chunks.length,
        totalChunks: 0, // backfilled below
        wordCount: chunkWords.length,
        charCount: content.length,
      },
    })

    if (endIndex >= words.length) break

    // Advance by (wordsPerChunk - overlapWords) so adjacent chunks share
    // `overlapWords` words for context continuity.
    startIndex = endIndex - overlapWords
  }

  // Backfill totalChunks now that we know the final count
  const total = chunks.length
  for (const chunk of chunks) {
    chunk.metadata.totalChunks = total
  }

  return chunks
}

/**
 * Convenience wrapper — returns RawChunk[] directly for ingestion pipeline.
 */
export function chunkRawContent(
  text: string,
  sourceUrl?: string,
  sourceTitle?: string,
  options?: ChunkOptions
): RawChunk[] {
  const textChunks = chunkText(text, options)

  return textChunks.map(tc => ({
    content: tc.content,
    sourceUrl,
    sourceTitle,
    metadata: tc.metadata as Record<string, unknown>,
  }))
}
import { createOpenAIClient } from './providers/openai.provider'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536
const BATCH_SIZE = 100

/**
 * Generate a single embedding vector for one text string.
 */
export async function generateEmbedding(
  text: string,
  apiKey?: string
): Promise<number[]> {
  if (!text.trim()) {
    throw new Error('Cannot generate embedding for empty text.')
  }

  const client = createOpenAIClient(apiKey)

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      dimensions: EMBEDDING_DIMENSIONS,
    })

    const embedding = response.data[0]?.embedding
    if (!embedding || embedding.length === 0) {
      throw new Error('OpenAI returned an empty embedding.')
    }

    return embedding
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`[embeddings] Failed to embed text: ${message}`)
  }
}

/**
 * Generate embeddings for multiple texts.
 * Processes in batches of BATCH_SIZE (100) to respect API limits.
 *
 * @returns  number[][] — one embedding per input text, same order guaranteed
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  apiKey?: string
): Promise<number[][]> {
  if (texts.length === 0) return []

  const client = createOpenAIClient(apiKey)
  const allEmbeddings: number[][] = new Array(texts.length)

  for (let batchStart = 0; batchStart < texts.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, texts.length)
    const batch = texts.slice(batchStart, batchEnd).map(t => t.trim())

    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      })

      // API returns items sorted by index — map back to original positions
      for (const item of response.data) {
        allEmbeddings[batchStart + item.index] = item.embedding
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1
      throw new Error(`[embeddings] Batch ${batchNum} failed: ${message}`)
    }
  }

  return allEmbeddings
}
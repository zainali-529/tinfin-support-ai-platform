import { getSupabaseAdmin } from './lib/supabase'
import { createOpenAIClient } from './providers/openai.provider'
import { generateEmbedding } from './embeddings.service'

export interface RAGQuery {
  query: string
  orgId: string
  kbId?: string
  conversationId?: string
  messageId?: string
  channel?: string
  threshold?: number
  maxChunks?: number
  openaiApiKey?: string
}

export interface RAGSource {
  title: string | null
  url: string | null
  similarity: number
  sourceType?: string | null
  pinned?: boolean
}

export type RAGResultType = 'answer' | 'handoff' | 'ask_handoff' | 'casual'

export interface RAGResult {
  type: RAGResultType
  message: string
  confidence: number
  sources: RAGSource[]
  tokensUsed?: number
  debug?: {
    intent: string
    rewrittenQuery: string
    guidanceCount: number
    usedPinnedCompanyContext: boolean
  }
}

interface MatchedChunk {
  id: string
  kb_id?: string | null
  content: string
  source_url: string | null
  source_title: string | null
  metadata: Record<string, unknown>
  similarity: number
}

const DEFAULT_SEARCH_THRESHOLD = 0.25
const KB_RELEVANCE_THRESHOLD = 0.38
const DEFAULT_MAX_CHUNKS = 6
const GPT_MODEL = 'gpt-4o-mini'
const KB_SCOPE_SEARCH_FACTOR = 8
const KB_SCOPE_MIN_COUNT = 50
const KB_SCOPE_MAX_COUNT = 200

const HUMAN_REQUEST_PATTERNS = [
  /human\s?agent/i,
  /real\s?person/i,
  /speak\s?(to|with)\s?(a\s?)?(human|person|agent|someone)/i,
  /connect\s?(me)?\s?(to|with)\s?(a\s?)?(human|agent|person)/i,
  /transfer\s?(me)?\s?(to\s?)?(human|agent)/i,
  /i\s?want\s?(a\s?)?(human|agent|person)/i,
  /talk\s?(to|with)\s?(a\s?)?(human|person|agent)/i,
  /switch\s?(to\s?)?(human|agent)/i,
  /escalate/i,
]

const CONFIRM_YES_PATTERNS = [
  /^(yes|yeah|yep|yup|sure|ok|okay|please|haan|ha|ji|ji\s?haan|please\s?do|go\s?ahead)\b/i,
]

function isExplicitHumanRequest(query: string): boolean {
  return HUMAN_REQUEST_PATTERNS.some((pattern) => pattern.test(query.trim()))
}

export function isHandoffConfirmation(query: string): boolean {
  return CONFIRM_YES_PATTERNS.some((pattern) => pattern.test(query.trim()))
}

async function searchSimilarChunks(
  embedding: number[],
  orgId: string,
  threshold: number,
  count: number,
  kbId?: string
): Promise<MatchedChunk[]> {
  const supabase = getSupabaseAdmin()
  const expandedCount = kbId
    ? Math.min(Math.max(count * KB_SCOPE_SEARCH_FACTOR, KB_SCOPE_MIN_COUNT), KB_SCOPE_MAX_COUNT)
    : count

  let data: MatchedChunk[] | null = null
  let error: { message: string } | null = null

  const scopedRpc = await supabase.rpc('match_kb_chunks', {
    query_embedding: embedding,
    match_org_id: orgId,
    match_threshold: threshold,
    match_count: expandedCount,
    ...(kbId ? { match_kb_id: kbId } : {}),
  })

  data = (scopedRpc.data as MatchedChunk[] | null) ?? null
  error = scopedRpc.error ? { message: scopedRpc.error.message } : null

  if (error && kbId) {
    const fallbackRpc = await supabase.rpc('match_kb_chunks', {
      query_embedding: embedding,
      match_org_id: orgId,
      match_threshold: threshold,
      match_count: expandedCount,
    })
    data = (fallbackRpc.data as MatchedChunk[] | null) ?? null
    error = fallbackRpc.error ? { message: fallbackRpc.error.message } : null
  }

  if (error) {
    throw new Error(`[rag] Vector search RPC failed: ${error.message}`)
  }

  let chunks = data ?? []

  if (kbId && chunks.length > 0) {
    const candidateIds = chunks.map((chunk) => chunk.id)
    const { data: kbRows, error: kbError } = await supabase
      .from('kb_chunks')
      .select('id')
      .eq('org_id', orgId)
      .eq('kb_id', kbId)
      .in('id', candidateIds)

    if (kbError) {
      throw new Error(`[rag] kb scope validation failed: ${kbError.message}`)
    }

    const allowedIds = new Set((kbRows ?? []).map((row: { id: string }) => row.id))
    chunks = chunks.filter((chunk) => allowedIds.has(chunk.id))
  }

  return chunks.slice(0, count)
}

function calculateConfidence(chunks: MatchedChunk[]): number {
  if (chunks.length === 0) return 0
  const topSimilarity = chunks[0]?.similarity ?? 0
  const avgSimilarity = chunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / chunks.length
  return topSimilarity * 0.6 + avgSimilarity * 0.4
}

function buildContext(chunks: MatchedChunk[]): string {
  if (chunks.length === 0) return ''
  return chunks
    .map((chunk, index) => {
      const source = chunk.source_title ?? chunk.source_url ?? 'Knowledge Base'
      return `[Source ${index + 1}: ${source}]\n${chunk.content}`
    })
    .join('\n\n---\n\n')
}

function deriveTopicsHint(chunks: MatchedChunk[]): string {
  if (chunks.length === 0) return ''
  const sources = [...new Set(
    chunks
      .map((chunk) => chunk.source_title ?? chunk.source_url)
      .filter((source): source is string => Boolean(source))
  )].slice(0, 4)
  return sources.length > 0 ? `Topics available in knowledge base: ${sources.join(', ')}` : ''
}

function buildMasterPrompt(context: string, topicsHint: string, hasStrongContext: boolean): string {
  const kbSection = context
    ? `## Knowledge Base Context\n${context}`
    : '## Knowledge Base Context\n(No relevant articles found for this specific query)'

  return `You are a professional, intelligent, and warm customer support assistant.

${kbSection}

${topicsHint ? `## Topics You Have Knowledge On\n${topicsHint}\n` : ''}

## Response Guidelines

**For greetings, pleasantries, or "how are you" type messages:**
Respond naturally and warmly. Briefly introduce what you can help with based on the topics above. Keep it natural and inviting.

**For questions about your capabilities ("what can you do", "what do you help with"):**
Explain specifically what topics and information you have available, derived from the knowledge base above.

**For domain-specific questions answerable from the knowledge base:**
Answer accurately and professionally using ONLY the knowledge base context provided. Never fabricate facts, prices, features, policies, integrations, or company information not present in the context. Match the user's language.

**For questions outside the knowledge base or when the context is not enough:**
${hasStrongContext
  ? 'Use the provided context only. If the answer still is not present, respond with exactly this token and nothing else: OUT_OF_SCOPE'
  : 'Respond with exactly this token and nothing else: OUT_OF_SCOPE'}

## Hard Rules
1. Never reveal source tags [Source N:] in your reply.
2. Never mention "knowledge base", "context", "chunks", or internal system details.
3. Never answer questions about topics outside the provided knowledge base.
4. Always respond in the same language the user is writing in.
5. Be warm, professional, and human.
6. Keep responses concise but complete.`.trim()
}

async function generateContextualResponse(
  client: ReturnType<typeof createOpenAIClient>,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 120,
  temperature = 0.5
): Promise<{ text: string; tokens: number }> {
  const completion = await client.chat.completions.create({
    model: GPT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature,
  })

  return {
    text: completion.choices[0]?.message?.content?.trim() ?? '',
    tokens: completion.usage?.total_tokens ?? 0,
  }
}

function buildNoAnswerMessage(query: string): string {
  const romanUrdu = /\b(aap|ap|tum|kya|kia|hai|hain|mujhe|mujha|btao|batao|kesay|kaise)\b/i.test(query)
  if (romanUrdu) {
    return 'Mere paas is sawal ka verified answer available nahi hai. Agar aap chahen to main aapko human agent se connect kar sakta hoon. (Reply **yes** to connect)'
  }
  return "I'm sorry, I don't have specific information about that at the moment. Would you like me to connect you with a human agent who can help further? (Reply **yes** to connect)"
}

function withDebug(result: RAGResult, query: string): RAGResult {
  return {
    ...result,
    debug: {
      intent: result.type,
      rewrittenQuery: query,
      guidanceCount: 0,
      usedPinnedCompanyContext: false,
    },
  }
}

export async function queryRAG(params: RAGQuery): Promise<RAGResult> {
  const {
    query,
    orgId,
    kbId,
    threshold = DEFAULT_SEARCH_THRESHOLD,
    maxChunks = DEFAULT_MAX_CHUNKS,
    openaiApiKey,
  } = params

  const trimmedQuery = query.trim()
  const client = createOpenAIClient(openaiApiKey)

  if (!trimmedQuery) {
    const { text, tokens } = await generateContextualResponse(
      client,
      'The user just opened the chat. Greet them warmly as a support assistant and ask how you can help. Keep it to 1-2 sentences.',
      '(user opened the chat)',
      100,
      0.7
    )

    return withDebug({
      type: 'casual',
      message: text || 'Hello! How can I help you today?',
      confidence: 1,
      sources: [],
      tokensUsed: tokens,
    }, trimmedQuery)
  }

  if (isExplicitHumanRequest(trimmedQuery)) {
    const { text, tokens } = await generateContextualResponse(
      client,
      'The user wants to speak to a human agent. Respond warmly and professionally, confirming you are connecting them now. Be reassuring and brief: 1-2 sentences.',
      trimmedQuery,
      100,
      0.5
    )

    return withDebug({
      type: 'handoff',
      message: text || 'Of course. Let me connect you with a human agent right away. Please hold on for a moment.',
      confidence: 1,
      sources: [],
      tokensUsed: tokens,
    }, trimmedQuery)
  }

  const queryEmbedding = await generateEmbedding(trimmedQuery, openaiApiKey)
  const matchedChunks = await searchSimilarChunks(queryEmbedding, orgId, threshold, maxChunks, kbId)
  const confidence = calculateConfidence(matchedChunks)
  const hasStrongContext = confidence >= KB_RELEVANCE_THRESHOLD

  const sources: RAGSource[] = matchedChunks.map((chunk) => ({
    title: chunk.source_title,
    url: chunk.source_url,
    similarity: Number.parseFloat(chunk.similarity.toFixed(4)),
    sourceType: typeof chunk.metadata?.sourceType === 'string' ? chunk.metadata.sourceType : null,
    pinned: chunk.metadata?.pinned === true,
  }))

  if (!hasStrongContext) {
    return withDebug({
      type: 'ask_handoff',
      message: buildNoAnswerMessage(trimmedQuery),
      confidence,
      sources,
      tokensUsed: 0,
    }, trimmedQuery)
  }

  const systemPrompt = buildMasterPrompt(
    buildContext(matchedChunks),
    deriveTopicsHint(matchedChunks),
    hasStrongContext
  )

  const mainCompletion = await client.chat.completions.create({
    model: GPT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: trimmedQuery },
    ],
    max_tokens: 700,
    temperature: 0.3,
  })

  const rawAnswer = mainCompletion.choices[0]?.message?.content?.trim() ?? ''
  const tokensUsed = mainCompletion.usage?.total_tokens ?? 0

  if (!rawAnswer || rawAnswer === 'OUT_OF_SCOPE' || rawAnswer.includes('OUT_OF_SCOPE')) {
    return withDebug({
      type: 'ask_handoff',
      message: buildNoAnswerMessage(trimmedQuery),
      confidence,
      sources,
      tokensUsed,
    }, trimmedQuery)
  }

  return withDebug({
    type: 'answer',
    message: rawAnswer,
    confidence,
    sources,
    tokensUsed,
  }, trimmedQuery)
}

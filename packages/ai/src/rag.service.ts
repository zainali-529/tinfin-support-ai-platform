import { getSupabaseAdmin } from './lib/supabase'
import { createOpenAIClient } from './providers/openai.provider'
import { generateEmbedding } from './embeddings.service'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RAGQuery {
  query: string
  orgId: string
  kbId?: string
  threshold?: number
  maxChunks?: number
  openaiApiKey?: string
}

export interface RAGSource {
  title: string | null
  url: string | null
  similarity: number
}

export type RAGResultType = 'answer' | 'handoff' | 'ask_handoff' | 'casual'

export interface RAGResult {
  type: RAGResultType
  message: string
  confidence: number
  sources: RAGSource[]
  tokensUsed?: number
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SEARCH_THRESHOLD = 0.25
const KB_RELEVANCE_THRESHOLD = 0.38
const DEFAULT_MAX_CHUNKS = 6
const GPT_MODEL = 'gpt-4o-mini'
const KB_SCOPE_SEARCH_FACTOR = 8
const KB_SCOPE_MIN_COUNT = 50
const KB_SCOPE_MAX_COUNT = 200

// ─── Human Handoff Detection ──────────────────────────────────────────────────

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

function isExplicitHumanRequest(query: string): boolean {
  return HUMAN_REQUEST_PATTERNS.some(p => p.test(query.trim()))
}

// ─── Handoff Confirmation ─────────────────────────────────────────────────────

const CONFIRM_YES_PATTERNS = [
  /^(yes|yeah|yep|yup|sure|ok|okay|please|haan|ha|ji|ji\s?haan|please\s?do|go\s?ahead)\b/i,
]

export function isHandoffConfirmation(query: string): boolean {
  return CONFIRM_YES_PATTERNS.some(p => p.test(query.trim()))
}

// ─── Vector Search ────────────────────────────────────────────────────────────

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

  // Fallback for deployments where RPC signature does not accept match_kb_id yet
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

  let chunks = (data as MatchedChunk[]) ?? []

  if (kbId && chunks.length > 0) {
    const candidateIds = chunks.map(chunk => chunk.id)
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
    chunks = chunks.filter(chunk => allowedIds.has(chunk.id))
  }

  return chunks.slice(0, count)
}

// ─── Confidence Scoring ───────────────────────────────────────────────────────

function calculateConfidence(chunks: MatchedChunk[]): number {
  if (chunks.length === 0) return 0
  const topSimilarity = chunks[0]?.similarity ?? 0
  const avgSimilarity = chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
  return topSimilarity * 0.6 + avgSimilarity * 0.4
}

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildContext(chunks: MatchedChunk[]): string {
  if (chunks.length === 0) return ''
  return chunks
    .map((chunk, i) => {
      const source = chunk.source_title ?? chunk.source_url ?? 'Knowledge Base'
      return `[Source ${i + 1}: ${source}]\n${chunk.content}`
    })
    .join('\n\n---\n\n')
}

// ─── Topics Hint (derived from KB results, used for greetings/capability Q's) ─

function deriveTopicsHint(chunks: MatchedChunk[]): string {
  if (chunks.length === 0) return ''
  const sources = [...new Set(
    chunks
      .map(c => c.source_title ?? c.source_url)
      .filter((s): s is string => !!s)
  )].slice(0, 4)
  return sources.length > 0 ? `Topics available in knowledge base: ${sources.join(', ')}` : ''
}

// ─── Master System Prompt ─────────────────────────────────────────────────────

function buildMasterPrompt(
  context: string,
  topicsHint: string,
  hasStrongContext: boolean
): string {
  const kbSection = context
    ? `## Knowledge Base Context\n${context}`
    : `## Knowledge Base Context\n(No relevant articles found for this specific query)`

  return `You are a professional, intelligent, and warm customer support assistant.

Your entire knowledge comes from the company's knowledge base provided below. You do not have access to external information, the internet, or any knowledge outside of what is in this knowledge base.

${kbSection}

${topicsHint ? `## Topics You Have Knowledge On\n${topicsHint}\n` : ''}

---

## Response Guidelines

**For greetings, pleasantries, or "how are you" type messages:**
Respond naturally and warmly, as a knowledgeable human assistant would. Briefly introduce what you can help with based on the topics above. Do not be robotic. Keep it natural and inviting.

**For questions about your capabilities ("what can you do", "what do you help with"):**
Explain specifically what topics and information you have available, derived from the knowledge base above. Be specific — tell them exactly what you know, not vague platitudes.

**For domain-specific questions answerable from the knowledge base:**
Answer accurately and professionally using ONLY the knowledge base context provided. Be thorough, clear, and naturally appreciative where appropriate. Never fabricate facts, prices, features, or policies not present in the context. Match the user's language.

**For questions that are completely unrelated to your knowledge base** (other companies, entertainment, anime, coding help unrelated to KB, world news, unrelated topics):
Respond with exactly this token and nothing else: OUT_OF_DOMAIN

**For questions that seem relevant but the knowledge base doesn't contain enough specific information:**
${hasStrongContext
  ? 'The context has relevant information — use it to answer as completely as you can.'
  : 'Respond with exactly this token and nothing else: OUT_OF_SCOPE'
}

---

## Hard Rules
1. Never reveal source tags [Source N:] in your reply.
2. Never mention "knowledge base", "context", "chunks", or internal system details.
3. Never answer questions about topics outside your knowledge base — not even partially.
4. Always respond in the same language the user is writing in.
5. Be warm, professional, and human. Acknowledge feelings if the user seems frustrated or confused.
6. Keep responses concise but complete: 2–4 sentences for simple queries, more detail for complex ones.`.trim()
}

// ─── LLM Call Helper ─────────────────────────────────────────────────────────

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

// ─── Main RAG Function ────────────────────────────────────────────────────────

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

  // ── Empty message: generate a natural greeting ────────────────────────────
  if (!trimmedQuery) {
    const { text, tokens } = await generateContextualResponse(
      client,
      'You are a friendly customer support assistant. The user just opened the chat. Greet them warmly and ask how you can help them today. Keep it to 1–2 sentences, natural and inviting.',
      '(user opened the chat)',
      100,
      0.7
    )
    return {
      type: 'casual',
      message: text || "Hello! 👋 How can I help you today?",
      confidence: 1,
      sources: [],
      tokensUsed: tokens,
    }
  }

  // ── Explicit human agent request ──────────────────────────────────────────
  if (isExplicitHumanRequest(trimmedQuery)) {
    const { text, tokens } = await generateContextualResponse(
      client,
      'The user wants to speak to a human agent. Respond warmly and professionally, confirming you are connecting them now. Be reassuring and brief — 1–2 sentences.',
      trimmedQuery,
      100,
      0.5
    )
    return {
      type: 'handoff',
      message: text || "Of course! Let me connect you with a human agent right away. Please hold on for a moment. 🙏",
      confidence: 1,
      sources: [],
      tokensUsed: tokens,
    }
  }

  // ── Embed query and search knowledge base ─────────────────────────────────
  const queryEmbedding = await generateEmbedding(trimmedQuery, openaiApiKey)

  const matchedChunks = await searchSimilarChunks(
    queryEmbedding,
    orgId,
    threshold,
    maxChunks,
    kbId
  )

  const confidence = calculateConfidence(matchedChunks)
  const hasStrongContext = confidence >= KB_RELEVANCE_THRESHOLD

  const sources: RAGSource[] = matchedChunks.map(c => ({
    title: c.source_title,
    url: c.source_url,
    similarity: parseFloat(c.similarity.toFixed(4)),
  }))

  const context = buildContext(matchedChunks)
  const topicsHint = deriveTopicsHint(matchedChunks)

  // ── Single intelligent LLM call ───────────────────────────────────────────
  const systemPrompt = buildMasterPrompt(context, topicsHint, hasStrongContext)

  const mainCompletion = await client.chat.completions.create({
    model: GPT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: trimmedQuery },
    ],
    max_tokens: 700,
    temperature: 0.4,
  })

  const rawAnswer = mainCompletion.choices[0]?.message?.content?.trim() ?? ''
  const mainTokens = mainCompletion.usage?.total_tokens ?? 0

  // ── OUT_OF_SCOPE: KB-adjacent but not enough info → offer handoff ─────────
  if (!rawAnswer || rawAnswer === 'OUT_OF_SCOPE' || rawAnswer.includes('OUT_OF_SCOPE')) {
    const { text, tokens } = await generateContextualResponse(
      client,
      `You are a professional support assistant. The user asked something within your general domain, but you don't have the specific information to answer it well. Apologize briefly and professionally, then ask if they'd like to be connected with a human agent who can help further. Include "(Reply **yes** to connect)" naturally at the end. Keep it to 2–3 sentences.`,
      trimmedQuery,
      150,
      0.5
    )
    return {
      type: 'ask_handoff',
      message: text || "I'm sorry, I don't have specific information about that at the moment. Would you like me to connect you with a human agent who can help further? (Reply **yes** to connect)",
      confidence,
      sources,
      tokensUsed: mainTokens + tokens,
    }
  }

  // ── OUT_OF_DOMAIN: completely off-topic → politely decline ────────────────
  if (rawAnswer === 'OUT_OF_DOMAIN' || rawAnswer.includes('OUT_OF_DOMAIN')) {
    const { text, tokens } = await generateContextualResponse(
      client,
      `You are a professional support assistant with expertise limited to your company's specific knowledge base. The user asked something completely outside your domain of expertise. Politely and warmly let them know you can only help with your specific area. Be kind, not dismissive. Keep it to 2 sentences.`,
      trimmedQuery,
      120,
      0.5
    )
    return {
      type: 'casual',
      message: text || "That's a bit outside my area of expertise! I'm best equipped to help with questions related to our specific services — feel free to ask me anything in that space.",
      confidence: 0,
      sources: [],
      tokensUsed: mainTokens + tokens,
    }
  }

  // ── Successful answer ─────────────────────────────────────────────────────
  return {
    type: hasStrongContext ? 'answer' : 'casual',
    message: rawAnswer,
    confidence,
    sources,
    tokensUsed: mainTokens,
  }
}
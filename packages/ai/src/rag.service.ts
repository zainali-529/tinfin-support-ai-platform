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
  content: string
  source_url: string | null
  source_title: string | null
  metadata: Record<string, unknown>
  similarity: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SEARCH_THRESHOLD = 0.3
const HANDOFF_THRESHOLD = 0.4
const DEFAULT_MAX_CHUNKS = 5
const GPT_MODEL = 'gpt-4o-mini'

// ─── Intent Detection ─────────────────────────────────────────────────────────

type Intent =
  | 'greeting'        // Hi, Hello, Hey, Assalam o Alaikum
  | 'thanks'          // Thank you, Got it, Okay thanks, Shukriya
  | 'goodbye'         // Bye, Take care, Allah hafiz
  | 'human_request'   // I want human, connect me to agent
  | 'question'        // Actual support question

const GREETING_PATTERNS = [
  /^(hi|hello|hey|hiya|howdy|salam|assalam|assalamualaikum|walaikum|good\s?(morning|afternoon|evening|day)|what'?s\s?up|sup)\b/i,
]

const THANKS_PATTERNS = [
  /^(thanks?|thank\s?you|thx|got\s?it|okay|ok|alright|noted|understood|great|perfect|awesome|shukriya|شکریہ|jazak)\b/i,
]

const GOODBYE_PATTERNS = [
  /^(bye|goodbye|see\s?ya|take\s?care|allah\s?hafiz|khuda\s?hafiz|cya|later)\b/i,
]

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

function detectIntent(query: string): Intent {
  const trimmed = query.trim()

  if (HUMAN_REQUEST_PATTERNS.some(p => p.test(trimmed))) return 'human_request'
  if (GREETING_PATTERNS.some(p => p.test(trimmed))) return 'greeting'
  if (GOODBYE_PATTERNS.some(p => p.test(trimmed))) return 'goodbye'
  if (THANKS_PATTERNS.some(p => p.test(trimmed))) return 'thanks'

  return 'question'
}

// ─── Casual Response Generator ────────────────────────────────────────────────

function getCasualResponse(intent: Intent): string {
  switch (intent) {
    case 'greeting':
      return "Hello! 👋 I'm here to help. What can I assist you with today?"

    case 'thanks':
      return "You're welcome! 😊 Is there anything else I can help you with?"

    case 'goodbye':
      return "Goodbye! Have a great day. Feel free to reach out anytime you need help. 👋"

    default:
      return "I'm here to help! What would you like to know?"
  }
}

// ─── Vector Search ────────────────────────────────────────────────────────────

async function searchSimilarChunks(
  embedding: number[],
  orgId: string,
  threshold: number,
  count: number
): Promise<MatchedChunk[]> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase.rpc('match_kb_chunks', {
    query_embedding: embedding,
    match_org_id: orgId,
    match_threshold: threshold,
    match_count: count,
  })

  if (error) {
    throw new Error(`[rag] Vector search RPC failed: ${error.message}`)
  }

  return (data as MatchedChunk[]) ?? []
}

// ─── Confidence Scoring ───────────────────────────────────────────────────────

function calculateConfidence(chunks: MatchedChunk[]): number {
  if (chunks.length === 0) return 0
  const topSimilarity = chunks[0]?.similarity ?? 0
  const avgSimilarity =
    chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
  return topSimilarity * 0.6 + avgSimilarity * 0.4
}

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildContext(chunks: MatchedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const source = chunk.source_title ?? chunk.source_url ?? 'Knowledge Base'
      return `[Source ${i + 1}: ${source}]\n${chunk.content}`
    })
    .join('\n\n---\n\n')
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(context: string): string {
  return `You are a friendly and professional customer support assistant.

Your job is to answer questions using the Knowledge Base Context below.

## Rules:
1. Answer ONLY from the context provided. Do not use outside knowledge.
2. If the answer is NOT in the context, respond with exactly this phrase:
   "OUT_OF_SCOPE"
3. Be warm, concise, and professional — like a real support agent.
4. Do NOT mention "context", "sources", or "[Source X]" in your reply.
5. Respond in the same language as the user.
6. Keep answers to 1-3 sentences unless more detail is needed.

## Knowledge Base Context:
${context}`
}

// ─── Out-of-scope response ────────────────────────────────────────────────────

const OUT_OF_SCOPE_MESSAGES = [
  "I don't have specific information about that in my knowledge base. Would you like me to connect you with a human agent who can help further? (Reply **yes** to connect)",
  "That's a bit outside what I have information on right now. Would you like me to transfer you to a human agent? (Reply **yes** to connect)",
  "I'm not able to find a good answer for that one. Can I connect you to one of our human agents for better assistance? (Reply **yes** to connect)",
]

function getOutOfScopeMessage(): string {
  const index = Math.floor(Math.random() * OUT_OF_SCOPE_MESSAGES.length)
  return OUT_OF_SCOPE_MESSAGES[index] ?? OUT_OF_SCOPE_MESSAGES[0]!
}

// ─── User confirming handoff ──────────────────────────────────────────────────

const CONFIRM_YES_PATTERNS = [
  /^(yes|yeah|yep|yup|sure|ok|okay|please|haan|ha|ji|ji\s?haan|please\s?do|go\s?ahead)\b/i,
]

export function isHandoffConfirmation(query: string): boolean {
  return CONFIRM_YES_PATTERNS.some(p => p.test(query.trim()))
}

// ─── Main RAG Function ────────────────────────────────────────────────────────

export async function queryRAG(params: RAGQuery): Promise<RAGResult> {
  const {
    query,
    orgId,
    threshold = DEFAULT_SEARCH_THRESHOLD,
    maxChunks = DEFAULT_MAX_CHUNKS,
    openaiApiKey,
  } = params

  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    return {
      type: 'casual',
      message: "Hello! How can I help you today? 😊",
      confidence: 1,
      sources: [],
    }
  }

  // ── Step 1: Detect intent ─────────────────────────────────────────────────
  const intent = detectIntent(trimmedQuery)

  // ── Step 2: Handle non-question intents immediately (no RAG needed) ───────
  if (intent === 'greeting' || intent === 'thanks' || intent === 'goodbye') {
    return {
      type: 'casual',
      message: getCasualResponse(intent),
      confidence: 1,
      sources: [],
    }
  }

  // ── Step 3: Explicit human agent request ─────────────────────────────────
  if (intent === 'human_request') {
    return {
      type: 'handoff',
      message: "Sure! Let me connect you with a human agent right away. Please hold on. 🙏",
      confidence: 1,
      sources: [],
    }
  }

  // ── Step 4: Embed query ───────────────────────────────────────────────────
  const queryEmbedding = await generateEmbedding(trimmedQuery, openaiApiKey)

  // ── Step 5: Vector search ─────────────────────────────────────────────────
  const matchedChunks = await searchSimilarChunks(
    queryEmbedding,
    orgId,
    threshold,
    maxChunks
  )

  // ── Step 6: Score confidence ──────────────────────────────────────────────
  const confidence = calculateConfidence(matchedChunks)

  const sources: RAGSource[] = matchedChunks.map(c => ({
    title: c.source_title,
    url: c.source_url,
    similarity: parseFloat(c.similarity.toFixed(4)),
  }))

  // ── Step 7: No chunks or low confidence → ask user if they want handoff ──
  if (matchedChunks.length === 0 || confidence < HANDOFF_THRESHOLD) {
    return {
      type: 'ask_handoff',
      message: getOutOfScopeMessage(),
      confidence,
      sources,
    }
  }

  // ── Step 8: Build context + prompt ───────────────────────────────────────
  const context = buildContext(matchedChunks)
  const systemPrompt = buildSystemPrompt(context)

  // ── Step 9: Call GPT-4o-mini ─────────────────────────────────────────────
  const client = createOpenAIClient(openaiApiKey)

  const completion = await client.chat.completions.create({
    model: GPT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: trimmedQuery },
    ],
    max_tokens: 600,
    temperature: 0.3,
  })

  const answer = completion.choices[0]?.message?.content?.trim() ?? ''
  const tokensUsed = completion.usage?.total_tokens

  // ── Step 10: Model said OUT_OF_SCOPE → ask user ──────────────────────────
  if (!answer || answer === 'OUT_OF_SCOPE' || answer.includes('OUT_OF_SCOPE')) {
    return {
      type: 'ask_handoff',
      message: getOutOfScopeMessage(),
      confidence,
      sources,
      tokensUsed,
    }
  }

  return {
    type: 'answer',
    message: answer,
    confidence,
    sources,
    tokensUsed,
  }
}
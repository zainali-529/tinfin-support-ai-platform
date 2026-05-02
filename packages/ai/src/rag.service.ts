import { getSupabaseAdmin } from './lib/supabase'
import { createOpenAIClient } from './providers/openai.provider'
import { generateEmbedding } from './embeddings.service'
import {
  buildGuidancePrompt,
  buildOrganizationPrompt,
  classifyAIIntent,
  fetchPinnedCompanyChunks,
  getOrganizationAIContext,
  recordAIAnswerTrace,
  rewriteQueryForIntent,
  type AIContextBundle,
  type AIIntentResult,
} from './identity.service'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SEARCH_THRESHOLD = 0.25
const KB_RELEVANCE_THRESHOLD = 0.38
const DEFAULT_MAX_CHUNKS = 6
const GPT_MODEL = 'gpt-4o-mini'
const KB_SCOPE_SEARCH_FACTOR = 8
const KB_SCOPE_MIN_COUNT = 50
const KB_SCOPE_MAX_COUNT = 200
const LEXICAL_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'about',
  'can',
  'do',
  'does',
  'for',
  'hai',
  'hain',
  'hota',
  'hoti',
  'hotay',
  'hote',
  'how',
  'is',
  'ka',
  'ke',
  'ki',
  'kya',
  'kia',
  'me',
  'mein',
  'of',
  'on',
  'tell',
  'the',
  'this',
  'to',
  'what',
  'who',
  'why',
  'you',
  'your',
])
const TOKEN_SYNONYMS: Record<string, string[]> = {
  pricing: ['pricing', 'price', 'prices', 'cost', 'charges', 'plan', 'plans', 'billing', 'subscription'],
  price: ['pricing', 'price', 'prices', 'cost', 'charges', 'plan', 'plans', 'billing', 'subscription'],
  cost: ['pricing', 'price', 'prices', 'cost', 'charges', 'plan', 'plans', 'billing', 'subscription'],
  refund: ['refund', 'return', 'reimbursement'],
  returns: ['return', 'returns', 'refund'],
  issue: ['issue', 'problem', 'error', 'bug', 'trouble'],
  problem: ['issue', 'problem', 'error', 'bug', 'trouble'],
}
const COMPANY_IDENTITY_INTENTS = new Set<AIIntentResult['intent']>([
  'company_identity',
  'product_overview',
])

function canUsePinnedCompanyContext(intentResult: AIIntentResult): boolean {
  return COMPANY_IDENTITY_INTENTS.has(intentResult.intent)
}

function requiresGroundedEvidence(intentResult: AIIntentResult): boolean {
  return !['small_talk', 'human_handoff'].includes(intentResult.intent)
}

function isRomanUrduLike(intentResult: AIIntentResult): boolean {
  return intentResult.languageHint === 'roman_urdu' || intentResult.languageHint === 'mixed'
}

function buildGroundedNoAnswerMessage(
  aiContext: AIContextBundle,
  intentResult: AIIntentResult
): string {
  const companyName = aiContext.profile.companyName

  if (isRomanUrduLike(intentResult)) {
    if (intentResult.intent === 'out_of_scope') {
      return `Mere paas is topic ke bare mein verified information available nahi hai. Main ${companyName}-related questions mein help kar sakta hoon.`
    }

    return `Mere paas is sawal ka verified answer available nahi hai. Agar aap chahen to main aapko human agent se connect kar sakta hoon. (Reply **yes** to connect)`
  }

  if (intentResult.intent === 'out_of_scope') {
    return `I don't have verified information about that topic. I can help with ${companyName}-related questions.`
  }

  return `I don't have verified information for that question right now. Would you like me to connect you with a human agent who can help further? (Reply **yes** to connect)`
}

function extractSalientTokens(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? []

  return [...new Set(tokens.filter((token) =>
    token.length >= 3 &&
    !LEXICAL_STOP_WORDS.has(token) &&
    !/^\d+$/.test(token)
  ))].slice(0, 8)
}

function expandToken(token: string): string[] {
  return TOKEN_SYNONYMS[token] ?? [token]
}

function hasLexicalEvidence(query: string, chunks: MatchedChunk[]): boolean {
  const tokens = extractSalientTokens(query)
  if (tokens.length === 0) return true
  if (chunks.length === 0) return false

  const haystack = chunks
    .map((chunk) => chunk.content)
    .join('\n')
    .toLowerCase()
  const hits = tokens.filter((token) =>
    expandToken(token).some((candidate) => haystack.includes(candidate))
  )

  if (tokens.length <= 2) return hits.length === tokens.length
  return hits.length / tokens.length >= 0.5
}

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

function dedupeChunks(chunks: MatchedChunk[]): MatchedChunk[] {
  const seen = new Set<string>()
  const output: MatchedChunk[] = []

  for (const chunk of chunks) {
    const key = chunk.id || `${chunk.source_title ?? ''}:${chunk.content.slice(0, 80)}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(chunk)
  }

  return output
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
  hasStrongContext: boolean,
  aiContext: AIContextBundle,
  intentResult: AIIntentResult
): string {
  const kbSection = context
    ? `## Knowledge Base Context\n${context}`
    : `## Knowledge Base Context\n(No relevant articles found for this specific query)`
  const organizationSection = buildOrganizationPrompt(aiContext)
  const guidanceSection = buildGuidancePrompt(aiContext.guidance)

  return `You are a professional, intelligent, and warm customer support assistant.

${organizationSection}

Your factual answers must come from the organization identity, guidance, and knowledge context provided below. You do not have access to external information, the internet, or unsupported knowledge.
Organization Identity is only grounding for questions about this organization, your role, or what this organization offers. It is not evidence for third-party products, companies, definitions, coding questions, world facts, or general knowledge.

${kbSection}

${topicsHint ? `## Topics You Have Knowledge On\n${topicsHint}\n` : ''}

${guidanceSection ? `${guidanceSection}\n` : ''}

## Detected Customer Intent
Intent: ${intentResult.intent}
Language hint: ${intentResult.languageHint}

---

## Response Guidelines

**For greetings, pleasantries, or "how are you" type messages:**
Respond naturally and warmly, as a knowledgeable human assistant would. Briefly introduce what you can help with based on the topics above. Do not be robotic. Keep it natural and inviting.

**For questions about your capabilities ("what can you do", "what do you help with"):**
Explain specifically what topics and information you have available, derived from the knowledge base above. Be specific — tell them exactly what you know, not vague platitudes.

**For domain-specific questions answerable from the knowledge base:**
Answer accurately and professionally using ONLY the knowledge base context provided. Be thorough, clear, and naturally appreciative where appropriate. Never fabricate facts, prices, features, or policies not present in the context. Match the user's language.

**For company identity questions ("tell me about your company", "who are you", "what do you do", "aapki company kya karti hai"):**
Answer directly as ${aiContext.profile.companyName}'s assistant. Use the Organization Identity and any company profile context. Do not ask "which company?" unless the user clearly names a different third-party company and asks about that company.

**For definition/general-knowledge questions ("what is X", "who is X", "X kya hai") that are not clearly about ${aiContext.profile.companyName}:**
Respond with exactly this token and nothing else: OUT_OF_DOMAIN

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
6. Keep responses concise but complete: 2-4 sentences for simple queries, more detail for complex ones.
7. Put the direct answer first. Use bullets or numbered steps only when they improve clarity.`.trim()
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
    conversationId,
    messageId,
    channel = 'chat',
    threshold = DEFAULT_SEARCH_THRESHOLD,
    maxChunks = DEFAULT_MAX_CHUNKS,
    openaiApiKey,
  } = params

  const startedAt = Date.now()
  const trimmedQuery = query.trim()
  const client = createOpenAIClient(openaiApiKey)
  const aiContext = await getOrganizationAIContext(orgId)
  const intentResult = classifyAIIntent(trimmedQuery)
  const rewrittenQuery = rewriteQueryForIntent(trimmedQuery, intentResult, aiContext.profile)
  const debugBase = {
    intent: intentResult.intent,
    rewrittenQuery,
    guidanceCount: aiContext.guidance.length,
  }

  async function finish(
    result: RAGResult,
    options: {
      usedPinnedCompanyContext?: boolean
      sourcesForTrace?: unknown[]
      tokensUsed?: number
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<RAGResult> {
    const debug = {
      ...debugBase,
      usedPinnedCompanyContext: options.usedPinnedCompanyContext === true,
    }
    const finalResult: RAGResult = { ...result, debug }

    await recordAIAnswerTrace({
      orgId,
      conversationId,
      messageId,
      channel,
      query: trimmedQuery || '(empty message)',
      detectedIntent: intentResult.intent,
      rewrittenQuery,
      responseType: result.type,
      responsePreview: result.message,
      sourcesUsed: options.sourcesForTrace ?? result.sources,
      guidanceUsed: aiContext.guidance.map((rule) => ({
        id: rule.id,
        name: rule.name,
        category: rule.category,
      })),
      confidence: result.confidence,
      latencyMs: Date.now() - startedAt,
      tokensUsed: options.tokensUsed ?? result.tokensUsed ?? 0,
      model: GPT_MODEL,
      metadata: {
        languageHint: intentResult.languageHint,
        intentConfidence: intentResult.confidence,
        ...options.metadata,
      },
    })

    return finalResult
  }

  if (!trimmedQuery) {
    const { text, tokens } = await generateContextualResponse(
      client,
      `${buildOrganizationPrompt(aiContext)}

The user just opened the chat. Greet them warmly as ${aiContext.profile.companyName}'s assistant and ask how you can help. Keep it to 1-2 sentences, natural and inviting.`,
      '(user opened the chat)',
      100,
      0.7
    )

    return finish({
      type: 'casual',
      message: text || `Hello! I'm ${aiContext.profile.assistantName} for ${aiContext.profile.companyName}. How can I help you today?`,
      confidence: 1,
      sources: [],
      tokensUsed: tokens,
    }, { tokensUsed: tokens })
  }

  if (isExplicitHumanRequest(trimmedQuery)) {
    const { text, tokens } = await generateContextualResponse(
      client,
      'The user wants to speak to a human agent. Respond warmly and professionally, confirming you are connecting them now. Be reassuring and brief: 1-2 sentences.',
      trimmedQuery,
      100,
      0.5
    )

    return finish({
      type: 'handoff',
      message: text || 'Of course. Let me connect you with a human agent right away. Please hold on for a moment.',
      confidence: 1,
      sources: [],
      tokensUsed: tokens,
    }, { tokensUsed: tokens })
  }

  const searchQuery = rewrittenQuery || trimmedQuery
  const queryEmbedding = await generateEmbedding(searchQuery, openaiApiKey)

  const semanticChunks = await searchSimilarChunks(
    queryEmbedding,
    orgId,
    threshold,
    maxChunks,
    kbId
  )

  const allowPinnedCompanyContext = canUsePinnedCompanyContext(intentResult)
  const pinnedCompanyChunks = allowPinnedCompanyContext
    ? await fetchPinnedCompanyChunks({ orgId, kbId, limit: 4 })
    : []
  const usedPinnedCompanyContext = pinnedCompanyChunks.length > 0
  const matchedChunks = dedupeChunks([
    ...(pinnedCompanyChunks as MatchedChunk[]),
    ...semanticChunks,
  ]).slice(0, Math.max(maxChunks, pinnedCompanyChunks.length + maxChunks))

  const semanticConfidence = calculateConfidence(semanticChunks)
  const lexicalEvidence = hasLexicalEvidence(trimmedQuery, semanticChunks)
  const semanticHasStrongEvidence = semanticConfidence >= KB_RELEVANCE_THRESHOLD && lexicalEvidence
  const identityProfileConfidence =
    allowPinnedCompanyContext && (usedPinnedCompanyContext || Boolean(aiContext.profile.companySummary))
      ? 0.86
      : 0
  const confidence = Math.max(
    semanticHasStrongEvidence ? semanticConfidence : 0,
    identityProfileConfidence
  )
  const hasStrongContext =
    semanticHasStrongEvidence ||
    identityProfileConfidence > 0

  const sources: RAGSource[] = matchedChunks.map((chunk) => ({
    title: chunk.source_title,
    url: chunk.source_url,
    similarity: Number.parseFloat(chunk.similarity.toFixed(4)),
    sourceType:
      typeof chunk.metadata?.sourceType === 'string'
        ? chunk.metadata.sourceType
        : null,
    pinned: chunk.metadata?.pinned === true,
  }))

  const context = buildContext(matchedChunks)
  const topicsHint = deriveTopicsHint(matchedChunks)

  if (requiresGroundedEvidence(intentResult) && !hasStrongContext) {
    const message = buildGroundedNoAnswerMessage(aiContext, intentResult)

    return finish({
      type: intentResult.intent === 'out_of_scope' ? 'casual' : 'ask_handoff',
      message,
      confidence,
      sources: [],
      tokensUsed: 0,
    }, {
      usedPinnedCompanyContext,
      sourcesForTrace: sources,
      tokensUsed: 0,
      metadata: {
        searchQuery,
        semanticConfidence,
        lexicalEvidence,
        groundedGate: 'blocked_without_strong_context',
      },
    })
  }

  const systemPrompt = buildMasterPrompt(
    context,
    topicsHint,
    hasStrongContext,
    aiContext,
    intentResult
  )

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

  if (!rawAnswer || rawAnswer === 'OUT_OF_SCOPE' || rawAnswer.includes('OUT_OF_SCOPE')) {
    const message = buildGroundedNoAnswerMessage(aiContext, intentResult)

    return finish({
      type: 'ask_handoff',
      message,
      confidence,
      sources,
      tokensUsed: mainTokens,
    }, {
      usedPinnedCompanyContext,
      sourcesForTrace: sources,
      tokensUsed: mainTokens,
      metadata: { searchQuery, rawAnswer: rawAnswer || null },
    })
  }

  if (rawAnswer === 'OUT_OF_DOMAIN' || rawAnswer.includes('OUT_OF_DOMAIN')) {
    const message = buildGroundedNoAnswerMessage(aiContext, {
      ...intentResult,
      intent: 'out_of_scope',
    })

    return finish({
      type: 'casual',
      message,
      confidence: 0,
      sources: [],
      tokensUsed: mainTokens,
    }, {
      usedPinnedCompanyContext,
      tokensUsed: mainTokens,
      metadata: { searchQuery, rawAnswer },
    })
  }

  return finish({
    type: hasStrongContext ? 'answer' : 'casual',
    message: rawAnswer,
    confidence,
    sources,
    tokensUsed: mainTokens,
  }, {
    usedPinnedCompanyContext,
    sourcesForTrace: sources,
    tokensUsed: mainTokens,
    metadata: { searchQuery, semanticConfidence, lexicalEvidence },
  })
}

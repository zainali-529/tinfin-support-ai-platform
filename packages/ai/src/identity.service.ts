import { getSupabaseAdmin } from './lib/supabase'

export type AIIntent =
  | 'company_identity'
  | 'product_overview'
  | 'pricing'
  | 'support_policy'
  | 'technical_issue'
  | 'account_action'
  | 'human_handoff'
  | 'small_talk'
  | 'out_of_scope'
  | 'general_support'

export interface OrganizationAIProfile {
  orgId: string
  assistantName: string
  companyName: string
  companySummary: string | null
  websiteUrl: string | null
  industry: string | null
  targetCustomers: string | null
  valueProposition: string | null
  supportScope: string | null
  outOfScope: string | null
  brandVoice: string
  defaultLanguage: string
  formattingStyle: string
  handoffPolicy: string | null
  forbiddenPhrases: string[]
  goodAnswerExamples: string[]
  badAnswerExamples: string[]
}

export interface AIGuidanceRule {
  id: string
  name: string
  category: string
  conditionText: string | null
  guidanceText: string
  channel: string
  priority: number
}

export interface AIContextBundle {
  profile: OrganizationAIProfile
  guidance: AIGuidanceRule[]
}

export interface AIIntentResult {
  intent: AIIntent
  confidence: number
  languageHint: 'english' | 'roman_urdu' | 'mixed' | 'unknown'
  shouldUseCompanyIdentity: boolean
}

export interface PinnedCompanyChunk {
  id: string
  kb_id?: string | null
  content: string
  source_url: string | null
  source_title: string | null
  metadata: Record<string, unknown>
  similarity: number
}

export interface AITraceInput {
  orgId: string
  conversationId?: string | null
  messageId?: string | null
  channel?: string
  query: string
  detectedIntent: AIIntent | string
  rewrittenQuery?: string | null
  responseType: string
  responsePreview?: string | null
  sourcesUsed?: unknown[]
  guidanceUsed?: unknown[]
  actionsUsed?: unknown[]
  confidence?: number
  latencyMs?: number
  tokensUsed?: number
  model?: string | null
  metadata?: Record<string, unknown>
}

export interface DefaultEvalCase {
  name: string
  inputMessage: string
  expectedIntent: AIIntent
  expectedContains: string[]
  forbiddenContains: string[]
  requiredSourceType?: string | null
  language: string
  channel: string
}

const MISSING_RELATION_CODES = new Set(['42P01', '42703'])

export const DEFAULT_AI_IDENTITY_EVAL_CASES: DefaultEvalCase[] = [
  {
    name: 'Company intro - English',
    inputMessage: 'Tell me about your company',
    expectedIntent: 'company_identity',
    expectedContains: [],
    forbiddenContains: ['which company', 'what company', 'kaunsi company'],
    requiredSourceType: 'company_profile',
    language: 'english',
    channel: 'chat',
  },
  {
    name: 'Who are you - English',
    inputMessage: 'Who are you?',
    expectedIntent: 'company_identity',
    expectedContains: [],
    forbiddenContains: ['which company', 'what company', 'i am an ai language model'],
    requiredSourceType: 'company_profile',
    language: 'english',
    channel: 'chat',
  },
  {
    name: 'Product overview - English',
    inputMessage: 'What do you do?',
    expectedIntent: 'product_overview',
    expectedContains: [],
    forbiddenContains: ['which company', 'what company'],
    requiredSourceType: 'company_profile',
    language: 'english',
    channel: 'chat',
  },
  {
    name: 'Company intro - Roman Urdu',
    inputMessage: 'Aapki company kya karti hai?',
    expectedIntent: 'company_identity',
    expectedContains: [],
    forbiddenContains: ['kaunsi company', 'which company'],
    requiredSourceType: 'company_profile',
    language: 'roman_urdu',
    channel: 'chat',
  },
  {
    name: 'Mixed language company intro',
    inputMessage: 'Tell me apni company ke bare mein',
    expectedIntent: 'company_identity',
    expectedContains: [],
    forbiddenContains: ['kaunsi company', 'which company'],
    requiredSourceType: 'company_profile',
    language: 'mixed',
    channel: 'chat',
  },
]

function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code && MISSING_RELATION_CODES.has(error.code)) return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('does not exist') || message.includes('column') || message.includes('schema cache')
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item))
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s?]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasAnyPattern(input: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(input))
}

function detectLanguageHint(input: string): AIIntentResult['languageHint'] {
  const normalized = normalizeText(input)
  const romanUrduSignals = [
    /\b(aap|ap|tum|tumhara|aapki|apki|hamari|humari|kya|kia|kaise|kesay|bare|baare|mein|me|btao|batao|karay|karte|karti)\b/,
  ]
  const englishSignals = [/\b(tell|what|who|how|company|business|support|pricing|features)\b/]
  const hasRomanUrdu = hasAnyPattern(normalized, romanUrduSignals)
  const hasEnglish = hasAnyPattern(normalized, englishSignals)

  if (hasRomanUrdu && hasEnglish) return 'mixed'
  if (hasRomanUrdu) return 'roman_urdu'
  if (hasEnglish) return 'english'
  return 'unknown'
}

export function classifyAIIntent(query: string): AIIntentResult {
  const normalized = normalizeText(query)
  const languageHint = detectLanguageHint(query)

  if (!normalized) {
    return {
      intent: 'small_talk',
      confidence: 0.9,
      languageHint,
      shouldUseCompanyIdentity: false,
    }
  }

  if (
    hasAnyPattern(normalized, [
      /\b(human|agent|representative|real person|support person)\b/,
      /\b(connect|transfer|handoff|talk|speak)\s+(me\s+)?(to|with)\b/,
      /\b(insan|banday|bande|agent se|support se)\b/,
    ])
  ) {
    return {
      intent: 'human_handoff',
      confidence: 0.95,
      languageHint,
      shouldUseCompanyIdentity: false,
    }
  }

  if (
    hasAnyPattern(normalized, [
      /\b(hi|hello|hey|salam|assalam|aoa|good morning|good evening)\b/,
      /\b(how are you|kaise ho|kesay ho)\b/,
    ]) &&
    normalized.split(' ').length <= 6
  ) {
    return {
      intent: 'small_talk',
      confidence: 0.85,
      languageHint,
      shouldUseCompanyIdentity: false,
    }
  }

  const identityPatterns = [
    /\btell me about (your|the|this|our) (company|business|organization|organisation|team)\b/,
    /\btell me about you(rself)?\b/,
    /\b(about your company|about your business|about your organization|about you)\b/,
    /\b(who are you|what are you)\b/,
    /\b(what does your company do|what do you do|what do you offer)\b/,
    /\b(your company|your business|your organization|your team)\b/,
    /\b(aapki|apki|tumhari|hamari|humari|apni) (company|business|organization|organisation|team)\b/,
    /\b(company|business|organization|organisation) (ke|kay)?\s*(bare|baare)\b/,
    /\b(tum log|aap log|ap log|aap sab|ap sab) (kya|kia) (karte|kartay|karti|provide|offer)\b/,
    /\b(kya|kia) (karte|kartay|karti) (ho|hain|hai)\b/,
  ]

  if (hasAnyPattern(normalized, identityPatterns)) {
    const productOverview =
      /\b(what do you do|what do you offer|features|services|platform|product)\b/.test(normalized) ||
      /\b(kya|kia) (provide|offer|karte|kartay|karti)\b/.test(normalized)

    return {
      intent: productOverview ? 'product_overview' : 'company_identity',
      confidence: 0.92,
      languageHint,
      shouldUseCompanyIdentity: true,
    }
  }

  if (hasAnyPattern(normalized, [/\b(price|pricing|cost|plan|subscription|billing)\b/, /\b(qeemat|price|kitna|charges)\b/])) {
    return {
      intent: 'pricing',
      confidence: 0.82,
      languageHint,
      shouldUseCompanyIdentity: true,
    }
  }

  if (hasAnyPattern(normalized, [/\b(refund|return|policy|sla|support hours|shipping)\b/, /\b(policy|refund|return|warranty)\b/])) {
    return {
      intent: 'support_policy',
      confidence: 0.8,
      languageHint,
      shouldUseCompanyIdentity: true,
    }
  }

  if (hasAnyPattern(normalized, [/\b(error|bug|broken|not working|issue|problem|fix|setup|install)\b/, /\b(masla|issue|problem|nahi chal|nai chal)\b/])) {
    return {
      intent: 'technical_issue',
      confidence: 0.78,
      languageHint,
      shouldUseCompanyIdentity: true,
    }
  }

  if (hasAnyPattern(normalized, [/\b(cancel|update|change|book|order|account|subscription|appointment)\b/])) {
    return {
      intent: 'account_action',
      confidence: 0.76,
      languageHint,
      shouldUseCompanyIdentity: true,
    }
  }

  return {
    intent: 'general_support',
    confidence: 0.55,
    languageHint,
    shouldUseCompanyIdentity: true,
  }
}

export function rewriteQueryForIntent(
  query: string,
  intentResult: AIIntentResult,
  profile: OrganizationAIProfile
): string {
  const companyName = profile.companyName || 'this company'
  const summary = profile.companySummary ? ` Summary: ${profile.companySummary}` : ''
  const scope = profile.supportScope ? ` Support scope: ${profile.supportScope}` : ''

  if (intentResult.intent === 'company_identity') {
    return [
      `Explain ${companyName}'s company overview as the official support assistant.`,
      'Include what the company does, who it helps, and the value proposition.',
      'Do not ask which company; the customer means the current organization.',
      `Original customer question: ${query}`,
      summary,
      scope,
    ].filter(Boolean).join(' ')
  }

  if (intentResult.intent === 'product_overview') {
    return [
      `Explain what ${companyName} offers, its main product/service capabilities, and how it helps customers.`,
      `Original customer question: ${query}`,
      summary,
      scope,
    ].filter(Boolean).join(' ')
  }

  if (intentResult.intent === 'pricing') {
    return `Find pricing, plans, billing, trial, or subscription information for ${companyName}. Original question: ${query}`
  }

  if (intentResult.intent === 'support_policy') {
    return `Find official support, policy, SLA, refund, return, shipping, or process information for ${companyName}. Original question: ${query}`
  }

  return query
}

export function buildOrganizationPrompt(context: AIContextBundle): string {
  const { profile } = context
  const rows = [
    `Assistant name: ${profile.assistantName}`,
    `Company represented: ${profile.companyName}`,
    profile.companySummary ? `Company summary: ${profile.companySummary}` : null,
    profile.websiteUrl ? `Website: ${profile.websiteUrl}` : null,
    profile.industry ? `Industry: ${profile.industry}` : null,
    profile.targetCustomers ? `Target customers: ${profile.targetCustomers}` : null,
    profile.valueProposition ? `Value proposition: ${profile.valueProposition}` : null,
    profile.supportScope ? `Support scope: ${profile.supportScope}` : null,
    profile.outOfScope ? `Out-of-scope topics: ${profile.outOfScope}` : null,
    `Brand voice: ${profile.brandVoice}`,
    `Default language behavior: ${profile.defaultLanguage}`,
    `Formatting style: ${profile.formattingStyle}`,
    profile.handoffPolicy ? `Human handoff policy: ${profile.handoffPolicy}` : null,
  ].filter((row): row is string => Boolean(row))

  const forbidden =
    profile.forbiddenPhrases.length > 0
      ? `Forbidden phrases: ${profile.forbiddenPhrases.join('; ')}`
      : null

  return `## Organization Identity
You are ${profile.assistantName}, the official customer support assistant for ${profile.companyName}.
When the customer says "you", "your company", "your business", "your team", "aapki company", "apni company", or "tum log", they mean ${profile.companyName}. Do not ask "which company?" when this organization identity is available.

${rows.join('\n')}
${forbidden ? `\n${forbidden}` : ''}

If a visitor asks who you are or what your company does, answer directly as ${profile.companyName}'s assistant using the company profile and available knowledge.`
}

export function buildGuidancePrompt(guidance: AIGuidanceRule[]): string {
  if (guidance.length === 0) return ''

  const lines = guidance
    .slice(0, 12)
    .map((rule, index) => {
      const condition = rule.conditionText ? ` When: ${rule.conditionText}` : ''
      return `${index + 1}. [${rule.category}/${rule.channel}] ${rule.guidanceText}${condition}`
    })
    .join('\n')

  return `## Active AI Guidance
Follow these organization-specific guidance rules when relevant:
${lines}`
}

export async function getOrganizationAIContext(orgId: string): Promise<AIContextBundle> {
  const supabase = getSupabaseAdmin()

  const [orgResult, widgetResult, profileResult, guidanceResult] = await Promise.all([
    supabase.from('organizations').select('id, name, settings').eq('id', orgId).maybeSingle(),
    supabase.from('widget_configs').select('company_name, welcome_message').eq('org_id', orgId).maybeSingle(),
    supabase.from('organization_ai_profiles').select('*').eq('org_id', orgId).maybeSingle(),
    supabase
      .from('ai_guidance_rules')
      .select('id, name, category, condition_text, guidance_text, channel, priority')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(20),
  ])

  const org = asRecord(orgResult.data)
  const widget = asRecord(widgetResult.data)
  const rawProfile = isMissingRelation(profileResult.error) ? {} : asRecord(profileResult.data)
  const companyName =
    asString(rawProfile.company_name) ??
    asString(widget.company_name) ??
    asString(org.name) ??
    'this company'

  const profile: OrganizationAIProfile = {
    orgId,
    assistantName: asString(rawProfile.assistant_name) ?? 'Support Assistant',
    companyName,
    companySummary: asString(rawProfile.company_summary),
    websiteUrl: asString(rawProfile.website_url),
    industry: asString(rawProfile.industry),
    targetCustomers: asString(rawProfile.target_customers),
    valueProposition: asString(rawProfile.value_proposition),
    supportScope: asString(rawProfile.support_scope),
    outOfScope: asString(rawProfile.out_of_scope),
    brandVoice: asString(rawProfile.brand_voice) ?? 'warm, clear, professional, concise',
    defaultLanguage: asString(rawProfile.default_language) ?? 'auto',
    formattingStyle:
      asString(rawProfile.formatting_style) ?? 'direct answer first, bullets when helpful',
    handoffPolicy: asString(rawProfile.handoff_policy),
    forbiddenPhrases: asStringArray(rawProfile.forbidden_phrases),
    goodAnswerExamples: asStringArray(rawProfile.good_answer_examples),
    badAnswerExamples: asStringArray(rawProfile.bad_answer_examples),
  }

  const guidanceRows =
    guidanceResult.error && isMissingRelation(guidanceResult.error)
      ? []
      : ((guidanceResult.data ?? []) as Record<string, unknown>[])

  const guidance: AIGuidanceRule[] = guidanceRows.map((row) => ({
    id: String(row.id ?? ''),
    name: asString(row.name) ?? 'Guidance',
    category: asString(row.category) ?? 'general',
    conditionText: asString(row.condition_text),
    guidanceText: asString(row.guidance_text) ?? '',
    channel: asString(row.channel) ?? 'all',
    priority: asNumber(row.priority, 100),
  })).filter((row) => row.id && row.guidanceText)

  return { profile, guidance }
}

export async function fetchPinnedCompanyChunks(params: {
  orgId: string
  kbId?: string
  limit?: number
}): Promise<PinnedCompanyChunk[]> {
  const { orgId, kbId, limit = 4 } = params
  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('kb_chunks')
    .select('id, kb_id, content, source_url, source_title, metadata, source_type, is_pinned, created_at')
    .eq('org_id', orgId)
    .or('source_type.eq.company_profile,is_pinned.eq.true')

  if (kbId) query = query.eq('kb_id', kbId)

  const result = await query.limit(Math.max(limit * 3, limit))

  if (result.error && isMissingRelation(result.error)) {
    let fallback = supabase
      .from('kb_chunks')
      .select('id, kb_id, content, source_url, source_title, metadata, created_at')
      .eq('org_id', orgId)
      .contains('metadata', { sourceType: 'company_profile' })

    if (kbId) fallback = fallback.eq('kb_id', kbId)
    const fallbackResult = await fallback.limit(limit)
    if (fallbackResult.error) return []
    return normalizePinnedChunks(fallbackResult.data ?? [], limit)
  }

  if (result.error) {
    console.warn('[ai-identity] Failed to fetch pinned company chunks:', result.error.message)
    return []
  }

  return normalizePinnedChunks(result.data ?? [], limit)
}

function normalizePinnedChunks(rows: unknown[], limit: number): PinnedCompanyChunk[] {
  return rows
    .map((raw) => {
      const row = asRecord(raw)
      const metadata = asRecord(row.metadata)
      return {
        id: String(row.id ?? ''),
        kb_id: asString(row.kb_id),
        content: asString(row.content) ?? '',
        source_url: asString(row.source_url),
        source_title: asString(row.source_title) ?? 'Company Profile',
        metadata: {
          ...metadata,
          sourceType: asString(row.source_type) ?? asString(metadata.sourceType) ?? 'company_profile',
          pinned: row.is_pinned === true || metadata.pinned === true,
        },
        similarity: row.is_pinned === true ? 1 : 0.98,
      }
    })
    .filter((row) => row.id && row.content)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit)
}

export async function recordAIAnswerTrace(input: AITraceInput): Promise<void> {
  try {
    if (!input.orgId || !input.query.trim()) return

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('ai_answer_traces').insert({
      org_id: input.orgId,
      conversation_id: input.conversationId ?? null,
      message_id: input.messageId ?? null,
      channel: input.channel ?? 'chat',
      query: input.query.slice(0, 4000),
      detected_intent: String(input.detectedIntent),
      rewritten_query: input.rewrittenQuery ? input.rewrittenQuery.slice(0, 4000) : null,
      response_type: input.responseType,
      response_preview: input.responsePreview ? input.responsePreview.slice(0, 1200) : null,
      sources_used: input.sourcesUsed ?? [],
      guidance_used: input.guidanceUsed ?? [],
      actions_used: input.actionsUsed ?? [],
      confidence: input.confidence ?? 0,
      latency_ms: Math.max(0, Math.round(input.latencyMs ?? 0)),
      tokens_used: Math.max(0, Math.round(input.tokensUsed ?? 0)),
      model: input.model ?? null,
      metadata: input.metadata ?? {},
    })

    if (error && !isMissingRelation(error)) {
      console.warn('[ai-identity] Failed to record answer trace:', error.message)
    }
  } catch (error) {
    console.warn(
      '[ai-identity] Failed to record answer trace:',
      error instanceof Error ? error.message : String(error)
    )
  }
}

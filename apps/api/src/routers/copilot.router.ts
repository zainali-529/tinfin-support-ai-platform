import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  generateAgentCopilot,
  getOrgActions,
  queryRAG,
  type AgentCopilotAction,
  type AgentCopilotMessage,
  type AgentCopilotMode,
  type AgentCopilotSimilarConversation,
  type AgentCopilotSource,
} from '@workspace/ai'
import { router, protectedProcedure } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'

const copilotModeSchema = z.enum([
  'draft_reply',
  'summarize',
  'rewrite',
  'translate',
  'next_action',
  'similar_conversations',
  'custom',
])

const runCopilotSchema = z.object({
  conversationId: z.string().uuid(),
  mode: copilotModeSchema,
  draft: z.string().max(8000).optional(),
  selectedText: z.string().max(8000).optional(),
  customQuestion: z.string().max(2000).optional(),
  targetTone: z.enum(['friendly', 'shorter', 'formal', 'clearer']).optional(),
  targetLanguage: z.string().trim().max(80).optional(),
})

type SupabaseClient = {
  from: (table: string) => any
}

type ConversationRow = {
  id: string
  org_id: string
  contact_id: string | null
  status: string
  channel: string
  started_at: string | null
  resolved_at: string | null
  contacts?: unknown
}

type ContactInfo = {
  name: string | null
  email: string | null
  phone: string | null
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'you',
  'your',
  'with',
  'that',
  'this',
  'from',
  'have',
  'need',
  'want',
  'can',
  'how',
  'what',
  'when',
  'where',
  'please',
  'about',
  'status',
  'order',
])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function contactFromJoin(value: unknown): ContactInfo {
  const row = Array.isArray(value) ? value[0] : value
  const contact = asRecord(row)
  return {
    name: asString(contact.name),
    email: asString(contact.email),
    phone: asString(contact.phone),
  }
}

function contactLabel(contact: ContactInfo): string {
  return contact.name || contact.email || contact.phone || 'Unknown customer'
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function compact(value: string | null | undefined, max = 1000): string {
  const text = value?.trim() ?? ''
  if (text.length <= max) return text
  return `${text.slice(0, max - 20).trim()}...`
}

function toMs(value: unknown): number {
  if (typeof value !== 'string') return 0
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function normalizeMessageRole(role: unknown): AgentCopilotMessage['role'] {
  if (role === 'user') return 'customer'
  if (role === 'agent') return 'agent'
  if (role === 'assistant') return 'assistant'
  return 'system'
}

function uniqueMessages(messages: AgentCopilotMessage[]): AgentCopilotMessage[] {
  const seen = new Set<string>()
  const output: AgentCopilotMessage[] = []

  for (const message of messages.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt))) {
    const key = [
      message.role,
      message.createdAt ?? '',
      message.content.slice(0, 160).toLowerCase(),
    ].join(':')
    if (seen.has(key)) continue
    seen.add(key)
    output.push(message)
  }

  return output.slice(-80)
}

function latestCustomerMessage(messages: AgentCopilotMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === 'customer' && message.content.trim()) return message.content.trim()
  }
  return null
}

function tokenize(value: string): Set<string> {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))

  return new Set(words.slice(0, 120))
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let overlap = 0
  for (const token of a) {
    if (b.has(token)) overlap += 1
  }
  return Number((overlap / Math.sqrt(a.size * b.size)).toFixed(3))
}

function focusText(params: {
  mode: AgentCopilotMode
  latestCustomer: string | null
  draft?: string | null
  selectedText?: string | null
  customQuestion?: string | null
}): string {
  if (params.mode === 'rewrite' || params.mode === 'translate') {
    return params.draft?.trim() || params.selectedText?.trim() || ''
  }

  if (params.mode === 'custom') {
    return params.customQuestion?.trim() || params.latestCustomer || ''
  }

  return params.latestCustomer || params.draft?.trim() || params.selectedText?.trim() || ''
}

async function loadConversation(params: {
  supabase: SupabaseClient
  orgId: string
  conversationId: string
}): Promise<ConversationRow> {
  const { data, error } = await params.supabase
    .from('conversations')
    .select('id, org_id, contact_id, status, channel, started_at, resolved_at, contacts(name, email, phone)')
    .eq('org_id', params.orgId)
    .eq('id', params.conversationId)
    .maybeSingle()

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load conversation for Copilot: ${error.message}`,
    })
  }

  if (!data) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
  }

  return data as ConversationRow
}

async function loadOrgName(params: { supabase: SupabaseClient; orgId: string }): Promise<string | null> {
  const [orgResult, widgetResult] = await Promise.all([
    params.supabase.from('organizations').select('name').eq('id', params.orgId).maybeSingle(),
    params.supabase.from('widget_configs').select('company_name').eq('org_id', params.orgId).maybeSingle(),
  ])

  return asString(widgetResult.data?.company_name) || asString(orgResult.data?.name)
}

async function loadConversationMessages(params: {
  supabase: SupabaseClient
  orgId: string
  conversationId: string
  channel: string
}): Promise<AgentCopilotMessage[]> {
  const [chatResult, emailResult, whatsappResult] = await Promise.all([
    params.supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('org_id', params.orgId)
      .eq('conversation_id', params.conversationId)
      .order('created_at', { ascending: false })
      .limit(80),
    params.channel === 'email'
      ? params.supabase
        .from('email_messages')
        .select('direction, subject, text_body, html_body, created_at')
        .eq('org_id', params.orgId)
        .eq('conversation_id', params.conversationId)
        .order('created_at', { ascending: false })
        .limit(40)
      : Promise.resolve({ data: [], error: null }),
    params.channel === 'whatsapp'
      ? params.supabase
        .from('whatsapp_messages')
        .select('direction, content, created_at')
        .eq('org_id', params.orgId)
        .eq('conversation_id', params.conversationId)
        .order('created_at', { ascending: false })
        .limit(40)
      : Promise.resolve({ data: [], error: null }),
  ])

  const error = chatResult.error || emailResult.error || whatsappResult.error
  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to load conversation messages for Copilot: ${error.message}`,
    })
  }

  const messages: AgentCopilotMessage[] = []

  for (const row of chatResult.data ?? []) {
    const content = asString(row.content)
    if (!content) continue
    messages.push({
      role: normalizeMessageRole(row.role),
      content: compact(content, 2500),
      createdAt: row.created_at,
    })
  }

  for (const row of emailResult.data ?? []) {
    const body = asString(row.text_body) || (asString(row.html_body) ? stripHtml(String(row.html_body)) : '')
    const subject = asString(row.subject)
    const content = [subject ? `Subject: ${subject}` : null, body].filter(Boolean).join('\n')
    if (!content.trim()) continue
    messages.push({
      role: row.direction === 'inbound' ? 'customer' : 'agent',
      content: compact(content, 2500),
      createdAt: row.created_at,
    })
  }

  for (const row of whatsappResult.data ?? []) {
    const content = asString(row.content)
    if (!content) continue
    messages.push({
      role: row.direction === 'inbound' ? 'customer' : 'agent',
      content: compact(content, 2500),
      createdAt: row.created_at,
    })
  }

  return uniqueMessages(messages)
}

async function loadSimilarResolvedConversations(params: {
  supabase: SupabaseClient
  orgId: string
  conversationId: string
  focus: string
}): Promise<AgentCopilotSimilarConversation[]> {
  const focusTokens = tokenize(params.focus)
  if (focusTokens.size === 0) return []

  const conversationsResult = await params.supabase
    .from('conversations')
    .select('id, channel, resolved_at, contacts(name, email, phone)')
    .eq('org_id', params.orgId)
    .in('status', ['resolved', 'closed'])
    .neq('id', params.conversationId)
    .order('resolved_at', { ascending: false, nullsFirst: false })
    .limit(120)

  if (conversationsResult.error) return []

  const rows = (conversationsResult.data ?? []) as ConversationRow[]
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return []

  const messagesResult = await params.supabase
    .from('messages')
    .select('conversation_id, role, content, created_at')
    .eq('org_id', params.orgId)
    .in('conversation_id', ids)
    .order('created_at', { ascending: true })
    .limit(1000)

  if (messagesResult.error) return []

  const grouped = new Map<string, Array<{ role: string; content: string; created_at: string }>>()
  for (const row of messagesResult.data ?? []) {
    const conversationId = asString(row.conversation_id)
    const content = asString(row.content)
    if (!conversationId || !content) continue
    const current = grouped.get(conversationId) ?? []
    current.push({
      role: asString(row.role) ?? 'system',
      content,
      created_at: asString(row.created_at) ?? '',
    })
    grouped.set(conversationId, current)
  }

  return rows
    .map((row) => {
      const messages = grouped.get(row.id) ?? []
      const searchable = messages.map((message) => message.content).join('\n')
      const score = overlapScore(focusTokens, tokenize(searchable))
      const finalAgentReply = [...messages].reverse().find((message) => message.role === 'agent' || message.role === 'assistant')
      const firstCustomer = messages.find((message) => message.role === 'user')
      const excerpt = [
        firstCustomer ? `Customer: ${compact(firstCustomer.content, 300)}` : null,
        finalAgentReply ? `Resolved reply: ${compact(finalAgentReply.content, 500)}` : null,
      ].filter(Boolean).join('\n')

      return {
        id: row.id,
        channel: row.channel,
        contactLabel: contactLabel(contactFromJoin(row.contacts)),
        resolvedAt: row.resolved_at,
        excerpt,
        score,
      }
    })
    .filter((item) => item.score >= 0.12 && item.excerpt.trim())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

async function loadVerifiedAnswer(params: {
  mode: AgentCopilotMode
  orgId: string
  conversationId: string
  channel: string
  focus: string
}): Promise<{
  answer: string | null
  answerType: string | null
  sources: AgentCopilotSource[]
  tokensUsed: number
}> {
  if (!params.focus || params.mode === 'rewrite' || params.mode === 'translate' || params.mode === 'summarize') {
    return { answer: null, answerType: null, sources: [], tokensUsed: 0 }
  }

  try {
    const result = await queryRAG({
      query: params.focus,
      orgId: params.orgId,
      conversationId: params.conversationId,
      channel: params.channel,
      maxChunks: 5,
    })

    return {
      answer: result.message,
      answerType: result.type,
      sources: result.sources.map((source) => ({
        title: source.title,
        url: source.url,
        similarity: source.similarity,
        sourceType: source.sourceType ?? null,
      })),
      tokensUsed: result.tokensUsed ?? 0,
    }
  } catch (error) {
    console.warn('[copilot] RAG context lookup failed:', error instanceof Error ? error.message : error)
    return { answer: null, answerType: null, sources: [], tokensUsed: 0 }
  }
}

function mapAction(action: Awaited<ReturnType<typeof getOrgActions>>[number]): AgentCopilotAction {
  return {
    id: action.id,
    name: action.name,
    displayName: action.displayName,
    description: action.description,
    category: action.category,
    requiresConfirmation: action.requiresConfirmation,
    humanApprovalRequired: action.humanApprovalRequired,
    parameters: action.parameters.map((parameter) => ({
      name: parameter.name,
      description: parameter.description,
      required: parameter.required,
    })),
  }
}

export const copilotRouter = router({
  run: protectedProcedure
    .input(runCopilotSchema)
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')

      if (!process.env.OPENAI_API_KEY) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'OpenAI API key is missing. Add OPENAI_API_KEY before using Agent Copilot.',
        })
      }

      const orgId = ctx.userOrgId
      const conversation = await loadConversation({
        supabase: ctx.supabase,
        orgId,
        conversationId: input.conversationId,
      })
      const contact = contactFromJoin(conversation.contacts)
      const [orgName, transcript, actions] = await Promise.all([
        loadOrgName({ supabase: ctx.supabase, orgId }),
        loadConversationMessages({
          supabase: ctx.supabase,
          orgId,
          conversationId: conversation.id,
          channel: conversation.channel,
        }),
        getOrgActions(orgId),
      ])
      const latestCustomer = latestCustomerMessage(transcript)
      const focus = focusText({
        mode: input.mode,
        latestCustomer,
        draft: input.draft,
        selectedText: input.selectedText,
        customQuestion: input.customQuestion,
      })
      const [verified, similarConversations] = await Promise.all([
        loadVerifiedAnswer({
          mode: input.mode,
          orgId,
          conversationId: conversation.id,
          channel: conversation.channel,
          focus,
        }),
        loadSimilarResolvedConversations({
          supabase: ctx.supabase,
          orgId,
          conversationId: conversation.id,
          focus,
        }),
      ])

      try {
        const result = await generateAgentCopilot({
          mode: input.mode,
          orgName,
          channel: conversation.channel,
          conversationStatus: conversation.status,
          customerName: contactLabel(contact),
          transcript,
          latestCustomerMessage: latestCustomer,
          draft: input.draft ?? null,
          selectedText: input.selectedText ?? null,
          customQuestion: input.customQuestion ?? null,
          targetTone: input.targetTone ?? null,
          targetLanguage: input.targetLanguage ?? null,
          verifiedAnswer: verified.answer,
          verifiedAnswerType: verified.answerType,
          sources: verified.sources,
          actions: actions.filter((action) => action.isActive).map(mapAction),
          similarConversations,
        })

        return {
          ...result,
          sources: verified.sources,
          similarConversations,
          generatedAt: new Date().toISOString(),
          tokensUsed: result.tokensUsed + verified.tokensUsed,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Agent Copilot failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    }),
})

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { ingestText, ingestUrl } from '@workspace/ai'
import { router, protectedProcedure } from '../trpc/trpc'
import { requireLimit } from '../lib/plan-guards'
import { requirePermissionFromContext } from '../lib/org-permissions'
import {
  assertKnowledgeBaseAccess,
  createIndexingSource,
  decorateDuplicateWarnings,
  deleteChunksForSource,
  getKbSource,
  normalizeSourceRow,
  updateSourceAfterIngest,
  uiSourceType,
} from '../services/knowledge-sources.service'

const sourceTypeInput = z.enum(['url', 'file', 'text']).optional()
const aiRatingInput = z.enum(['helpful', 'not_helpful'])
const LOW_CONFIDENCE_THRESHOLD = 0.45
const AI_IMPROVEMENTS_SCAN_LIMIT = 2000

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readAiSources(metadata: Record<string, unknown>): unknown[] {
  return Array.isArray(metadata.sources) ? metadata.sources : []
}

function readAnswerType(metadata: Record<string, unknown>): string | null {
  return asString(metadata.type) ?? asString(metadata.answerType)
}

function readAgentRating(metadata: Record<string, unknown>): 'helpful' | 'not_helpful' | null {
  const quality = asRecord(metadata.aiQuality)
  const rating = asString(quality.rating) ?? asString(metadata.agentRating)
  return rating === 'helpful' || rating === 'not_helpful' ? rating : null
}

function isNoVerifiedAnswer(metadata: Record<string, unknown>): boolean {
  const answerType = readAnswerType(metadata)
  if (metadata.noVerifiedAnswer === true) return true
  if (answerType === 'ask_handoff') return true

  const confidence = asNumber(metadata.confidence)
  if (confidence === null) return false

  return confidence < LOW_CONFIDENCE_THRESHOLD && readAiSources(metadata).length === 0
}

function isLowConfidenceAnswer(metadata: Record<string, unknown>): boolean {
  if (isNoVerifiedAnswer(metadata)) return true
  const confidence = asNumber(metadata.confidence)
  return confidence !== null && confidence < LOW_CONFIDENCE_THRESHOLD
}

function isHumanHandoff(metadata: Record<string, unknown>): boolean {
  const answerType = readAnswerType(metadata)
  return (
    answerType === 'handoff' ||
    answerType === 'ask_handoff' ||
    metadata.awaitingConfirm === true ||
    metadata.shouldHandoff === true
  )
}

function handoffReason(metadata: Record<string, unknown>): string {
  const explicit = asString(metadata.handoffReason) ?? asString(metadata.reason)
  if (explicit) return explicit
  if (readAnswerType(metadata) === 'ask_handoff') return 'No verified answer'
  if (metadata.awaitingConfirm === true) return 'AI asked to connect a human'
  if (metadata.shouldHandoff === true) return 'Human help requested'
  return 'Human handoff'
}

function normalizeQuestion(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncateText(value: string, max = 180): string {
  const clean = normalizeQuestion(value)
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}...`
}

function buildSuggestedKbDraft(question: string): { title: string; content: string } {
  const cleanQuestion = normalizeQuestion(question)
  return {
    title: `Answer: ${truncateText(cleanQuestion, 72)}`,
    content: [
      `Question: ${cleanQuestion}`,
      '',
      'Verified answer:',
      'Write the official answer here before saving this note.',
      '',
      'Support guidance:',
      '- Keep the answer short, factual, and customer-friendly.',
      '- Include any product limits, pricing, policy, or setup details that agents should use.',
      '- Remove this guidance section if it is not needed.',
    ].join('\n'),
  }
}

const TOPIC_STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'are',
  'can',
  'company',
  'could',
  'does',
  'for',
  'from',
  'have',
  'help',
  'how',
  'into',
  'your',
  'you',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'tell',
  'please',
  'need',
  'want',
  'this',
  'that',
  'the',
  'our',
  'who',
  'why',
  'is',
  'to',
  'in',
  'on',
  'of',
  'it',
])

function extractTopicCandidates(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !TOPIC_STOPWORDS.has(word))

  const topics = new Set<string>()
  for (let index = 0; index < words.length; index += 1) {
    topics.add(words[index]!)
    const next = words[index + 1]
    if (next) topics.add(`${words[index]} ${next}`)
  }

  return [...topics].slice(0, 8)
}

function asRawText(metadata: Record<string, unknown>): string | null {
  const value = metadata.rawText
  return typeof value === 'string' && value.trim() ? value : null
}

export const knowledgeRouter = router({
  getKnowledgeBases: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      const { data, error } = await ctx.supabase
        .from('knowledge_bases')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return data ?? []
    }),

  createKnowledgeBase: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(),
      name: z.string().min(1),
      sourceType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      const { count: kbCount } = await ctx.supabase
        .from('knowledge_bases')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
      await requireLimit(ctx.supabase, orgId, 'knowledgeBases', kbCount ?? 0)

      const { data, error } = await ctx.supabase
        .from('knowledge_bases')
        .insert({ org_id: orgId, name: input.name, source_type: input.sourceType })
        .select()
        .single()

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return data
    }),

  deleteKnowledgeBase: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      const { error } = await ctx.supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', input.id)
        .eq('org_id', orgId)

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return { success: true }
    }),

  getKnowledgeSources: protectedProcedure
    .input(z.object({ kbId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      await assertKnowledgeBaseAccess(ctx.supabase, orgId, input.kbId)

      const { data, error } = await ctx.supabase
        .from('kb_sources')
        .select('*')
        .eq('org_id', orgId)
        .eq('kb_id', input.kbId)
        .order('updated_at', { ascending: false })

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      const rows = decorateDuplicateWarnings((data ?? []).map((row: Record<string, unknown>) => normalizeSourceRow(row)))

      return rows.map((row) => ({
        ...row,
        type: uiSourceType(row.source_type),
      }))
    }),

  deleteKnowledgeSource: protectedProcedure
    .input(
      z.object({
        sourceId: z.string().uuid().optional(),
        kbId: z.string().uuid().optional(),
        sourceUrl: z.string().nullable().optional(),
        sourceTitle: z.string().nullable().optional(),
        type: sourceTypeInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      if (input.sourceId) {
        const source = await getKbSource(ctx.supabase, orgId, input.sourceId)
        await deleteChunksForSource(ctx.supabase, source)

        const { error } = await ctx.supabase
          .from('kb_sources')
          .delete()
          .eq('id', source.id)
          .eq('org_id', orgId)

        if (error) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to delete source: ${error.message}` })
        }

        return { success: true }
      }

      if (!input.kbId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Knowledge base or source ID is required.' })
      }

      await assertKnowledgeBaseAccess(ctx.supabase, orgId, input.kbId)

      const sourceUrl = input.sourceUrl?.trim() || null
      const sourceTitle = input.sourceTitle?.trim() || null

      if (!sourceUrl && !sourceTitle) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Source URL or title is required.',
        })
      }

      let query = ctx.supabase
        .from('kb_chunks')
        .delete()
        .eq('kb_id', input.kbId)
        .eq('org_id', orgId)

      if (sourceUrl) {
        query = query.eq('source_url', sourceUrl)
      } else {
        query = query.is('source_url', null).eq('source_title', sourceTitle)
      }

      if (input.type === 'url') {
        query = query.filter('metadata->>sourceType', 'eq', 'url')
      } else if (input.type === 'file') {
        query = query.filter('metadata->>sourceType', 'eq', 'file')
      } else if (input.type === 'text') {
        query = query.filter('metadata->>sourceType', 'eq', 'text_note')
      }

      const { error } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete source: ${error.message}`,
        })
      }

      return { success: true }
    }),

  reindexKnowledgeSource: protectedProcedure
    .input(z.object({ sourceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId
      const source = await getKbSource(ctx.supabase, orgId, input.sourceId)

      if (source.source_type === 'file') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Uploaded files cannot be re-indexed automatically yet. Delete and upload the file again.',
        })
      }

      await createIndexingSource(ctx.supabase, {
        orgId,
        kbId: source.kb_id,
        sourceType: source.source_type,
        sourceUrl: source.source_url,
        sourceTitle: source.source_title,
        metadata: source.metadata,
        existingSourceId: source.id,
      })

      await deleteChunksForSource(ctx.supabase, source)

      if (source.source_type === 'url') {
        if (!source.source_url) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'URL source is missing its URL.' })
        }

        const result = await ingestUrl({
          url: source.source_url,
          kbId: source.kb_id,
          orgId,
          sourceId: source.id,
        })

        await updateSourceAfterIngest(ctx.supabase, source, {
          success: result.success,
          chunksStored: result.chunksStored,
          error: result.error,
          sourceTitle: result.sourceTitle,
        }, { recrawledBy: ctx.user.id })

        return result
      }

      const rawText = asRawText(source.metadata)
      if (!rawText) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This text source cannot be re-indexed because the original text was not stored. Delete and add it again.',
        })
      }

      const result = await ingestText({
        content: rawText,
        title: source.source_title ?? undefined,
        kbId: source.kb_id,
        orgId,
        sourceId: source.id,
      })

      await updateSourceAfterIngest(ctx.supabase, source, {
        success: result.success,
        chunksStored: result.chunksStored,
        error: result.error,
        sourceTitle: result.sourceTitle,
        contentLength: rawText.length,
      }, { reindexedBy: ctx.user.id })

      return result
    }),

  getAiImprovements: protectedProcedure
    .input(z.object({
      days: z.number().int().min(1).max(180).default(30),
      limit: z.number().int().min(5).max(100).default(40),
    }).optional())
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId
      const days = input?.days ?? 30
      const limit = input?.limit ?? 40
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await ctx.supabase
        .from('messages')
        .select('id, conversation_id, role, content, ai_metadata, created_at')
        .eq('org_id', orgId)
        .in('role', ['user', 'assistant'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(AI_IMPROVEMENTS_SCAN_LIMIT)

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load AI improvement signals: ${error.message}`,
        })
      }

      const rows = ((data ?? []) as Array<{
        id: string
        conversation_id: string | null
        role: string
        content: string
        ai_metadata: Record<string, unknown> | null
        created_at: string
      }>).reverse()

      const lastUserByConversation = new Map<string, { id: string; content: string; createdAt: string }>()
      const candidateRows: Array<{
        id: string
        conversationId: string
        question: string
        questionMessageId: string | null
        answer: string
        answerType: string | null
        confidence: number | null
        sourcesCount: number
        noVerifiedAnswer: boolean
        lowConfidence: boolean
        humanHandoff: boolean
        handoffReason: string | null
        rating: 'helpful' | 'not_helpful' | null
        createdAt: string
        suggestedTitle: string
        suggestedNote: string
      }> = []

      for (const row of rows) {
        if (!row.conversation_id) continue

        if (row.role === 'user') {
          lastUserByConversation.set(row.conversation_id, {
            id: row.id,
            content: row.content,
            createdAt: row.created_at,
          })
          continue
        }

        if (row.role !== 'assistant' || !row.ai_metadata) continue

        const metadata = asRecord(row.ai_metadata)
        const noVerifiedAnswer = isNoVerifiedAnswer(metadata)
        const lowConfidence = isLowConfidenceAnswer(metadata)
        const humanHandoff = isHumanHandoff(metadata)
        const rating = readAgentRating(metadata)

        if (!noVerifiedAnswer && !lowConfidence && !humanHandoff && rating !== 'not_helpful') continue

        const questionRow = lastUserByConversation.get(row.conversation_id)
        const question = questionRow?.content ?? 'Customer question unavailable'
        const draft = buildSuggestedKbDraft(question)

        candidateRows.push({
          id: row.id,
          conversationId: row.conversation_id,
          question: truncateText(question, 500),
          questionMessageId: questionRow?.id ?? null,
          answer: truncateText(row.content, 700),
          answerType: readAnswerType(metadata),
          confidence: asNumber(metadata.confidence),
          sourcesCount: readAiSources(metadata).length,
          noVerifiedAnswer,
          lowConfidence,
          humanHandoff,
          handoffReason: humanHandoff ? handoffReason(metadata) : null,
          rating,
          createdAt: row.created_at,
          suggestedTitle: draft.title,
          suggestedNote: draft.content,
        })
      }

      candidateRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const limitedCandidates = candidateRows.slice(0, limit)
      const conversationIds = [...new Set(limitedCandidates.map((item) => item.conversationId))]

      const conversationsById = new Map<string, {
        id: string
        channel: string
        status: string
        contactName: string | null
        contactValue: string | null
      }>()

      if (conversationIds.length > 0) {
        const conversationsResult = await ctx.supabase
          .from('conversations')
          .select('id, channel, status, contacts(name, email, phone)')
          .eq('org_id', orgId)
          .in('id', conversationIds)

        if (conversationsResult.error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to load improvement conversations: ${conversationsResult.error.message}`,
          })
        }

        for (const row of (conversationsResult.data ?? []) as Array<{
          id: string
          channel: string
          status: string
          contacts: unknown
        }>) {
          const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts
          const contactRecord = asRecord(contact)
          const email = asString(contactRecord.email)
          const phone = asString(contactRecord.phone)
          conversationsById.set(row.id, {
            id: row.id,
            channel: row.channel,
            status: row.status,
            contactName: asString(contactRecord.name),
            contactValue: email ?? phone,
          })
        }
      }

      const topicCounts = new Map<string, { count: number; examples: string[] }>()
      const reasonCounts = new Map<string, number>()

      for (const item of candidateRows) {
        if (item.noVerifiedAnswer) {
          for (const topic of extractTopicCandidates(item.question)) {
            const current = topicCounts.get(topic) ?? { count: 0, examples: [] }
            current.count += 1
            if (current.examples.length < 3) current.examples.push(item.question)
            topicCounts.set(topic, current)
          }
        }

        if (item.handoffReason) {
          reasonCounts.set(item.handoffReason, (reasonCounts.get(item.handoffReason) ?? 0) + 1)
        }
      }

      const items = limitedCandidates.map((item) => ({
        ...item,
        conversation: conversationsById.get(item.conversationId) ?? {
          id: item.conversationId,
          channel: 'chat',
          status: 'unknown',
          contactName: null,
          contactValue: null,
        },
        conversationHref: `/inbox?conversation=${item.conversationId}`,
      }))

      return {
        windowDays: days,
        summary: {
          unansweredCount: candidateRows.filter((item) => item.noVerifiedAnswer).length,
          lowConfidenceCount: candidateRows.filter((item) => item.lowConfidence).length,
          handoffCount: candidateRows.filter((item) => item.humanHandoff).length,
          notHelpfulCount: candidateRows.filter((item) => item.rating === 'not_helpful').length,
          ratedCount: candidateRows.filter((item) => item.rating !== null).length,
        },
        topMissingTopics: [...topicCounts.entries()]
          .map(([topic, value]) => ({ topic, count: value.count, examples: value.examples }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
        handoffReasons: [...reasonCounts.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
        items,
      }
    }),

  rateAiAnswer: protectedProcedure
    .input(z.object({
      messageId: z.string().uuid(),
      rating: aiRatingInput,
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      const { data: message, error: loadError } = await ctx.supabase
        .from('messages')
        .select('id, org_id, role, ai_metadata')
        .eq('id', input.messageId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (loadError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load AI answer: ${loadError.message}`,
        })
      }

      if (!message || message.role !== 'assistant') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'AI answer was not found.' })
      }

      const metadata = asRecord(message.ai_metadata)
      const nextMetadata = {
        ...metadata,
        aiQuality: {
          ...asRecord(metadata.aiQuality),
          rating: input.rating,
          ratedBy: ctx.user.id,
          ratedAt: new Date().toISOString(),
        },
      }

      const { error: updateError } = await ctx.supabase
        .from('messages')
        .update({ ai_metadata: nextMetadata })
        .eq('id', input.messageId)
        .eq('org_id', orgId)

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save AI rating: ${updateError.message}`,
        })
      }

      return { success: true, rating: input.rating }
    }),
})

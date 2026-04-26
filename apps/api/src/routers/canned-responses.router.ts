import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc/trpc'

const cannedCategorySchema = z.string().trim().min(1).max(40)

const billingSignals = new Set([
  'invoice', 'refund', 'payment', 'billing', 'plan', 'subscription', 'charge',
])

const technicalSignals = new Set([
  'bug', 'error', 'issue', 'api', 'integration', 'login', 'timeout', 'failed', 'problem',
])

const stopWords = new Set([
  'the', 'and', 'for', 'you', 'your', 'with', 'that', 'this', 'from', 'have',
  'are', 'was', 'were', 'will', 'can', 'our', 'about', 'just', 'please', 'hello',
  'thanks', 'thank', 'what', 'when', 'where', 'how', 'why', 'they', 'them',
])

interface CannedResponseRow {
  id: string
  org_id: string
  title: string
  category: string
  shortcut: string | null
  content: string
  tags: unknown
  is_active: boolean
  usage_count: number
  last_used_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

function normalizeShortcut(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  const safe = raw.replace(/[^a-z0-9_-]/g, '')
  if (!safe) return null
  return `/${safe}`
}

function normalizeCategory(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
    .filter((tag): tag is string => tag.length > 0)
}

function toResponseDto(row: CannedResponseRow) {
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    category: row.category,
    shortcut: row.shortcut,
    content: row.content,
    tags: normalizeTags(row.tags),
    isActive: row.is_active,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !stopWords.has(part))
}

function countTokenOverlap(a: string[], bSet: Set<string>): number {
  let score = 0
  for (const token of a) {
    if (bSet.has(token)) score += 1
  }
  return score
}

function inferCategoryBonus(category: string, tokens: string[]): number {
  const signalSet = category === 'billing' ? billingSignals : category === 'technical' ? technicalSignals : null
  if (!signalSet) return 0

  for (const token of tokens) {
    if (signalSet.has(token)) return 4
  }
  return 0
}

export const cannedResponsesRouter = router({
  list: protectedProcedure
    .input(z.object({
      query: z.string().max(100).optional(),
      category: cannedCategorySchema.optional(),
      includeInactive: z.boolean().default(false),
      limit: z.number().int().min(1).max(100).default(30),
    }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const query = input?.query?.trim()
      const safeQuery = query?.replace(/[^a-zA-Z0-9 _/-]/g, ' ').trim()
      const includeInactive = input?.includeInactive ?? false
      const limit = input?.limit ?? 30
      const normalizedCategory = input?.category ? normalizeCategory(input.category) : undefined

      let dbQuery = ctx.supabase
        .from('canned_responses')
        .select('*')
        .eq('org_id', orgId)
        .order('usage_count', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (!includeInactive) dbQuery = dbQuery.eq('is_active', true)
      if (normalizedCategory) dbQuery = dbQuery.eq('category', normalizedCategory)
      if (safeQuery) {
        dbQuery = dbQuery.or(
          `title.ilike.%${safeQuery}%,content.ilike.%${safeQuery}%,shortcut.ilike.%${safeQuery}%`
        )
      }

      const { data, error } = await dbQuery
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch canned responses: ${error.message}` })
      }

      return (data as CannedResponseRow[] | null ?? []).map(toResponseDto)
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(2).max(120),
      category: cannedCategorySchema,
      shortcut: z.string().max(50).optional().nullable(),
      content: z.string().min(3).max(4000),
      tags: z.array(z.string().min(1).max(40)).max(20).default([]),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.userRole !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can create canned responses.' })
      }

      const shortcut = normalizeShortcut(input.shortcut)
      const now = new Date().toISOString()

      const { data, error } = await ctx.supabase
        .from('canned_responses')
        .insert({
          org_id: ctx.userOrgId,
          title: input.title.trim(),
          category: normalizeCategory(input.category),
          shortcut,
          content: input.content.trim(),
          tags: input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
          is_active: input.isActive,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single()

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to create canned response: ${error.message}` })
      }

      return toResponseDto(data as CannedResponseRow)
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(2).max(120).optional(),
      category: cannedCategorySchema.optional(),
      shortcut: z.string().max(50).optional().nullable(),
      content: z.string().min(3).max(4000).optional(),
      tags: z.array(z.string().min(1).max(40)).max(20).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.userRole !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can update canned responses.' })
      }

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: ctx.user.id,
      }

      if (input.title !== undefined) payload.title = input.title.trim()
      if (input.category !== undefined) payload.category = normalizeCategory(input.category)
      if (input.shortcut !== undefined) payload.shortcut = normalizeShortcut(input.shortcut)
      if (input.content !== undefined) payload.content = input.content.trim()
      if (input.tags !== undefined) payload.tags = input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)
      if (input.isActive !== undefined) payload.is_active = input.isActive

      const { data, error } = await ctx.supabase
        .from('canned_responses')
        .update(payload)
        .eq('id', input.id)
        .eq('org_id', ctx.userOrgId)
        .select('*')
        .maybeSingle()

      if (error) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Failed to update canned response: ${error.message}` })
      }
      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Canned response not found.' })
      }

      return toResponseDto(data as CannedResponseRow)
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.userRole !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can delete canned responses.' })
      }

      const { error } = await ctx.supabase
        .from('canned_responses')
        .delete()
        .eq('id', input.id)
        .eq('org_id', ctx.userOrgId)

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to delete canned response: ${error.message}` })
      }

      return { success: true }
    }),

  recordUsage: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString()

      const { data, error } = await ctx.supabase
        .from('canned_responses')
        .select('usage_count')
        .eq('id', input.id)
        .eq('org_id', ctx.userOrgId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to read usage stats: ${error.message}` })
      }
      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Canned response not found.' })
      }

      const usageCount = Number((data as { usage_count: number }).usage_count ?? 0) + 1
      const { error: updateError } = await ctx.supabase
        .from('canned_responses')
        .update({
          usage_count: usageCount,
          last_used_at: now,
          updated_at: now,
          updated_by: ctx.user.id,
        })
        .eq('id', input.id)
        .eq('org_id', ctx.userOrgId)

      if (updateError) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to update usage stats: ${updateError.message}` })
      }

      return { success: true, usageCount }
    }),

  suggestForConversation: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      limit: z.number().int().min(1).max(10).default(4),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId

      const { data: conversation } = await ctx.supabase
        .from('conversations')
        .select('id, channel')
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (!conversation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      const { data: recentMessages } = await ctx.supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', input.conversationId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(25)

      const { data: emailMessages } = conversation.channel === 'email'
        ? await ctx.supabase
            .from('email_messages')
            .select('subject, text_body')
            .eq('conversation_id', input.conversationId)
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10)
        : { data: [] as Array<{ subject: string | null; text_body: string | null }> }

      const contextText = [
        ...(recentMessages ?? []).map((m) => `${m.role ?? ''} ${m.content ?? ''}`),
        ...((emailMessages ?? []).map((m) => `${m.subject ?? ''} ${m.text_body ?? ''}`)),
      ].join(' ')

      const contextTokens = tokenize(contextText)
      const contextSet = new Set(contextTokens)

      const { data: cannedRows, error: cannedError } = await ctx.supabase
        .from('canned_responses')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .limit(200)

      if (cannedError) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to load canned responses: ${cannedError.message}` })
      }

      const ranked = (cannedRows as CannedResponseRow[] | null ?? []).map((row) => {
        const dto = toResponseDto(row)
        const titleTokens = tokenize(dto.title)
        const bodyTokens = tokenize(dto.content)
        const tagTokens = dto.tags.flatMap((tag) => tokenize(tag))
        const shortcutToken = dto.shortcut ? dto.shortcut.replace('/', '') : ''

        const titleHits = countTokenOverlap(titleTokens, contextSet)
        const bodyHits = countTokenOverlap(bodyTokens, contextSet)
        const tagHits = countTokenOverlap(tagTokens, contextSet)
        const shortcutHit = shortcutToken && contextSet.has(shortcutToken) ? 1 : 0
        const categoryBonus = inferCategoryBonus(dto.category, contextTokens)
        const usageBonus = Math.min(dto.usageCount, 40) / 20

        const score = (titleHits * 5) + (bodyHits * 2.5) + (tagHits * 4) + (shortcutHit * 3) + categoryBonus + usageBonus
        const reason = titleHits > 0
          ? 'Title matches conversation context'
          : tagHits > 0
            ? 'Tag match found for this conversation'
            : categoryBonus > 0
              ? `Category ${dto.category} detected from message intent`
              : 'Most used reply fallback'

        return { ...dto, score, reason }
      })

      const sorted = ranked
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        })
        .slice(0, input.limit)

      return sorted
    }),
})

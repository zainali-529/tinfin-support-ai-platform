import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  DEFAULT_AI_IDENTITY_EVAL_CASES,
  getOrganizationAIContext,
  ingestText,
  queryRAG,
} from '@workspace/ai'
import { protectedProcedure, router } from '../trpc/trpc'
import {
  requireAdminFromContext,
  requirePermissionFromContext,
} from '../lib/org-permissions'

const optionalText = (max = 4000) =>
  z.string().trim().max(max).nullable().optional()

const profileInputSchema = z.object({
  assistantName: z.string().trim().min(1).max(120),
  companyName: z.string().trim().min(1).max(160),
  companySummary: optionalText(8000),
  websiteUrl: optionalText(500),
  industry: optionalText(200),
  targetCustomers: optionalText(1000),
  valueProposition: optionalText(1500),
  supportScope: optionalText(2000),
  outOfScope: optionalText(2000),
  brandVoice: z.string().trim().min(1).max(1000),
  defaultLanguage: z.string().trim().min(1).max(80).default('auto'),
  formattingStyle: z.string().trim().min(1).max(1000),
  handoffPolicy: optionalText(1500),
  forbiddenPhrases: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  goodAnswerExamples: z.array(z.string().trim().min(1).max(2000)).max(20).default([]),
  badAnswerExamples: z.array(z.string().trim().min(1).max(2000)).max(20).default([]),
})

const guidanceInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(140),
  category: z.enum([
    'brand_voice',
    'content',
    'escalation',
    'formatting',
    'safety',
    'channel',
    'general',
  ]).default('general'),
  conditionText: optionalText(1000),
  guidanceText: z.string().trim().min(5).max(4000),
  channel: z.enum(['all', 'chat', 'email', 'whatsapp', 'voice']).default('all'),
  priority: z.number().int().min(0).max(1000).default(100),
  isActive: z.boolean().default(true),
})

const evalCaseInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(180),
  inputMessage: z.string().trim().min(1).max(2000),
  expectedIntent: z.string().trim().min(1).max(80).default('company_identity'),
  expectedContains: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  forbiddenContains: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  requiredSourceType: optionalText(120),
  language: z.string().trim().min(1).max(80).default('auto'),
  channel: z.string().trim().min(1).max(80).default('chat'),
  isActive: z.boolean().default(true),
})

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toProfilePayload(orgId: string, input: z.infer<typeof profileInputSchema>) {
  return {
    org_id: orgId,
    assistant_name: input.assistantName,
    company_name: input.companyName,
    company_summary: cleanText(input.companySummary),
    website_url: cleanText(input.websiteUrl),
    industry: cleanText(input.industry),
    target_customers: cleanText(input.targetCustomers),
    value_proposition: cleanText(input.valueProposition),
    support_scope: cleanText(input.supportScope),
    out_of_scope: cleanText(input.outOfScope),
    brand_voice: input.brandVoice,
    default_language: input.defaultLanguage,
    formatting_style: input.formattingStyle,
    handoff_policy: cleanText(input.handoffPolicy),
    forbidden_phrases: input.forbiddenPhrases,
    good_answer_examples: input.goodAnswerExamples,
    bad_answer_examples: input.badAnswerExamples,
  }
}

function toEvalResponse(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    inputMessage: row.input_message as string,
    expectedIntent: row.expected_intent as string,
    expectedContains: asStringArray(row.expected_contains),
    forbiddenContains: asStringArray(row.forbidden_contains),
    requiredSourceType: cleanText(row.required_source_type as string | null),
    language: row.language as string,
    channel: row.channel as string,
    isActive: row.is_active !== false,
    lastRunAt: row.last_run_at as string | null,
    lastPassed: row.last_passed as boolean | null,
    lastScore: row.last_score as number | null,
    lastOutput: row.last_output as string | null,
    lastDiagnostics: (row.last_diagnostics ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function scoreEvalCase(params: {
  output: string
  actualIntent: string
  expectedIntent: string
  expectedContains: string[]
  forbiddenContains: string[]
  requiredSourceType: string | null
  sourceTypes: string[]
  companyName: string
}) {
  const output = params.output.toLowerCase()
  const expectedTerms = params.expectedContains.length > 0
    ? params.expectedContains
    : [params.companyName].filter(Boolean)

  const intentPassed =
    params.actualIntent === params.expectedIntent ||
    (params.expectedIntent === 'company_identity' && params.actualIntent === 'product_overview')
  const containsPassed =
    expectedTerms.length === 0 ||
    expectedTerms.some((term) => output.includes(term.toLowerCase()))
  const forbiddenHits = params.forbiddenContains.filter((term) =>
    output.includes(term.toLowerCase())
  )
  const forbiddenPassed = forbiddenHits.length === 0
  const sourcePassed =
    !params.requiredSourceType ||
    params.sourceTypes.includes(params.requiredSourceType)

  let score = 100
  if (!intentPassed) score -= 25
  if (!containsPassed) score -= 30
  if (!forbiddenPassed) score -= 35
  if (!sourcePassed) score -= 10

  return {
    passed: intentPassed && containsPassed && forbiddenPassed && sourcePassed,
    score: Math.max(0, score),
    diagnostics: {
      actualIntent: params.actualIntent,
      expectedIntent: params.expectedIntent,
      intentPassed,
      containsPassed,
      forbiddenPassed,
      forbiddenHits,
      sourcePassed,
      sourceTypes: params.sourceTypes,
    },
  }
}

export const aiProfileRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
    const orgId = ctx.userOrgId
    const context = await getOrganizationAIContext(orgId)

    const { data: row } = await ctx.supabase
      .from('organization_ai_profiles')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    const { count: pinnedCompanyChunks } = await ctx.supabase
      .from('kb_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('source_type', 'company_profile')

    return {
      exists: Boolean(row),
      profile: context.profile,
      guidanceCount: context.guidance.length,
      pinnedCompanyChunks: pinnedCompanyChunks ?? 0,
    }
  }),

  upsertProfile: protectedProcedure
    .input(profileInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      const orgId = ctx.userOrgId

      const { data, error } = await ctx.supabase
        .from('organization_ai_profiles')
        .upsert(toProfilePayload(orgId, input), { onConflict: 'org_id' })
        .select('*')
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save AI profile: ${error.message}`,
        })
      }

      return data
    }),

  saveCompanyProfileSource: protectedProcedure
    .input(z.object({
      content: z.string().trim().min(50).max(200_000),
      title: z.string().trim().min(1).max(200).default('Company Profile'),
      replaceExisting: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      const orgId = ctx.userOrgId

      let { data: kb, error: kbError } = await ctx.supabase
        .from('knowledge_bases')
        .select('id')
        .eq('org_id', orgId)
        .eq('source_type', 'company_profile')
        .maybeSingle()

      if (kbError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load company profile KB: ${kbError.message}`,
        })
      }

      if (!kb) {
        const created = await ctx.supabase
          .from('knowledge_bases')
          .insert({
            org_id: orgId,
            name: 'Company Profile',
            source_type: 'company_profile',
            settings: { systemManaged: true },
          })
          .select('id')
          .single()

        if (created.error || !created.data) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create company profile KB: ${created.error?.message ?? 'Unknown error'}`,
          })
        }

        kb = created.data
      }

      if (input.replaceExisting) {
        const { error: deleteError } = await ctx.supabase
          .from('kb_chunks')
          .delete()
          .eq('org_id', orgId)
          .eq('source_type', 'company_profile')

        if (deleteError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to replace existing company profile chunks: ${deleteError.message}`,
          })
        }
      }

      const result = await ingestText({
        content: input.content,
        title: input.title,
        kbId: kb.id as string,
        orgId,
        sourceType: 'company_profile',
        isPinned: true,
        pinnedReason: 'organization_ai_profile',
      })

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error ?? 'Failed to ingest company profile.',
        })
      }

      return {
        ...result,
        kbId: kb.id as string,
      }
    }),

  listGuidanceRules: protectedProcedure.query(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
    const { data, error } = await ctx.supabase
      .from('ai_guidance_rules')
      .select('*')
      .eq('org_id', ctx.userOrgId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load guidance rules: ${error.message}`,
      })
    }

    return data ?? []
  }),

  upsertGuidanceRule: protectedProcedure
    .input(guidanceInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      const orgId = ctx.userOrgId
      const payload = {
        org_id: orgId,
        name: input.name,
        category: input.category,
        condition_text: cleanText(input.conditionText),
        guidance_text: input.guidanceText,
        channel: input.channel,
        priority: input.priority,
        is_active: input.isActive,
      }

      const query = input.id
        ? ctx.supabase
            .from('ai_guidance_rules')
            .update(payload)
            .eq('id', input.id)
            .eq('org_id', orgId)
            .select('*')
            .single()
        : ctx.supabase
            .from('ai_guidance_rules')
            .insert(payload)
            .select('*')
            .single()

      const { data, error } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save guidance rule: ${error.message}`,
        })
      }

      return data
    }),

  deleteGuidanceRule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      await ctx.supabase
        .from('ai_guidance_rules')
        .delete()
        .eq('id', input.id)
        .eq('org_id', ctx.userOrgId)
      return { success: true }
    }),

  listEvalCases: protectedProcedure.query(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
    const { data, error } = await ctx.supabase
      .from('ai_eval_cases')
      .select('*')
      .eq('org_id', ctx.userOrgId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to load eval cases: ${error.message}`,
      })
    }

    return ((data ?? []) as Record<string, unknown>[]).map(toEvalResponse)
  }),

  upsertEvalCase: protectedProcedure
    .input(evalCaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      const orgId = ctx.userOrgId
      const payload = {
        org_id: orgId,
        name: input.name,
        input_message: input.inputMessage,
        expected_intent: input.expectedIntent,
        expected_contains: input.expectedContains,
        forbidden_contains: input.forbiddenContains,
        required_source_type: cleanText(input.requiredSourceType),
        language: input.language,
        channel: input.channel,
        is_active: input.isActive,
      }

      const query = input.id
        ? ctx.supabase
            .from('ai_eval_cases')
            .update(payload)
            .eq('id', input.id)
            .eq('org_id', orgId)
            .select('*')
            .single()
        : ctx.supabase
            .from('ai_eval_cases')
            .insert(payload)
            .select('*')
            .single()

      const { data, error } = await query
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save eval case: ${error.message}`,
        })
      }

      return toEvalResponse(data as Record<string, unknown>)
    }),

  seedDefaultEvalCases: protectedProcedure.mutation(async ({ ctx }) => {
    requireAdminFromContext(ctx)
    const orgId = ctx.userOrgId
    const context = await getOrganizationAIContext(orgId)

    const { data: existing } = await ctx.supabase
      .from('ai_eval_cases')
      .select('name')
      .eq('org_id', orgId)

    const existingNames = new Set(((existing ?? []) as Array<{ name: string }>).map((row) => row.name))
    const rows = DEFAULT_AI_IDENTITY_EVAL_CASES
      .filter((item) => !existingNames.has(item.name))
      .map((item) => ({
        org_id: orgId,
        name: item.name,
        input_message: item.inputMessage,
        expected_intent: item.expectedIntent,
        expected_contains: context.profile.companyName ? [context.profile.companyName] : item.expectedContains,
        forbidden_contains: item.forbiddenContains,
        required_source_type: item.requiredSourceType ?? null,
        language: item.language,
        channel: item.channel,
      }))

    if (rows.length === 0) return { inserted: 0 }

    const { error } = await ctx.supabase.from('ai_eval_cases').insert(rows)
    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to seed eval cases: ${error.message}`,
      })
    }

    return { inserted: rows.length }
  }),

  runEvalCases: protectedProcedure
    .input(z.object({
      ids: z.array(z.string().uuid()).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      requireAdminFromContext(ctx)
      const orgId = ctx.userOrgId
      const context = await getOrganizationAIContext(orgId)
      let query = ctx.supabase
        .from('ai_eval_cases')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)

      if (input?.ids?.length) {
        query = query.in('id', input.ids)
      }

      const { data, error } = await query
        .order('created_at', { ascending: true })
        .limit(input?.limit ?? 20)
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load eval cases: ${error.message}`,
        })
      }

      const cases = ((data ?? []) as Record<string, unknown>[]).map(toEvalResponse)
      const results = []

      for (const testCase of cases) {
        const ragResult = await queryRAG({
          query: testCase.inputMessage,
          orgId,
          channel: 'eval',
          threshold: 0.25,
          maxChunks: 6,
        })
        const sourceTypes = ragResult.sources
          .map((source) => source.sourceType)
          .filter((sourceType): sourceType is string => Boolean(sourceType))
        const scored = scoreEvalCase({
          output: ragResult.message,
          actualIntent: ragResult.debug?.intent ?? 'unknown',
          expectedIntent: testCase.expectedIntent,
          expectedContains: testCase.expectedContains,
          forbiddenContains: testCase.forbiddenContains,
          requiredSourceType: testCase.requiredSourceType,
          sourceTypes,
          companyName: context.profile.companyName,
        })

        await ctx.supabase
          .from('ai_eval_cases')
          .update({
            last_run_at: new Date().toISOString(),
            last_passed: scored.passed,
            last_score: scored.score,
            last_output: ragResult.message,
            last_diagnostics: scored.diagnostics,
          })
          .eq('id', testCase.id)
          .eq('org_id', orgId)

        results.push({
          id: testCase.id,
          name: testCase.name,
          output: ragResult.message,
          ...scored,
        })
      }

      return {
        total: results.length,
        passed: results.filter((item) => item.passed).length,
        failed: results.filter((item) => !item.passed).length,
        results,
      }
    }),

  listAnswerTraces: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(30),
      conversationId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      let query = ctx.supabase
        .from('ai_answer_traces')
        .select('*')
        .eq('org_id', ctx.userOrgId)

      if (input?.conversationId) {
        query = query.eq('conversation_id', input.conversationId)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(input?.limit ?? 30)
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load answer traces: ${error.message}`,
        })
      }

      return data ?? []
    }),
})

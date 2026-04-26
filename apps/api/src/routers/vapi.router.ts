/**
 * apps/api/src/routers/vapi.router.ts
 *
 * Enhanced with:
 *   - kb_ids storage per assistant (which KBs the voice AI searches)
 *   - tools_enabled flag
 *   - Advanced settings: transcription, VAD, recording, interruptions, timing
 *   - All existing functionality preserved
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import {
  createVapiAssistant,
  updateVapiAssistant,
  deleteVapiAssistant,
  listVapiCalls,
  buildOrgAssistantPayload,
  formatCallDuration,
  DEFAULT_VOICE_ID,
  type VapiModel,
} from '@workspace/ai'
import type { Context } from '../trpc/context'
import { requireFeature } from '../lib/plan-guards'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertOrgAdmin(
  supabase: Context['supabase'],
  userId: string,
  orgId: string
): Promise<void> {
  const { data } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data || data.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only admins can manage voice assistant settings.',
    })
  }
}

async function getOrgVapiKey(
  supabase: Context['supabase'],
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('org_api_keys')
    .select('vapi_key_encrypted')
    .eq('org_id', orgId)
    .maybeSingle()
  return (data?.vapi_key_encrypted as string | null) ?? null
}

async function saveOrgVapiKey(
  supabase: Context['supabase'],
  orgId: string,
  keyEncrypted: string
): Promise<void> {
  await supabase
    .from('org_api_keys')
    .upsert({ org_id: orgId, vapi_key_encrypted: keyEncrypted }, { onConflict: 'org_id' })
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

// ─── Input schemas ────────────────────────────────────────────────────────────

const upsertAssistantSchema = z.object({
  // Identity
  name: z.string().min(1).max(80).optional(),
  firstMessage: z.string().min(1).max(500).optional(),
  systemPrompt: z.string().max(4000).optional(),
  // Voice
  voiceId: z.string().min(1).max(100).optional(),
  // AI model
  model: z.string().min(1).max(50).optional(),
  // Call limits
  maxDurationSeconds: z.number().int().min(60).max(3600).optional(),
  backgroundSound: z.enum(['off', 'office', 'cafe']).optional(),
  isActive: z.boolean().optional(),
  // ── Knowledge Base integration ──────────────────────────────────────────────
  /** UUIDs of knowledge bases this assistant should search */
  kbIds: z.array(z.string().uuid()).optional(),
  /** Enable real-time KB tool calls during calls */
  toolsEnabled: z.boolean().optional(),
  // ── Transcription ───────────────────────────────────────────────────────────
  transcriptionProvider: z.enum(['deepgram', 'talkscriber', 'gladia']).optional(),
  transcriptionLanguage: z.string().min(2).max(10).optional(),
  // ── Timing & behavior ───────────────────────────────────────────────────────
  silenceTimeoutSeconds: z.number().int().min(5).max(120).optional(),
  responseDelaySeconds: z.number().min(0).max(5).optional(),
  interruptionsEnabled: z.boolean().optional(),
  // ── Recording ───────────────────────────────────────────────────────────────
  recordingEnabled: z.boolean().optional(),
  // ── Call control ────────────────────────────────────────────────────────────
  endCallPhrases: z.array(z.string().max(50)).max(10).optional(),
})

// ─── Router ───────────────────────────────────────────────────────────────────

export const vapiRouter = router({

  // ── READ ─────────────────────────────────────────────────────────────────────

  getAssistantConfig: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('vapi_assistants')
      .select('*')
      .eq('org_id', ctx.userOrgId)
      .maybeSingle()
    return data ?? null
  }),

  getCalls: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
          status: z.string().optional(),
          type: z.string().optional(),
          contactId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const limit = input?.limit ?? 50
      const offset = input?.offset ?? 0

      let query = ctx.supabase
        .from('calls')
        .select('*, contacts(id, name, email, phone)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (input?.status) query = query.eq('status', input.status)
      if (input?.type) query = query.eq('type', input.type)
      if (input?.contactId) query = query.eq('contact_id', input.contactId)

      const { data, error } = await query
      if (error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to load calls: ${error.message}`,
        })

      return (data ?? []).map((call) => ({
        ...call,
        durationFormatted: formatCallDuration(call.duration_seconds as number | null),
      }))
    }),

  getCall: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('calls')
        .select('*, contacts(id, name, email, phone), conversations(id, status, started_at)')
        .eq('id', input.id)
        .eq('org_id', ctx.userOrgId)
        .single()

      if (error || !data)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Call not found.' })
      return {
        ...data,
        durationFormatted: formatCallDuration(data.duration_seconds as number | null),
      }
    }),

  getCallStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    const now = new Date()
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString()
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - now.getDay()
    ).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [todayResult, weekResult, monthResult, totalResult] = await Promise.all([
      ctx.supabase
        .from('calls')
        .select('id, duration_seconds, status', { count: 'exact', head: false })
        .eq('org_id', orgId)
        .gte('created_at', todayStart),
      ctx.supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', weekStart),
      ctx.supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', monthStart),
      ctx.supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
    ])

    const todayCalls = todayResult.data ?? []
    const totalDurationToday = todayCalls.reduce(
      (sum, c) => sum + ((c.duration_seconds as number) || 0),
      0
    )
    const endedToday = todayCalls.filter((c) => c.status === 'ended').length

    return {
      today: {
        count: todayCalls.length,
        ended: endedToday,
        totalDurationSeconds: totalDurationToday,
        avgDurationSeconds:
          endedToday > 0 ? Math.round(totalDurationToday / endedToday) : 0,
      },
      thisWeek: weekResult.count ?? 0,
      thisMonth: monthResult.count ?? 0,
      allTime: totalResult.count ?? 0,
    }
  }),

  hasCustomVapiKey: protectedProcedure.query(async ({ ctx }) => {
    const key = await getOrgVapiKey(ctx.supabase, ctx.userOrgId)
    return { hasCustomKey: Boolean(key) }
  }),

  getPublicKey: protectedProcedure.query(() => {
    const publicKey = process.env.VAPI_PUBLIC_KEY
    if (!publicKey)
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'VAPI_PUBLIC_KEY not configured.',
      })
    return { publicKey }
  }),

  // ── WRITE ────────────────────────────────────────────────────────────────────

  upsertAssistantConfig: protectedProcedure
    .input(upsertAssistantSchema)
    .mutation(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)
      await requireFeature(ctx.supabase, ctx.userOrgId, 'voiceCalls')

      const orgId = ctx.userOrgId

      const { data: org } = await ctx.supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found.' })

      const { data: widgetCfg } = await ctx.supabase
        .from('widget_configs')
        .select('company_name')
        .eq('org_id', orgId)
        .maybeSingle()
      const companyName = (widgetCfg?.company_name as string | null) || org.name

      // Load existing config to merge fields
      const { data: existing } = await ctx.supabase
        .from('vapi_assistants')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle()

      const orgVapiKey = await getOrgVapiKey(ctx.supabase, orgId)

      const webhookBaseUrl =
        process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`
      const webhookSecret = process.env.VAPI_WEBHOOK_SECRET || 'tinfin-vapi-secret'

      // ── Merge fields with existing values ────────────────────────────────────
      const existingSettings = (existing?.settings as Record<string, unknown>) ?? {}

      const finalName = input.name ?? asString(existing?.name) ?? 'Support Assistant'
      const finalFirstMessage =
        input.firstMessage ?? asString(existing?.first_message) ?? undefined
      const finalSystemPrompt =
        input.systemPrompt ?? asString(existing?.system_prompt) ?? undefined
      const finalVoiceId = input.voiceId ?? asString(existing?.voice) ?? DEFAULT_VOICE_ID
      const finalModel = (input.model ?? asString(existing?.model) ?? 'gpt-4o-mini') as VapiModel
      const finalMaxDuration =
        input.maxDurationSeconds ?? (existing?.max_duration_seconds as number | null) ?? 600
      const finalBgSound =
        input.backgroundSound ??
        (existing?.background_sound as 'off' | 'office' | 'cafe' | null) ??
        'off'

      // Advanced settings — merge with existing settings JSONB
      const finalToolsEnabled =
        input.toolsEnabled ??
        (existingSettings.toolsEnabled as boolean | undefined) ??
        true
      const finalKbIds =
        input.kbIds ?? (existing?.kb_ids as string[] | null | undefined) ?? []
      const finalTranscriptionProvider =
        input.transcriptionProvider ??
        (existingSettings.transcriptionProvider as 'deepgram' | 'talkscriber' | 'gladia' | undefined) ??
        'deepgram'
      const finalTranscriptionLanguage =
        input.transcriptionLanguage ??
        (existingSettings.transcriptionLanguage as string | undefined) ??
        'en'
      const finalSilenceTimeout =
        input.silenceTimeoutSeconds ??
        (existingSettings.silenceTimeoutSeconds as number | undefined) ??
        30
      const finalResponseDelay =
        input.responseDelaySeconds ??
        (existingSettings.responseDelaySeconds as number | undefined) ??
        0.4
      const finalInterruptions =
        input.interruptionsEnabled ??
        (existingSettings.interruptionsEnabled as boolean | undefined) ??
        true
      const finalRecording =
        input.recordingEnabled ??
        (existingSettings.recordingEnabled as boolean | undefined) ??
        true
      const finalEndCallPhrases =
        input.endCallPhrases ??
        (existingSettings.endCallPhrases as string[] | undefined) ??
        ['goodbye', 'bye', 'thanks bye', "that's all", 'end call']

      // ── Build Vapi payload ────────────────────────────────────────────────────
      const payload = buildOrgAssistantPayload({
        name: finalName,
        companyName,
        firstMessage: finalFirstMessage,
        systemPrompt: finalSystemPrompt,
        voiceId: finalVoiceId,
        model: finalModel,
        maxDurationSeconds: finalMaxDuration,
        backgroundSound: finalBgSound,
        orgId,
        webhookBaseUrl,
        webhookSecret,
        // Advanced
        toolsEnabled: finalToolsEnabled,
        transcriptionProvider: finalTranscriptionProvider,
        transcriptionLanguage: finalTranscriptionLanguage,
        silenceTimeoutSeconds: finalSilenceTimeout,
        responseDelaySeconds: finalResponseDelay,
        interruptionsEnabled: finalInterruptions,
        recordingEnabled: finalRecording,
        endCallPhrases: finalEndCallPhrases,
      })

      // ── Sync with Vapi API ────────────────────────────────────────────────────
      let vapiAssistantId =
        asString(existing?.vapi_assistant_id) ?? null

      try {
        if (vapiAssistantId) {
          await updateVapiAssistant(vapiAssistantId, payload, orgVapiKey)
        } else {
          const created = await createVapiAssistant(payload, orgVapiKey)
          vapiAssistantId = created.id
        }
      } catch (err) {
        console.error('[vapi.router] Vapi sync failed:', err)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to sync with Vapi: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      }

      // ── Persist to DB ─────────────────────────────────────────────────────────
      const upsertPayload = {
        org_id: orgId,
        vapi_assistant_id: vapiAssistantId,
        name: finalName,
        first_message: finalFirstMessage ?? payload.firstMessage,
        system_prompt: finalSystemPrompt ?? null,
        voice: finalVoiceId,
        model: finalModel,
        max_duration_seconds: finalMaxDuration,
        background_sound: finalBgSound,
        is_active: input.isActive ?? (existing?.is_active as boolean | null) ?? true,
        // New columns
        kb_ids: finalKbIds,
        tools_enabled: finalToolsEnabled,
        // Advanced settings stored in JSONB
        settings: {
          ...existingSettings,
          transcriptionProvider: finalTranscriptionProvider,
          transcriptionLanguage: finalTranscriptionLanguage,
          silenceTimeoutSeconds: finalSilenceTimeout,
          responseDelaySeconds: finalResponseDelay,
          interruptionsEnabled: finalInterruptions,
          recordingEnabled: finalRecording,
          endCallPhrases: finalEndCallPhrases,
          toolsEnabled: finalToolsEnabled,
        },
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await ctx.supabase
        .from('vapi_assistants')
        .upsert(upsertPayload, { onConflict: 'org_id' })
        .select()
        .single()

      if (error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `DB upsert failed: ${error.message}`,
        })

      return data
    }),

  deleteAssistant: protectedProcedure.mutation(async ({ ctx }) => {
    await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)

    const orgId = ctx.userOrgId
    const { data: existing } = await ctx.supabase
      .from('vapi_assistants')
      .select('vapi_assistant_id')
      .eq('org_id', orgId)
      .maybeSingle()
    if (!existing) return { success: true }

    const vapiAssistantId = existing.vapi_assistant_id as string | null
    const orgVapiKey = await getOrgVapiKey(ctx.supabase, orgId)

    if (vapiAssistantId) {
      try {
        await deleteVapiAssistant(vapiAssistantId, orgVapiKey)
      } catch (err) {
        console.warn('[vapi.router] Could not delete Vapi assistant:', err)
      }
    }

    await ctx.supabase.from('vapi_assistants').delete().eq('org_id', orgId)
    return { success: true }
  }),

  saveOrgVapiKey: protectedProcedure
    .input(z.object({ vapiPrivateKey: z.string().min(10, 'Invalid Vapi key') }))
    .mutation(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)
      await saveOrgVapiKey(ctx.supabase, ctx.userOrgId, input.vapiPrivateKey)
      return { success: true }
    }),

  removeOrgVapiKey: protectedProcedure.mutation(async ({ ctx }) => {
    await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)
    await ctx.supabase
      .from('org_api_keys')
      .update({ vapi_key_encrypted: null })
      .eq('org_id', ctx.userOrgId)
    return { success: true }
  }),

  syncCallsFromVapi: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .mutation(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)

      const orgId = ctx.userOrgId
      const { data: assistantRow } = await ctx.supabase
        .from('vapi_assistants')
        .select('vapi_assistant_id')
        .eq('org_id', orgId)
        .maybeSingle()
      if (!assistantRow?.vapi_assistant_id) return { synced: 0 }

      const orgVapiKey = await getOrgVapiKey(ctx.supabase, orgId)

      let vapiCalls
      try {
        vapiCalls = await listVapiCalls(
          { assistantId: assistantRow.vapi_assistant_id as string, limit: input.limit },
          orgVapiKey
        )
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Vapi sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      }

      let synced = 0
      for (const call of vapiCalls) {
        const durationSeconds =
          call.endedAt && call.startedAt
            ? Math.round(
                (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
              )
            : (call.durationSeconds ?? call.duration ?? null)

        const status = call.endedAt || call.endedReason ? 'ended' : call.status

        const assistantMeta = (call.assistant?.metadata ?? {}) as Record<string, unknown>
        const overrideMeta = (call.assistantOverrides?.metadata ?? {}) as Record<string, unknown>
        const variableValues = (call.assistantOverrides?.variableValues ?? {}) as Record<
          string,
          unknown
        >
        const callMeta = (call.metadata ?? {}) as Record<string, unknown>
        const metadata = { ...assistantMeta, ...overrideMeta, ...variableValues, ...callMeta }

        const visitorId =
          asString(metadata.visitorId) ?? asString(metadata.visitor_id) ?? null
        const startedAt = call.startedAt ?? call.createdAt ?? null
        const endedAt = call.endedAt ?? (status === 'ended' ? call.updatedAt : null)

        const { data: upserted, error } = await ctx.supabase
          .from('calls')
          .upsert(
            {
              org_id: orgId,
              vapi_call_id: call.id,
              vapi_assistant_id: call.assistantId ?? null,
              phone_number_id: call.phoneNumberId ?? null,
              status,
              type: call.type,
              direction: call.type === 'outboundPhoneCall' ? 'outbound' : 'inbound',
              duration_seconds: durationSeconds,
              recording_url: call.recordingUrl ?? null,
              stereo_recording_url: call.stereoRecordingUrl ?? null,
              transcript: call.transcript ?? null,
              summary: call.summary ?? null,
              cost_cents:
                call.cost !== undefined && call.cost !== null
                  ? String(Math.round(call.cost * 100))
                  : null,
              ended_reason: call.endedReason ?? null,
              caller_number: call.customer?.number ?? null,
              visitor_id: visitorId,
              metadata,
              started_at: startedAt,
              ended_at: endedAt,
            },
            { onConflict: 'vapi_call_id' }
          )
          .select('id')
          .single()

        if (!error && upserted?.id) synced++
      }

      return { synced }
    }),
})
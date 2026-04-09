/**
 * apps/api/src/routers/vapi.router.ts
 *
 * tRPC router for Vapi voice integration.
 * All mutations are org-scoped via ctx.userOrgId.
 *
 * Security:
 *   - Private Vapi key NEVER sent to frontend
 *   - Public key returned only for widget config (read-only scope)
 *   - Per-org keys stored encrypted in org_api_keys table
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Router ───────────────────────────────────────────────────────────────────

export const vapiRouter = router({

  // ── Assistant Config ──────────────────────────────────────────────────────

  getAssistantConfig: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('vapi_assistants')
      .select('*')
      .eq('org_id', ctx.userOrgId)
      .maybeSingle()
    return data ?? null
  }),

  /**
   * Upsert assistant config and sync to Vapi.
   * Creates assistant on first call, updates on subsequent calls.
   */
  upsertAssistantConfig: protectedProcedure
    .input(
      z.object({
        name:               z.string().min(1).max(80).optional(),
        firstMessage:       z.string().min(1).max(500).optional(),
        systemPrompt:       z.string().max(4000).optional(),
        /** Voice in "{provider}:{voiceId}" format, e.g. "openai:alloy" */
        voiceId:            z.string().min(1).max(100).optional(),
        model:              z.string().min(1).max(50).optional(),
        maxDurationSeconds: z.number().int().min(60).max(3600).optional(),
        backgroundSound:    z.enum(['off', 'office', 'cafe']).optional(),
        isActive:           z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId

      // Load org details
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

      // Load existing assistant config
      const { data: existing } = await ctx.supabase
        .from('vapi_assistants')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle()

      const orgVapiKey = await getOrgVapiKey(ctx.supabase, orgId)

      const webhookBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`
      const webhookSecret = process.env.VAPI_WEBHOOK_SECRET || 'tinfin-vapi-secret'

      // Resolve final values (input → existing → defaults)
      const finalName         = input.name           ?? (existing?.name as string | null)           ?? 'Support Assistant'
      const finalFirstMessage = input.firstMessage   ?? (existing?.first_message as string | null)  ?? undefined
      const finalSystemPrompt = input.systemPrompt   ?? (existing?.system_prompt as string | null)  ?? undefined
      const finalVoiceId      = input.voiceId        ?? (existing?.voice as string | null)          ?? DEFAULT_VOICE_ID
      const finalModel        = (input.model         ?? (existing?.model as string | null)          ?? 'gpt-4o-mini') as VapiModel
      const finalMaxDuration  = input.maxDurationSeconds ?? (existing?.max_duration_seconds as number | null) ?? 600
      const finalBgSound      = input.backgroundSound    ?? (existing?.background_sound as 'off' | 'office' | 'cafe' | null) ?? 'off'

      const payload = buildOrgAssistantPayload({
        name:               finalName,
        companyName,
        firstMessage:       finalFirstMessage,
        systemPrompt:       finalSystemPrompt,
        voiceId:            finalVoiceId,   // e.g. "openai:alloy" or "deepgram:aura-asteria-en"
        model:              finalModel,
        maxDurationSeconds: finalMaxDuration,
        backgroundSound:    finalBgSound,
        orgId,
        webhookBaseUrl,
        webhookSecret,
      })

      let vapiAssistantId = (existing?.vapi_assistant_id as string | null | undefined) ?? null

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

      const upsertPayload = {
        org_id:               orgId,
        vapi_assistant_id:    vapiAssistantId,
        name:                 finalName,
        first_message:        finalFirstMessage ?? payload.firstMessage,
        system_prompt:        finalSystemPrompt ?? null,
        voice:                finalVoiceId,   // stored as "provider:voiceId"
        model:                finalModel,
        max_duration_seconds: finalMaxDuration,
        background_sound:     finalBgSound,
        is_active:            input.isActive ?? (existing?.is_active as boolean | null) ?? true,
        updated_at:           new Date().toISOString(),
      }

      const { data, error } = await ctx.supabase
        .from('vapi_assistants')
        .upsert(upsertPayload, { onConflict: 'org_id' })
        .select()
        .single()

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `DB upsert failed: ${error.message}`,
        })
      }

      return data
    }),

  deleteAssistant: protectedProcedure.mutation(async ({ ctx }) => {
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

  // ── Call Logs ─────────────────────────────────────────────────────────────

  getCalls: protectedProcedure
    .input(
      z.object({
        limit:     z.number().int().min(1).max(100).default(50),
        offset:    z.number().int().min(0).default(0),
        status:    z.string().optional(),
        type:      z.string().optional(),
        contactId: z.string().uuid().optional(),
      }).optional()
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
      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to load calls: ${error.message}` })
      }

      return (data ?? []).map(call => ({
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

      if (error || !data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Call not found.' })

      return {
        ...data,
        durationFormatted: formatCallDuration(data.duration_seconds as number | null),
      }
    }),

  getCallStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString()
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
    const totalDurationToday = todayCalls.reduce((sum, c) => sum + ((c.duration_seconds as number) || 0), 0)
    const endedToday = todayCalls.filter(c => c.status === 'ended').length

    return {
      today: {
        count: todayCalls.length,
        ended: endedToday,
        totalDurationSeconds: totalDurationToday,
        avgDurationSeconds: endedToday > 0 ? Math.round(totalDurationToday / endedToday) : 0,
      },
      thisWeek:  weekResult.count  ?? 0,
      thisMonth: monthResult.count ?? 0,
      allTime:   totalResult.count ?? 0,
    }
  }),

  // ── API Key Management ────────────────────────────────────────────────────

  saveOrgVapiKey: protectedProcedure
    .input(z.object({ vapiPrivateKey: z.string().min(10, 'Invalid Vapi key') }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      const { data: membership } = await ctx.supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', ctx.user.id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (membership?.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can configure Vapi keys.' })
      }

      await saveOrgVapiKey(ctx.supabase, orgId, input.vapiPrivateKey)
      return { success: true }
    }),

  hasCustomVapiKey: protectedProcedure.query(async ({ ctx }) => {
    const key = await getOrgVapiKey(ctx.supabase, ctx.userOrgId)
    return { hasCustomKey: Boolean(key) }
  }),

  removeOrgVapiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    const { data: membership } = await ctx.supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', ctx.user.id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (membership?.role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can manage Vapi keys.' })
    }

    await ctx.supabase
      .from('org_api_keys')
      .update({ vapi_key_encrypted: null })
      .eq('org_id', orgId)

    return { success: true }
  }),

  getPublicKey: protectedProcedure.query(() => {
    const publicKey = process.env.VAPI_PUBLIC_KEY
    if (!publicKey) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'VAPI_PUBLIC_KEY not configured on the server.',
      })
    }
    return { publicKey }
  }),

  syncCallsFromVapi: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .mutation(async ({ ctx, input }) => {
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
        const { error } = await ctx.supabase.from('calls').upsert(
          {
            org_id:               orgId,
            vapi_call_id:         call.id,
            vapi_assistant_id:    call.assistantId ?? null,
            status:               call.status,
            type:                 call.type,
            duration_seconds:     call.endedAt && call.startedAt
              ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
              : null,
            recording_url:        call.recordingUrl ?? null,
            stereo_recording_url: call.stereoRecordingUrl ?? null,
            transcript:           call.transcript ?? null,
            summary:              call.summary ?? null,
            ended_reason:         call.endedReason ?? null,
            caller_number:        call.customer?.number ?? null,
            started_at:           call.startedAt ?? null,
            ended_at:             call.endedAt ?? null,
          },
          { onConflict: 'vapi_call_id' }
        )
        if (!error) synced++
      }

      return { synced }
    }),
})
/**
 * apps/api/src/routers/vapi.router.ts  (UPDATED)
 *
 * Fix: syncCallsFromVapi now also runs contact linking after upsert,
 * so previously-synced "Unknown" calls get their contact attached.
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

async function assertOrgAdmin(supabase: Context['supabase'], userId: string, orgId: string): Promise<void> {
  const { data } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data || data.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can manage voice assistant settings.' })
  }
}

async function getOrgVapiKey(supabase: Context['supabase'], orgId: string): Promise<string | null> {
  const { data } = await supabase
    .from('org_api_keys')
    .select('vapi_key_encrypted')
    .eq('org_id', orgId)
    .maybeSingle()
  return (data?.vapi_key_encrypted as string | null) ?? null
}

async function saveOrgVapiKey(supabase: Context['supabase'], orgId: string, keyEncrypted: string): Promise<void> {
  await supabase
    .from('org_api_keys')
    .upsert({ org_id: orgId, vapi_key_encrypted: keyEncrypted }, { onConflict: 'org_id' })
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

function isUuid(value: string | null): value is string {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function pickMetaString(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const parsed = asString(meta[key])
    if (parsed) return parsed
  }
  return null
}

function buildCallMetadata(call: {
  metadata?: Record<string, unknown>
  assistant?: { metadata?: Record<string, unknown> }
  assistantOverrides?: { metadata?: Record<string, unknown>; variableValues?: Record<string, unknown> }
}): Record<string, unknown> {
  const assistantMetadata = (call.assistant?.metadata ?? {}) as Record<string, unknown>
  const overrideMetadata = (call.assistantOverrides?.metadata ?? {}) as Record<string, unknown>
  const variableValues = (call.assistantOverrides?.variableValues ?? {}) as Record<string, unknown>
  const callMetadata = (call.metadata ?? {}) as Record<string, unknown>

  return {
    ...assistantMetadata,
    ...overrideMetadata,
    ...variableValues,
    ...callMetadata,
  }
}

/**
 * Link a call row to contact/conversation using metadata, visitor_id, caller_number, or email.
 */
async function linkCallToContact(
  supabase: Context['supabase'],
  orgId: string,
  callRowId: string,
  vapiCall: {
    metadata?: Record<string, unknown> | null
    customer?: { number?: string; name?: string; email?: string } | null
    type?: string | null
  }
): Promise<void> {
  const metadata = (vapiCall.metadata ?? {}) as Record<string, unknown>
  const visitorId = pickMetaString(metadata, ['visitorId', 'visitor_id'])
  const metadataConversationId = pickMetaString(metadata, ['conversationId', 'conversation_id'])
  const metadataContactId = pickMetaString(metadata, ['contactId', 'contact_id'])
  const callerNumber = vapiCall.customer?.number
  const callerName = vapiCall.customer?.name
  const callerEmail = vapiCall.customer?.email

  if (!visitorId && !callerNumber && !callerEmail && !metadataConversationId && !metadataContactId) return

  let contactId: string | null = null
  let conversationId: string | null = null

  if (isUuid(metadataConversationId)) {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, contact_id')
      .eq('org_id', orgId)
      .eq('id', metadataConversationId)
      .maybeSingle()
    if (conversation?.id) {
      conversationId = conversation.id as string
      contactId = (conversation.contact_id as string | null | undefined) ?? null
    }
  }

  if (!contactId && isUuid(metadataContactId)) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('id', metadataContactId)
      .maybeSingle()
    contactId = (contact?.id as string | undefined) ?? null
  }

  if (!contactId && visitorId) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .or(`meta->>visitorId.eq.${visitorId},meta->>visitor_id.eq.${visitorId}`)
      .order('created_at', { ascending: false })
      .limit(1)
    contactId = (data?.[0]?.id as string | undefined) ?? null
  }

  if (!contactId && callerNumber) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('phone', callerNumber)
      .order('created_at', { ascending: false })
      .limit(1)
    contactId = (data?.[0]?.id as string | undefined) ?? null

    if (!contactId) {
      const { data: created } = await supabase
        .from('contacts')
        .insert({
          org_id: orgId,
          name: callerName ?? null,
          email: callerEmail ?? null,
          phone: callerNumber,
          meta: {
            source: 'voice_call',
            ...(visitorId ? { visitorId } : {}),
          },
        })
        .select('id')
        .maybeSingle()
      contactId = created?.id ?? null
    }
  }

  if (!contactId && callerEmail) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', callerEmail.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1)
    contactId = (data?.[0]?.id as string | undefined) ?? null
  }

  if (!conversationId && contactId && (vapiCall.type === 'webCall' || vapiCall.type === 'vapi.websocketCall')) {
    const { data: conversationRows } = await supabase
      .from('conversations')
      .select('id')
      .eq('org_id', orgId)
      .eq('contact_id', contactId)
      .order('started_at', { ascending: false })
      .limit(1)
    conversationId = (conversationRows?.[0]?.id as string | undefined) ?? null
  }

  const patch: Record<string, unknown> = {}
  if (contactId) patch.contact_id = contactId
  if (conversationId) patch.conversation_id = conversationId
  if (visitorId) patch.visitor_id = visitorId

  if (Object.keys(patch).length > 0) {
    await supabase.from('calls').update(patch).eq('id', callRowId).eq('org_id', orgId)
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const vapiRouter = router({

  // ── READ — available to all members ──────────────────────────────────────

  getAssistantConfig: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('vapi_assistants')
      .select('*')
      .eq('org_id', ctx.userOrgId)
      .maybeSingle()
    return data ?? null
  }),

  getCalls: protectedProcedure
    .input(z.object({
      limit:     z.number().int().min(1).max(100).default(50),
      offset:    z.number().int().min(0).default(0),
      status:    z.string().optional(),
      type:      z.string().optional(),
      contactId: z.string().uuid().optional(),
    }).optional())
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
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to load calls: ${error.message}` })

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
      return { ...data, durationFormatted: formatCallDuration(data.duration_seconds as number | null) }
    }),

  getCallStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [todayResult, weekResult, monthResult, totalResult] = await Promise.all([
      ctx.supabase.from('calls').select('id, duration_seconds, status', { count: 'exact', head: false }).eq('org_id', orgId).gte('created_at', todayStart),
      ctx.supabase.from('calls').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', weekStart),
      ctx.supabase.from('calls').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', monthStart),
      ctx.supabase.from('calls').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ])

    const todayCalls = todayResult.data ?? []
    const totalDurationToday = todayCalls.reduce((sum, c) => sum + ((c.duration_seconds as number) || 0), 0)
    const endedToday = todayCalls.filter(c => c.status === 'ended').length

    return {
      today: { count: todayCalls.length, ended: endedToday, totalDurationSeconds: totalDurationToday, avgDurationSeconds: endedToday > 0 ? Math.round(totalDurationToday / endedToday) : 0 },
      thisWeek:  weekResult.count  ?? 0,
      thisMonth: monthResult.count ?? 0,
      allTime:   totalResult.count ?? 0,
    }
  }),

  hasCustomVapiKey: protectedProcedure.query(async ({ ctx }) => {
    const key = await getOrgVapiKey(ctx.supabase, ctx.userOrgId)
    return { hasCustomKey: Boolean(key) }
  }),

  getPublicKey: protectedProcedure.query(() => {
    const publicKey = process.env.VAPI_PUBLIC_KEY
    if (!publicKey) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'VAPI_PUBLIC_KEY not configured.' })
    return { publicKey }
  }),

  // ── WRITE — admin only ────────────────────────────────────────────────────

  upsertAssistantConfig: protectedProcedure
    .input(z.object({
      name:               z.string().min(1).max(80).optional(),
      firstMessage:       z.string().min(1).max(500).optional(),
      systemPrompt:       z.string().max(4000).optional(),
      voiceId:            z.string().min(1).max(100).optional(),
      model:              z.string().min(1).max(50).optional(),
      maxDurationSeconds: z.number().int().min(60).max(3600).optional(),
      backgroundSound:    z.enum(['off', 'office', 'cafe']).optional(),
      isActive:           z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)
      await requireFeature(ctx.supabase, ctx.userOrgId, 'voiceCalls')

      const orgId = ctx.userOrgId

      const { data: org } = await ctx.supabase.from('organizations').select('name').eq('id', orgId).single()
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found.' })

      const { data: widgetCfg } = await ctx.supabase.from('widget_configs').select('company_name').eq('org_id', orgId).maybeSingle()
      const companyName = (widgetCfg?.company_name as string | null) || org.name

      const { data: existing } = await ctx.supabase.from('vapi_assistants').select('*').eq('org_id', orgId).maybeSingle()
      const orgVapiKey = await getOrgVapiKey(ctx.supabase, orgId)

      const webhookBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`
      const webhookSecret = process.env.VAPI_WEBHOOK_SECRET || 'tinfin-vapi-secret'

      const finalName         = input.name           ?? (existing?.name as string | null)           ?? 'Support Assistant'
      const finalFirstMessage = input.firstMessage   ?? (existing?.first_message as string | null)  ?? undefined
      const finalSystemPrompt = input.systemPrompt   ?? (existing?.system_prompt as string | null)  ?? undefined
      const finalVoiceId      = input.voiceId        ?? (existing?.voice as string | null)          ?? DEFAULT_VOICE_ID
      const finalModel        = (input.model         ?? (existing?.model as string | null)          ?? 'gpt-4o-mini') as VapiModel
      const finalMaxDuration  = input.maxDurationSeconds ?? (existing?.max_duration_seconds as number | null) ?? 600
      const finalBgSound      = input.backgroundSound    ?? (existing?.background_sound as 'off' | 'office' | 'cafe' | null) ?? 'off'

      const payload = buildOrgAssistantPayload({
        name: finalName, companyName,
        firstMessage: finalFirstMessage,
        systemPrompt: finalSystemPrompt,
        voiceId: finalVoiceId,
        model: finalModel,
        maxDurationSeconds: finalMaxDuration,
        backgroundSound: finalBgSound,
        orgId, webhookBaseUrl, webhookSecret,
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
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to sync with Vapi: ${err instanceof Error ? err.message : 'Unknown error'}` })
      }

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
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await ctx.supabase.from('vapi_assistants').upsert(upsertPayload, { onConflict: 'org_id' }).select().single()
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `DB upsert failed: ${error.message}` })

      return data
    }),

  deleteAssistant: protectedProcedure.mutation(async ({ ctx }) => {
    await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)

    const orgId = ctx.userOrgId
    const { data: existing } = await ctx.supabase.from('vapi_assistants').select('vapi_assistant_id').eq('org_id', orgId).maybeSingle()
    if (!existing) return { success: true }

    const vapiAssistantId = existing.vapi_assistant_id as string | null
    const orgVapiKey = await getOrgVapiKey(ctx.supabase, orgId)

    if (vapiAssistantId) {
      try { await deleteVapiAssistant(vapiAssistantId, orgVapiKey) } catch (err) { console.warn('[vapi.router] Could not delete Vapi assistant:', err) }
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
    await ctx.supabase.from('org_api_keys').update({ vapi_key_encrypted: null }).eq('org_id', ctx.userOrgId)
    return { success: true }
  }),

  syncCallsFromVapi: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .mutation(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)

      const orgId = ctx.userOrgId
      const { data: assistantRow } = await ctx.supabase.from('vapi_assistants').select('vapi_assistant_id').eq('org_id', orgId).maybeSingle()
      if (!assistantRow?.vapi_assistant_id) return { synced: 0 }

      const orgVapiKey = await getOrgVapiKey(ctx.supabase, orgId)

      let vapiCalls
      try {
        vapiCalls = await listVapiCalls({ assistantId: assistantRow.vapi_assistant_id as string, limit: input.limit }, orgVapiKey)
      } catch (err) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Vapi sync failed: ${err instanceof Error ? err.message : 'Unknown error'}` })
      }

      let synced = 0
      for (const call of vapiCalls) {
        const durationSeconds = call.endedAt && call.startedAt
          ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
          : (call.durationSeconds ?? call.duration ?? null)

        const status = (call.endedAt || call.endedReason)
          ? 'ended'
          : call.status

        const metadata = buildCallMetadata(call as {
          metadata?: Record<string, unknown>
          assistant?: { metadata?: Record<string, unknown> }
          assistantOverrides?: { metadata?: Record<string, unknown>; variableValues?: Record<string, unknown> }
        })
        const visitorId = pickMetaString(metadata, ['visitorId', 'visitor_id'])
        const startedAt = call.startedAt ?? call.createdAt ?? null
        const endedAt = call.endedAt ?? (status === 'ended' ? call.updatedAt : null)

        const { data: upserted, error } = await ctx.supabase.from('calls').upsert({
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
          cost_cents: call.cost !== undefined && call.cost !== null ? String(Math.round(call.cost * 100)) : null,
          ended_reason: call.endedReason ?? null,
          caller_number: call.customer?.number ?? null,
          visitor_id: visitorId,
          metadata,
          started_at: startedAt,
          ended_at: endedAt,
        }, { onConflict: 'vapi_call_id' }).select('id').single()

        if (!error && upserted?.id) {
          synced++
          // Also try to link to a contact so "Unknown" calls get resolved
          await linkCallToContact(ctx.supabase, orgId, upserted.id as string, {
            metadata,
            customer: call.customer ?? null,
            type: call.type,
          })
        }
      }

      return { synced }
    }),
})
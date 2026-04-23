/**
 * apps/api/src/routes/vapi-webhook.route.ts
 *
 * Vapi webhook handler for call lifecycle events.
 *
 * Key behaviors:
 * - Accepts x-vapi-secret as plain text serverUrlSecret.
 * - Preserves previously stored call fields when partial events arrive.
 * - Forces ended status on end-of-call-report and derives duration safely.
 * - Links calls to contacts and conversations using metadata + fallback matching.
 */

import { Router, type Request, type Response } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { VapiWebhookEvent } from '@workspace/ai'

export const vapiWebhookRoute: Router = Router()

// ─── Supabase admin client (service role) ─────────────────────────────────────

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface VapiCallPayload {
  id: string
  assistantId?: string
  phoneNumberId?: string
  status?: string
  type?: string
  startedAt?: string
  endedAt?: string
  durationSeconds?: number
  duration?: number
  endedReason?: string
  cost?: number
  costBreakdown?: Record<string, unknown>
  transcript?: string
  summary?: string
  recordingUrl?: string
  stereoRecordingUrl?: string
  customer?: {
    number?: string
    name?: string
    email?: string
  }
  assistant?: {
    metadata?: Record<string, unknown>
  }
  assistantOverrides?: {
    metadata?: Record<string, unknown>
    variableValues?: Record<string, unknown>
  }
  metadata?: {
    orgId?: string
    org_id?: string
    visitorId?: string
    visitor_id?: string
    conversationId?: string
    conversation_id?: string
    contactId?: string
    contact_id?: string
    [key: string]: unknown
  }
  createdAt?: string
}

interface ExistingCallRow {
  id: string
  created_at: string | null
  status: string | null
  type: string | null
  direction: string | null
  duration_seconds: number | null
  recording_url: string | null
  stereo_recording_url: string | null
  transcript: string | null
  summary: string | null
  cost_cents: string | null
  cost_breakdown: Record<string, unknown> | null
  ended_reason: string | null
  caller_number: string | null
  visitor_id: string | null
  started_at: string | null
  ended_at: string | null
  metadata: Record<string, unknown> | null
  vapi_assistant_id: string | null
  phone_number_id: string | null
}

const ACTIVE_STATUSES = new Set(['created', 'queued', 'ringing', 'in-progress', 'forwarding'])

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

function asNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    const parsed = asString(value)
    if (parsed) return parsed
  }
  return null
}

function firstNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    const parsed = asNumber(value)
    if (parsed !== null) return parsed
  }
  return null
}

function normalizeStatus(value: unknown): string | null {
  const raw = asString(value)
  if (!raw) return null
  const next = raw.toLowerCase()
  if (next === 'inprogress') return 'in-progress'
  if (next === 'completed') return 'ended'
  return next
}

function computeDurationSeconds(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null
  const startMs = new Date(startedAt).getTime()
  const endMs = new Date(endedAt).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
  const secs = Math.round((endMs - startMs) / 1000)
  return secs >= 0 ? secs : null
}

function isUuid(value: string | null): value is string {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function getMetadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const parsed = asString(metadata[key])
    if (parsed) return parsed
  }
  return null
}

function extractCallMetadata(call: VapiCallPayload): Record<string, unknown> {
  const assistantMetadata = asRecord(call.assistant?.metadata)
  const overrides = asRecord(call.assistantOverrides)
  const overrideMetadata = asRecord(overrides.metadata)
  const variableValues = asRecord(overrides.variableValues)
  const callMetadata = asRecord(call.metadata)

  // Order matters: explicit call metadata should win over inherited values.
  return {
    ...assistantMetadata,
    ...overrideMetadata,
    ...variableValues,
    ...callMetadata,
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function upsertCall(
  supabase: SupabaseClient,
  orgId: string,
  call: VapiCallPayload,
  options: { eventType: string; eventTimestamp?: string | null; overrides?: Record<string, unknown> }
): Promise<string | null> {
  const overrides = options.overrides ?? {}

  const { data: existing } = await supabase
    .from('calls')
    .select('id, created_at, status, type, direction, duration_seconds, recording_url, stereo_recording_url, transcript, summary, cost_cents, cost_breakdown, ended_reason, caller_number, visitor_id, started_at, ended_at, metadata, vapi_assistant_id, phone_number_id')
    .eq('org_id', orgId)
    .eq('vapi_call_id', call.id)
    .maybeSingle<ExistingCallRow>()

  const eventTimestamp = asString(options.eventTimestamp)

  let startedAt = firstString(call.startedAt, existing?.started_at)
  let endedAt = firstString(call.endedAt, existing?.ended_at)

  let status = normalizeStatus(overrides.status) ?? normalizeStatus(call.status) ?? normalizeStatus(existing?.status) ?? 'created'
  if (!normalizeStatus(overrides.status) && (endedAt || firstString(call.endedReason, overrides.ended_reason))) {
    status = 'ended'
  }

  if (normalizeStatus(existing?.status) === 'ended' && ACTIVE_STATUSES.has(status)) {
    status = 'ended'
  }

  if (!startedAt && status === 'in-progress' && eventTimestamp) {
    startedAt = eventTimestamp
  }
  if (!endedAt && status === 'ended' && eventTimestamp) {
    endedAt = eventTimestamp
  }
  if (!startedAt && status === 'ended') {
    startedAt = firstString(existing?.started_at, existing?.created_at)
  }

  let durationSeconds = computeDurationSeconds(startedAt, endedAt)
  if (durationSeconds === null) {
    durationSeconds = firstNumber(call.durationSeconds, call.duration, existing?.duration_seconds)
  }
  if (status === 'ended' && durationSeconds === null) {
    durationSeconds = computeDurationSeconds(existing?.started_at ?? null, endedAt)
  }

  const metadataFromCall = extractCallMetadata(call)
  const metadataFromExisting = asRecord(existing?.metadata)

  const payload = {
    org_id: orgId,
    vapi_call_id: call.id,
    vapi_assistant_id: firstString(call.assistantId, existing?.vapi_assistant_id),
    phone_number_id: firstString(call.phoneNumberId, existing?.phone_number_id),
    status,
    type: firstString(call.type, existing?.type, 'webCall'),
    direction: firstString(
      overrides.direction,
      call.type === 'outboundPhoneCall' ? 'outbound' : call.type ? 'inbound' : null,
      existing?.direction,
      'inbound'
    ),
    duration_seconds: durationSeconds,
    recording_url: firstString(call.recordingUrl, existing?.recording_url),
    stereo_recording_url: firstString(call.stereoRecordingUrl, existing?.stereo_recording_url),
    transcript: firstString(call.transcript, existing?.transcript),
    summary: firstString(call.summary, existing?.summary),
    cost_cents: call.cost !== undefined && call.cost !== null
      ? String(Math.round(call.cost * 100))
      : existing?.cost_cents ?? null,
    cost_breakdown: call.costBreakdown ?? existing?.cost_breakdown ?? null,
    ended_reason: firstString(call.endedReason, overrides.ended_reason, existing?.ended_reason),
    caller_number: firstString(call.customer?.number, existing?.caller_number),
    visitor_id: firstString(
      getMetadataString(metadataFromCall, ['visitorId', 'visitor_id']),
      existing?.visitor_id
    ),
    metadata: {
      ...metadataFromExisting,
      ...metadataFromCall,
      last_event_type: options.eventType,
      last_event_at: new Date().toISOString(),
    },
    started_at: startedAt,
    ended_at: endedAt,
    ...overrides,
  }

  const { data, error } = await supabase
    .from('calls')
    .upsert(payload, { onConflict: 'vapi_call_id' })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[vapi-webhook] DB upsert error:', error.message)
    return existing?.id ?? null
  }

  return (data?.id as string | undefined) ?? existing?.id ?? null
}

/**
 * Resolve orgId from call metadata or assistant_id → vapi_assistants lookup.
 */
async function resolveOrgId(
  supabase: SupabaseClient,
  call: VapiCallPayload
): Promise<string | null> {
  const metadata = extractCallMetadata(call)
  const metadataOrgId = firstString(metadata.orgId, metadata.org_id)
  if (metadataOrgId) {
    return metadataOrgId
  }

  if (call.assistantId) {
    const { data } = await supabase
      .from('vapi_assistants')
      .select('org_id')
      .eq('vapi_assistant_id', call.assistantId)
      .maybeSingle()

    if (data?.org_id) return data.org_id as string
  }

  const { data: existing } = await supabase
    .from('calls')
    .select('org_id')
    .eq('vapi_call_id', call.id)
    .maybeSingle()

  return existing?.org_id ?? null
}

/**
 * Try to link a call to a contact/conversation from visitor context.
 */
async function linkCallToContext(
  supabase: SupabaseClient,
  orgId: string,
  callId: string,
  call: VapiCallPayload
): Promise<void> {
  const metadata = extractCallMetadata(call)
  const visitorId = getMetadataString(metadata, ['visitorId', 'visitor_id'])
  const metadataConversationId = getMetadataString(metadata, ['conversationId', 'conversation_id'])
  const metadataContactId = getMetadataString(metadata, ['contactId', 'contact_id'])
  const callerNumber = call.customer?.number
  const callerName = call.customer?.name
  const callerEmail = call.customer?.email

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

  // Try visitor ID first (web calls from widget)
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

  // Try phone number (PSTN calls)
  if (!contactId && callerNumber) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('phone', callerNumber)
      .order('created_at', { ascending: false })
      .limit(1)

    contactId = (data?.[0]?.id as string | undefined) ?? null

    // Create contact if new phone caller
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

  // Try email if still no match
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

  if (!conversationId && contactId && (call.type === 'webCall' || call.type === 'vapi.websocketCall')) {
    const { data: conversationRows } = await supabase
      .from('conversations')
      .select('id')
      .eq('org_id', orgId)
      .eq('contact_id', contactId)
      .order('started_at', { ascending: false })
      .limit(1)

    conversationId = (conversationRows?.[0]?.id as string | undefined) ?? null
  }

  const updatePatch: Record<string, unknown> = {}
  if (contactId) updatePatch.contact_id = contactId
  if (conversationId) updatePatch.conversation_id = conversationId
  if (visitorId) updatePatch.visitor_id = visitorId

  if (Object.keys(updatePatch).length > 0) {
    await supabase
      .from('calls')
      .update(updatePatch)
      .eq('id', callId)
      .eq('org_id', orgId)

    console.log('[vapi-webhook] Linked call context', {
      callId,
      contactId,
      conversationId,
      visitorId,
    })
  }
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

vapiWebhookRoute.post(
  '/',
  async (req: Request & { rawBody?: string }, res: Response) => {
    const rawBody: string = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

    // ── Signature verification ──────────────────────────────────────────────
    // IMPORTANT: Vapi sends serverUrlSecret as a PLAIN TEXT string in the
    // x-vapi-secret header — it is NOT HMAC. Simple string comparison only.
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET
    const signature = req.headers['x-vapi-secret'] as string | undefined

    if (webhookSecret) {
      if (!signature) {
        // No header — allow in dev (ngrok), reject in production
        if (process.env.NODE_ENV === 'production') {
          console.warn('[vapi-webhook] Missing x-vapi-secret header — rejecting')
          return res.status(401).json({ error: 'Missing signature' })
        }
        console.warn('[vapi-webhook] Missing x-vapi-secret (dev/ngrok — allowing)')
      } else if (signature.trim() !== webhookSecret.trim()) {
        console.warn('[vapi-webhook] Invalid x-vapi-secret — rejecting')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    // Respond immediately — Vapi retries on non-200
    res.status(200).json({ received: true })

    // ── Process event ───────────────────────────────────────────────────────
    const event = req.body as VapiWebhookEvent
    const message = event?.message
    if (!message) return

    const call = message.call as VapiCallPayload | undefined
    if (!call?.id) return

    const supabase = getSupabase()
    const orgId = await resolveOrgId(supabase, call)
    if (!orgId) {
      console.warn('[vapi-webhook] Could not resolve orgId for call', call.id)
      return
    }

    const eventType = message.type
    const eventTimestamp = asString(message.timestamp)

    try {
      switch (eventType) {
        case 'status-update': {
          const callRowId = await upsertCall(supabase, orgId, call, { eventType, eventTimestamp })
          if (callRowId) {
            await linkCallToContext(supabase, orgId, callRowId, call)
          }
          console.log(`[vapi-webhook] status-update: ${call.id} → ${call.status}`)
          break
        }

        case 'end-of-call-report': {
          const artifact = message.artifact

          const callRowId = await upsertCall(supabase, orgId, {
            ...call,
            transcript: artifact?.transcript ?? call.transcript,
            recordingUrl: artifact?.recordingUrl ?? call.recordingUrl,
            stereoRecordingUrl: artifact?.stereoRecordingUrl ?? call.stereoRecordingUrl,
            summary: message.summary ?? call.summary,
            endedReason: message.endedReason ?? call.endedReason,
            cost: message.cost ?? call.cost,
            costBreakdown: (message.costBreakdown as Record<string, unknown>) ?? call.costBreakdown,
          }, {
            eventType,
            eventTimestamp,
            overrides: {
              status: 'ended',
            },
          })

          if (callRowId) {
            await linkCallToContext(supabase, orgId, callRowId, call)
          }

          const duration = computeDurationSeconds(call.startedAt ?? null, call.endedAt ?? null) ?? '?'
          console.log(`[vapi-webhook] end-of-call-report: ${call.id}, duration=${duration}s`)
          break
        }

        case 'hang': {
          const callRowId = await upsertCall(supabase, orgId, call, {
            eventType,
            eventTimestamp,
            overrides: { status: 'ended', ended_reason: 'hang' },
          })
          if (callRowId) {
            await linkCallToContext(supabase, orgId, callRowId, call)
          }
          break
        }

        default: {
          // speech-update, transcript, etc. — no DB action needed
          break
        }
      }
    } catch (err) {
      console.error('[vapi-webhook] Processing error:', err)
    }
  }
)
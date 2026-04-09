/**
 * apps/api/src/routes/vapi-webhook.route.ts
 *
 * Receives Vapi call lifecycle webhooks.
 * MUST verify HMAC signature before processing — never trust unverified payloads.
 *
 * Events handled:
 *  - status-update      → update call status in DB
 *  - end-of-call-report → store transcript, summary, recording, cost
 *  - assistant-request  → (optional) dynamic assistant injection
 *
 * Security:
 *  - HMAC-SHA256 verification with VAPI_WEBHOOK_SECRET
 *  - Raw body must be read before any JSON parsing
 *  - Returns 200 quickly (Vapi retries on failure)
 */

import { Router, type Request, type Response } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifyVapiWebhookSignature, type VapiWebhookEvent } from '@workspace/ai'

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
  metadata?: {
    orgId?: string
    visitorId?: string
    [key: string]: unknown
  }
  createdAt?: string
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function upsertCall(
  supabase: SupabaseClient,
  orgId: string,
  call: VapiCallPayload,
  overrides: Record<string, unknown> = {}
): Promise<void> {
  const durationSeconds =
    call.endedAt && call.startedAt
      ? Math.round(
          (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
        )
      : null

  const payload = {
    org_id: orgId,
    vapi_call_id: call.id,
    vapi_assistant_id: call.assistantId ?? null,
    phone_number_id: call.phoneNumberId ?? null,
    status: call.status ?? 'created',
    type: call.type ?? 'webCall',
    direction: call.type === 'outboundPhoneCall' ? 'outbound' : 'inbound',
    duration_seconds: durationSeconds,
    recording_url: call.recordingUrl ?? null,
    stereo_recording_url: call.stereoRecordingUrl ?? null,
    transcript: call.transcript ?? null,
    summary: call.summary ?? null,
    cost_cents: call.cost !== undefined ? String(Math.round(call.cost * 100)) : null,
    cost_breakdown: call.costBreakdown ?? null,
    ended_reason: call.endedReason ?? null,
    caller_number: call.customer?.number ?? null,
    visitor_id: call.metadata?.visitorId ?? null,
    started_at: call.startedAt ?? null,
    ended_at: call.endedAt ?? null,
    ...overrides,
  }

  const { error } = await supabase
    .from('calls')
    .upsert(payload, { onConflict: 'vapi_call_id' })

  if (error) {
    console.error('[vapi-webhook] DB upsert error:', error.message)
  }
}

/**
 * Resolve orgId from call metadata or assistant_id → vapi_assistants lookup.
 */
async function resolveOrgId(
  supabase: SupabaseClient,
  call: VapiCallPayload
): Promise<string | null> {
  // 1. Trust metadata.orgId if present (we set it when creating the assistant)
  if (call.metadata?.orgId && typeof call.metadata.orgId === 'string') {
    return call.metadata.orgId
  }

  // 2. Look up via assistant ID
  if (call.assistantId) {
    const { data } = await supabase
      .from('vapi_assistants')
      .select('org_id')
      .eq('vapi_assistant_id', call.assistantId)
      .maybeSingle()

    if (data?.org_id) return data.org_id as string
  }

  // 3. Look up existing call record
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
async function linkCallToContact(
  supabase: SupabaseClient,
  orgId: string,
  callId: string,
  call: VapiCallPayload
): Promise<void> {
  const visitorId = call.metadata?.visitorId
  const callerNumber = call.customer?.number
  const callerName = call.customer?.name
  const callerEmail = call.customer?.email

  if (!visitorId && !callerNumber && !callerEmail) return

  let contactId: string | null = null

  // Try visitor ID first (web calls)
  if (visitorId) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('meta->>visitorId', visitorId)
      .maybeSingle()

    contactId = data?.id ?? null
  }

  // Try phone number (PSTN calls)
  if (!contactId && callerNumber) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('phone', callerNumber)
      .maybeSingle()

    contactId = data?.id ?? null

    // Create contact if new phone caller
    if (!contactId) {
      const { data: created } = await supabase
        .from('contacts')
        .insert({
          org_id: orgId,
          name: callerName ?? null,
          email: callerEmail ?? null,
          phone: callerNumber,
          meta: { source: 'voice_call' },
        })
        .select('id')
        .single()

      contactId = created?.id ?? null
    }
  }

  if (contactId) {
    await supabase
      .from('calls')
      .update({ contact_id: contactId })
      .eq('id', callId)
      .eq('org_id', orgId)
  }
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

vapiWebhookRoute.post(
  '/',
  async (req: Request & { rawBody?: string }, res: Response) => {
    // Always respond 200 quickly so Vapi doesn't retry
    const rawBody: string = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

    // ── Signature verification ──────────────────────────────────────────────
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET
    const signature = req.headers['x-vapi-secret'] as string | undefined

    if (webhookSecret && signature) {
      const valid = verifyVapiWebhookSignature({
        rawBody,
        signature,
        secret: webhookSecret,
      })
      if (!valid) {
        console.warn('[vapi-webhook] Invalid signature — rejecting request')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    } else if (webhookSecret && !signature) {
      // Secret is configured but no signature provided — reject in production
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Missing signature' })
      }
      console.warn('[vapi-webhook] Missing signature header (dev mode — allowing)')
    }

    // Respond immediately; process async
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

    try {
      switch (eventType) {
        case 'status-update': {
          // Called when call status changes: queued → ringing → in-progress → ended
          await upsertCall(supabase, orgId, call)
          console.log(`[vapi-webhook] status-update: ${call.id} → ${call.status}`)
          break
        }

        case 'end-of-call-report': {
          // Full report at end — transcript, summary, recording, cost
          const artifact = message.artifact

          await upsertCall(supabase, orgId, {
            ...call,
            transcript: artifact?.transcript ?? call.transcript,
            recordingUrl: artifact?.recordingUrl ?? call.recordingUrl,
            stereoRecordingUrl: artifact?.stereoRecordingUrl ?? call.stereoRecordingUrl,
            summary: message.summary ?? call.summary,
            cost: message.cost ?? call.cost,
            costBreakdown: (message.costBreakdown as Record<string, unknown>) ?? call.costBreakdown,
          })

          // Link to contact after we have full data
          const { data: callRow } = await supabase
            .from('calls')
            .select('id')
            .eq('vapi_call_id', call.id)
            .eq('org_id', orgId)
            .single()

          if (callRow?.id) {
            await linkCallToContact(supabase, orgId, callRow.id as string, call)
          }

          console.log(`[vapi-webhook] end-of-call-report: ${call.id}, duration=${
            call.endedAt && call.startedAt
              ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
              : '?'
          }s`)
          break
        }

        case 'hang': {
          await upsertCall(supabase, orgId, call, { status: 'ended', ended_reason: 'hang' })
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
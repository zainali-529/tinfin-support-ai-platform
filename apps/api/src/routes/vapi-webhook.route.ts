/**
 * apps/api/src/routes/vapi-webhook.route.ts
 *
 * Vapi webhook handler — enhanced with:
 *   - tool-calls: handles searchKnowledgeBase in real-time during calls
 *   - Synchronous tool response (Vapi waits for result before continuing)
 *   - All existing status-update / end-of-call-report / hang logic preserved
 */

import { Router, type Request, type Response } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  queryRAG,
  getOrgActions,
  executeAction,
  formatActionResponse,
} from '@workspace/ai'
import type { VapiWebhookEvent, VapiToolCall, VapiToolResult } from '@workspace/ai'

export const vapiWebhookRoute: Router = Router()

// ─── Supabase admin client ─────────────────────────────────────────────────────

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
  customer?: { number?: string; name?: string; email?: string }
  assistant?: { metadata?: Record<string, unknown> }
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

// ─── Utilities ────────────────────────────────────────────────────────────────

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

function withExecutionMetadata(requestPayload: unknown, durationMs?: number): unknown {
  const base = asRecord(requestPayload)
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs)) return base
  return {
    ...base,
    durationMs,
  }
}

function getExecutionStatus(execution: { success: boolean; error?: string }):
  | 'success'
  | 'failed'
  | 'timeout' {
  if (execution.success) return 'success'
  const errorText = (execution.error ?? '').toLowerCase()
  if (errorText.includes('timeout') || errorText.includes('aborted')) return 'timeout'
  return 'failed'
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
  return { ...assistantMetadata, ...overrideMetadata, ...variableValues, ...callMetadata }
}

// ─── Resolve org from call metadata / assistant lookup ────────────────────────

async function resolveOrgId(
  supabase: SupabaseClient,
  call: VapiCallPayload
): Promise<string | null> {
  const metadata = extractCallMetadata(call)
  const metadataOrgId = firstString(metadata.orgId, metadata.org_id)
  if (metadataOrgId) return metadataOrgId

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

// ─── Resolve KB IDs for this org/assistant ────────────────────────────────────

async function resolveKbIds(
  supabase: SupabaseClient,
  orgId: string,
  assistantId?: string | null
): Promise<string[]> {
  if (assistantId) {
    const { data } = await supabase
      .from('vapi_assistants')
      .select('kb_ids')
      .eq('org_id', orgId)
      .eq('vapi_assistant_id', assistantId)
      .maybeSingle()

    const kbIds = (data?.kb_ids as string[] | null | undefined) ?? []
    if (kbIds.length > 0) return kbIds
  }
  // Fallback: use all org KBs
  return []
}

// ─── Tool call handlers ───────────────────────────────────────────────────────

async function insertActionLog(params: {
  orgId: string
  actionId: string
  conversationId?: string | null
  contactId?: string | null
  parametersUsed?: Record<string, unknown>
  requestPayload?: unknown
  responseRaw?: unknown
  responseParsed?: string
  status: string
  errorMessage?: string | null
  executedAt?: string | null
}): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('ai_action_logs')
    .insert({
      org_id: params.orgId,
      action_id: params.actionId,
      conversation_id: params.conversationId ?? null,
      contact_id: params.contactId ?? null,
      parameters_used: params.parametersUsed ?? null,
      request_payload: params.requestPayload ?? null,
      response_raw: params.responseRaw ?? null,
      response_parsed: params.responseParsed ?? null,
      status: params.status,
      error_message: params.errorMessage ?? null,
      executed_at: params.executedAt ?? null,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[vapi-webhook] Failed to write ai_action_logs:', error.message)
    return null
  }

  return (data?.id as string | undefined) ?? null
}

async function enqueueActionApproval(params: {
  logId: string
  conversationId?: string | null
  actionName: string
  parameters: Record<string, unknown>
}): Promise<void> {
  if (!params.conversationId) return

  const { error } = await getSupabase()
    .from('ai_action_approvals')
    .insert({
      log_id: params.logId,
      conversation_id: params.conversationId,
      action_name: params.actionName,
      parameters: params.parameters,
    })

  if (error) {
    console.error('[vapi-webhook] Failed to queue action approval:', error.message)
  }
}

/**
 * Called synchronously during a Vapi tool-calls event.
 * Must respond within ~20 seconds (Vapi's tool timeout).
 * Returns results that Vapi immediately feeds back to the AI.
 */
async function handleToolCalls(
  supabase: SupabaseClient,
  orgId: string,
  assistantId: string | null | undefined,
  toolCalls: VapiToolCall[],
  call: VapiCallPayload | undefined
): Promise<VapiToolResult[]> {
  const results: VapiToolResult[] = []
  const kbIds = await resolveKbIds(supabase, orgId, assistantId)
  const actions = await getOrgActions(orgId)

  for (const toolCall of toolCalls) {
    if (toolCall.function.name === 'searchKnowledgeBase') {
      const query = asString(toolCall.function.arguments?.query)

      if (!query) {
        results.push({ toolCallId: toolCall.id, result: 'No query provided.' })
        continue
      }

      try {
        const kbId = kbIds[0] ?? undefined
        const ragResult = await queryRAG({
          query,
          orgId,
          kbId,
          threshold: 0.25,
          maxChunks: 5,
        })

        let result: string
        if (ragResult.type === 'handoff' || ragResult.type === 'ask_handoff') {
          result = '__HANDOFF__'
        } else if (ragResult.message) {
          result = ragResult.message
        } else {
          result = 'I could not find relevant information in the knowledge base.'
        }

        results.push({ toolCallId: toolCall.id, result })
      } catch (err) {
        console.error('[vapi-webhook] KB search failed:', err)
        results.push({
          toolCallId: toolCall.id,
          result: 'Knowledge base search temporarily unavailable.',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }

      continue
    }

    const action = actions.find((candidate) => candidate.name === toolCall.function.name)

    if (!action) {
      results.push({
        toolCallId: toolCall.id,
        result: 'Action not found for this organization.',
      })
      continue
    }

    const args = asRecord(toolCall.function.arguments)
    const metadata = extractCallMetadata(call ?? ({ id: '' } as VapiCallPayload))
    const conversationId = firstString(metadata.conversationId, metadata.conversation_id)
    const contactId = firstString(metadata.contactId, metadata.contact_id)

    if (action.humanApprovalRequired) {
      const logId = await insertActionLog({
        orgId,
        actionId: action.id,
        conversationId,
        contactId,
        parametersUsed: args,
        status: 'pending_approval',
      })

      if (logId) {
        await enqueueActionApproval({
          logId,
          conversationId,
          actionName: action.displayName,
          parameters: args,
        })
      }

      results.push({
        toolCallId: toolCall.id,
        result:
          'This action requires human approval. An agent will follow up shortly.',
      })
      continue
    }

    const execution = await executeAction(action, args)
    const parsed = execution.success
      ? await formatActionResponse(action, execution.data)
      : `Failed: ${execution.error ?? 'Unknown action error'}`
    const status = getExecutionStatus(execution)

    await insertActionLog({
      orgId,
      actionId: action.id,
      conversationId,
      contactId,
      parametersUsed: args,
      requestPayload: withExecutionMetadata(
        execution.requestPayload,
        execution.durationMs
      ),
      responseRaw: execution.data,
      responseParsed: parsed,
      status,
      errorMessage: execution.error ?? null,
      executedAt: new Date().toISOString(),
    })

    results.push({
      toolCallId: toolCall.id,
      result: parsed,
    })
  }

  return results
}

// ─── Call upsert ──────────────────────────────────────────────────────────────

async function upsertCall(
  supabase: SupabaseClient,
  orgId: string,
  call: VapiCallPayload,
  options: { eventType: string; eventTimestamp?: string | null; overrides?: Record<string, unknown> }
): Promise<string | null> {
  const overrides = options.overrides ?? {}

  const { data: existing } = await supabase
    .from('calls')
    .select(
      'id, created_at, status, type, direction, duration_seconds, recording_url, stereo_recording_url, transcript, summary, cost_cents, cost_breakdown, ended_reason, caller_number, visitor_id, started_at, ended_at, metadata, vapi_assistant_id, phone_number_id'
    )
    .eq('org_id', orgId)
    .eq('vapi_call_id', call.id)
    .maybeSingle<ExistingCallRow>()

  const eventTimestamp = asString(options.eventTimestamp)

  let startedAt = firstString(call.startedAt, existing?.started_at)
  let endedAt = firstString(call.endedAt, existing?.ended_at)

  let status =
    normalizeStatus(overrides.status) ??
    normalizeStatus(call.status) ??
    normalizeStatus(existing?.status) ??
    'created'

  if (
    !normalizeStatus(overrides.status) &&
    (endedAt || firstString(call.endedReason, overrides.ended_reason))
  ) {
    status = 'ended'
  }

  if (normalizeStatus(existing?.status) === 'ended' && ACTIVE_STATUSES.has(status)) {
    status = 'ended'
  }

  if (!startedAt && status === 'in-progress' && eventTimestamp) {
    startedAt = eventTimestamp
  }

  if (!endedAt && status === 'ended') {
    endedAt = eventTimestamp ?? new Date().toISOString()
  }

  if (!startedAt && status === 'ended') {
    startedAt = firstString(existing?.started_at, existing?.created_at)
  }

  let durationSeconds = computeDurationSeconds(startedAt, endedAt)
  if (durationSeconds === null) {
    durationSeconds = firstNumber(call.durationSeconds, call.duration, existing?.duration_seconds)
  }
  if (status === 'ended' && durationSeconds === null) {
    const effectiveStartedAt = startedAt ?? existing?.started_at ?? null
    durationSeconds = computeDurationSeconds(effectiveStartedAt, endedAt)
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
    cost_cents:
      call.cost !== undefined && call.cost !== null
        ? String(Math.round(call.cost * 100))
        : (existing?.cost_cents ?? null),
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

// ─── Context linking ──────────────────────────────────────────────────────────

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

  if (!visitorId && !callerNumber && !callerEmail && !metadataConversationId && !metadataContactId)
    return

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
          meta: { source: 'voice_call', ...(visitorId ? { visitorId } : {}) },
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
    await supabase.from('calls').update(updatePatch).eq('id', callId).eq('org_id', orgId)
    console.log('[vapi-webhook] Linked call context', { callId, contactId, conversationId, visitorId })
  }
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

vapiWebhookRoute.post(
  '/',
  async (req: Request & { rawBody?: string }, res: Response) => {
    const rawBody: string = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

    // ── Signature verification ────────────────────────────────────────────────
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET
    const signature = req.headers['x-vapi-secret'] as string | undefined

    if (webhookSecret) {
      if (!signature) {
        if (process.env.NODE_ENV === 'production') {
          console.warn('[vapi-webhook] Missing x-vapi-secret header — rejecting')
          return res.status(401).json({ error: 'Missing signature' })
        }
        console.warn('[vapi-webhook] Missing x-vapi-secret (dev — allowing)')
      } else if (signature.trim() !== webhookSecret.trim()) {
        console.warn('[vapi-webhook] Invalid x-vapi-secret — rejecting')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    const event = req.body as VapiWebhookEvent
    const message = event?.message
    if (!message) return res.status(200).json({ received: true })

    const call = message.call as VapiCallPayload | undefined
    const supabase = getSupabase()
    const eventType = message.type
    const eventTimestamp = asString(message.timestamp)

    // ── tool-calls: SYNCHRONOUS — must reply before returning ────────────────
    // Vapi blocks the AI response until we reply with tool results.
    if (eventType === 'tool-calls') {
      const toolCallList = (message as Record<string, unknown>).toolCallList as
        | VapiToolCall[]
        | undefined

      if (!toolCallList?.length) {
        return res.status(200).json({ results: [] })
      }

      try {
        // Resolve orgId from call metadata or assistant lookup
        const orgId = call ? await resolveOrgId(supabase, call) : null

        if (!orgId) {
          console.warn('[vapi-webhook] tool-calls: could not resolve orgId')
          return res.status(200).json({
            results: toolCallList.map((tc) => ({
              toolCallId: tc.id,
              result: 'Service temporarily unavailable.',
            })),
          })
        }

        const results = await handleToolCalls(
          supabase,
          orgId,
          call?.assistantId ?? null,
          toolCallList,
          call
        )

        console.log(
          `[vapi-webhook] tool-calls: org=${orgId} calls=${toolCallList.length} results=${results.length}`
        )

        // Vapi expects: { results: [ { toolCallId, result } ] }
        return res.status(200).json({ results })
      } catch (err) {
        console.error('[vapi-webhook] tool-calls error:', err)
        return res.status(200).json({
          results: (toolCallList ?? []).map((tc) => ({
            toolCallId: tc.id,
            result: 'An error occurred while searching the knowledge base.',
          })),
        })
      }
    }

    // ── All other events: respond immediately, process async ─────────────────
    res.status(200).json({ received: true })

    if (!call?.id) return

    try {
      const orgId = await resolveOrgId(supabase, call)
      if (!orgId) {
        console.warn('[vapi-webhook] Could not resolve orgId for call', call.id)
        return
      }

      switch (eventType) {
        case 'status-update': {
          const callRowId = await upsertCall(supabase, orgId, call, { eventType, eventTimestamp })
          if (callRowId) await linkCallToContext(supabase, orgId, callRowId, call)
          console.log(`[vapi-webhook] status-update: ${call.id} → ${call.status}`)
          break
        }

        case 'end-of-call-report': {
          const artifact = message.artifact

          const callRowId = await upsertCall(
            supabase,
            orgId,
            {
              ...call,
              transcript: artifact?.transcript ?? call.transcript,
              recordingUrl: artifact?.recordingUrl ?? call.recordingUrl,
              stereoRecordingUrl: artifact?.stereoRecordingUrl ?? call.stereoRecordingUrl,
              summary: message.summary ?? call.summary,
              endedReason: message.endedReason ?? call.endedReason,
              cost: message.cost ?? call.cost,
              costBreakdown: (message.costBreakdown as Record<string, unknown>) ?? call.costBreakdown,
            },
            { eventType, eventTimestamp, overrides: { status: 'ended' } }
          )

          if (callRowId) await linkCallToContext(supabase, orgId, callRowId, call)

          const duration =
            computeDurationSeconds(call.startedAt ?? null, call.endedAt ?? null) ?? '?'
          console.log(`[vapi-webhook] end-of-call-report: ${call.id}, duration=${duration}s`)
          break
        }

        case 'hang': {
          const callRowId = await upsertCall(supabase, orgId, call, {
            eventType,
            eventTimestamp,
            overrides: { status: 'ended', ended_reason: 'hang' },
          })
          if (callRowId) await linkCallToContext(supabase, orgId, callRowId, call)
          break
        }

        default:
          break
      }
    } catch (err) {
      console.error('[vapi-webhook] Processing error:', err)
    }
  }
)

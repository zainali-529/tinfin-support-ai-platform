/**
 * packages/ai/src/vapi.service.ts
 *
 * Server-side Vapi AI Voice API wrapper.
 * NEVER import this in widget/frontend code — it uses the private key.
 *
 * Security model:
 *   - VAPI_PRIVATE_KEY  → server only, manages assistants/calls
 *   - VAPI_PUBLIC_KEY   → safe to ship in widget bundle (read-only, initiates calls)
 *   - Per-org keys      → stored in org_api_keys table
 *
 * ─── VOICE FORMAT ────────────────────────────────────────────────────────────
 * Voices are stored as "{provider}:{voiceId}" e.g. "openai:alloy".
 * We use ":" as separator because Deepgram voice IDs contain hyphens.
 */

import { createHmac, timingSafeEqual } from 'crypto'

const VAPI_BASE_URL = 'https://api.vapi.ai'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VapiVoiceProvider = 'openai' | 'deepgram' | '11labs' | 'azure' | 'cartesia'
export type VapiModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | string

// ─── Curated voice catalogue ──────────────────────────────────────────────────
// Only voices confirmed to work on Vapi without user credentials.
// OpenAI TTS: reliable, Vapi supports all 6 built-in voices.
// Deepgram Aura: ultra-low latency, free on Vapi's platform.

export interface VapiVoiceOption {
  /** Stable ID stored in DB: "{provider}:{voiceId}" */
  id: string
  label: string
  provider: VapiVoiceProvider
  voiceId: string
  gender: 'Male' | 'Female' | 'Neutral'
  accent: string
  description: string
}

export const VAPI_VOICE_CATALOGUE: VapiVoiceOption[] = [
  // ── OpenAI TTS ──────────────────────────────────────────────────────────────
  {
    id: 'openai:alloy',
    label: 'Alloy',
    provider: 'openai',
    voiceId: 'alloy',
    gender: 'Neutral',
    accent: 'American',
    description: 'Balanced, versatile — great default',
  },
  {
    id: 'openai:nova',
    label: 'Nova',
    provider: 'openai',
    voiceId: 'nova',
    gender: 'Female',
    accent: 'American',
    description: 'Friendly and warm',
  },
  {
    id: 'openai:shimmer',
    label: 'Shimmer',
    provider: 'openai',
    voiceId: 'shimmer',
    gender: 'Female',
    accent: 'American',
    description: 'Soft and professional',
  },
  {
    id: 'openai:echo',
    label: 'Echo',
    provider: 'openai',
    voiceId: 'echo',
    gender: 'Male',
    accent: 'American',
    description: 'Clear and confident',
  },
  {
    id: 'openai:onyx',
    label: 'Onyx',
    provider: 'openai',
    voiceId: 'onyx',
    gender: 'Male',
    accent: 'American',
    description: 'Deep and authoritative',
  },
  {
    id: 'openai:fable',
    label: 'Fable',
    provider: 'openai',
    voiceId: 'fable',
    gender: 'Male',
    accent: 'British',
    description: 'Expressive British accent',
  },
  // ── Deepgram Aura (ultra-low latency) ──────────────────────────────────────
  {
    id: 'deepgram:aura-asteria-en',
    label: 'Asteria',
    provider: 'deepgram',
    voiceId: 'aura-asteria-en',
    gender: 'Female',
    accent: 'American',
    description: 'Natural, very low latency',
  },
  {
    id: 'deepgram:aura-luna-en',
    label: 'Luna',
    provider: 'deepgram',
    voiceId: 'aura-luna-en',
    gender: 'Female',
    accent: 'American',
    description: 'Gentle, ultra-fast',
  },
  {
    id: 'deepgram:aura-stella-en',
    label: 'Stella',
    provider: 'deepgram',
    voiceId: 'aura-stella-en',
    gender: 'Female',
    accent: 'American',
    description: 'Bright and cheerful',
  },
  {
    id: 'deepgram:aura-athena-en',
    label: 'Athena',
    provider: 'deepgram',
    voiceId: 'aura-athena-en',
    gender: 'Female',
    accent: 'British',
    description: 'Professional British',
  },
  {
    id: 'deepgram:aura-orion-en',
    label: 'Orion',
    provider: 'deepgram',
    voiceId: 'aura-orion-en',
    gender: 'Male',
    accent: 'American',
    description: 'Clear American male',
  },
  {
    id: 'deepgram:aura-arcas-en',
    label: 'Arcas',
    provider: 'deepgram',
    voiceId: 'aura-arcas-en',
    gender: 'Male',
    accent: 'American',
    description: 'Confident male voice',
  },
  {
    id: 'deepgram:aura-zeus-en',
    label: 'Zeus',
    provider: 'deepgram',
    voiceId: 'aura-zeus-en',
    gender: 'Male',
    accent: 'American',
    description: 'Deep, powerful male',
  },
  {
    id: 'deepgram:aura-helios-en',
    label: 'Helios',
    provider: 'deepgram',
    voiceId: 'aura-helios-en',
    gender: 'Male',
    accent: 'British',
    description: 'Refined British male',
  },
]

export const DEFAULT_VOICE_ID = 'openai:alloy'

/**
 * Parse "provider:voiceId" string into parts.
 * Falls back to default if format is invalid.
 */
export function parseVoiceId(raw: string): { provider: VapiVoiceProvider; voiceId: string } {
  const colonIdx = raw.indexOf(':')
  if (colonIdx === -1) {
    console.warn(`[vapi] Invalid voice format "${raw}", using default openai:alloy`)
    return { provider: 'openai', voiceId: 'alloy' }
  }
  const provider = raw.slice(0, colonIdx) as VapiVoiceProvider
  const voiceId = raw.slice(colonIdx + 1)
  const supported: VapiVoiceProvider[] = ['openai', 'deepgram', '11labs', 'azure', 'cartesia']
  if (!supported.includes(provider) || !voiceId) {
    console.warn(`[vapi] Unsupported voice "${raw}", using default openai:alloy`)
    return { provider: 'openai', voiceId: 'alloy' }
  }
  return { provider, voiceId }
}

// ─── Vapi API payload types ───────────────────────────────────────────────────

/**
 * Correct Vapi v2 assistant payload.
 *
 * CRITICAL: `systemPrompt` does NOT exist at the root level in Vapi v2 API.
 * The system prompt must be placed inside model.messages[0]:
 *   { role: 'system', content: '...' }
 */
export interface VapiAssistantPayload {
  name: string
  firstMessage: string
  model: {
    provider: 'openai' | 'anthropic' | 'together-ai' | 'anyscale' | 'openrouter' | 'groq'
    model: VapiModel
    /** System prompt lives HERE as messages[0] with role: 'system' */
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    maxTokens?: number
    temperature?: number
  }
  voice: {
    provider: VapiVoiceProvider
    voiceId: string
    speed?: number
  }
  endCallMessage?: string
  endCallPhrases?: string[]
  maxDurationSeconds?: number
  backgroundSound?: 'off' | 'office' | 'cafe'
  silenceTimeoutSeconds?: number
  responseDelaySeconds?: number
  backchannelingEnabled?: boolean
  serverUrl?: string
  serverUrlSecret?: string
  metadata?: Record<string, string>
}

export interface VapiAssistant {
  id: string
  name: string
  firstMessage?: string
  model?: Record<string, unknown>
  voice?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface VapiCall {
  id: string
  assistantId?: string
  status: string
  type: string
  startedAt?: string
  endedAt?: string
  cost?: number
  endedReason?: string
  transcript?: string
  summary?: string
  recordingUrl?: string
  stereoRecordingUrl?: string
  phoneNumberId?: string
  customer?: { number?: string; name?: string }
  createdAt: string
  updatedAt: string
}

export interface VapiPhoneNumber {
  id: string
  number: string
  provider: string
  assistantId?: string
  name?: string
  createdAt: string
}

export interface VapiWebhookEvent {
  message: {
    type:
      | 'assistant-request'
      | 'function-call'
      | 'end-of-call-report'
      | 'hang'
      | 'speech-update'
      | 'status-update'
      | 'transcript'
      | 'tool-calls'
      | 'user-interrupted'
      | 'voice-input'
    call?: VapiCall
    artifact?: {
      transcript?: string
      messagesOpenAIFormatted?: Array<{ role: string; content: string }>
      recordingUrl?: string
      stereoRecordingUrl?: string
    }
    endedReason?: string
    cost?: number
    costBreakdown?: Record<string, unknown>
    summary?: string
    timestamp?: string
  }
}

// ─── HTTP Client ──────────────────────────────────────────────────────────────

function resolveApiKey(orgPrivateKey?: string | null): string {
  const key = orgPrivateKey?.trim() || process.env.VAPI_PRIVATE_KEY?.trim()
  if (!key) {
    throw new Error('Vapi private key not configured. Set VAPI_PRIVATE_KEY env var.')
  }
  return key
}

async function vapiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  orgPrivateKey?: string | null
): Promise<T> {
  const key = resolveApiKey(orgPrivateKey)
  const res = await fetch(`${VAPI_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Vapi API ${method} ${path} → ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ─── Assistant CRUD ───────────────────────────────────────────────────────────

export async function createVapiAssistant(
  payload: VapiAssistantPayload,
  orgPrivateKey?: string | null
): Promise<VapiAssistant> {
  return vapiRequest<VapiAssistant>('POST', '/assistant', payload, orgPrivateKey)
}

export async function updateVapiAssistant(
  assistantId: string,
  payload: Partial<VapiAssistantPayload>,
  orgPrivateKey?: string | null
): Promise<VapiAssistant> {
  return vapiRequest<VapiAssistant>('PATCH', `/assistant/${assistantId}`, payload, orgPrivateKey)
}

export async function getVapiAssistant(
  assistantId: string,
  orgPrivateKey?: string | null
): Promise<VapiAssistant> {
  return vapiRequest<VapiAssistant>('GET', `/assistant/${assistantId}`, undefined, orgPrivateKey)
}

export async function deleteVapiAssistant(
  assistantId: string,
  orgPrivateKey?: string | null
): Promise<void> {
  await vapiRequest<void>('DELETE', `/assistant/${assistantId}`, undefined, orgPrivateKey)
}

// ─── Call Management ──────────────────────────────────────────────────────────

export async function getVapiCall(vapiCallId: string, orgPrivateKey?: string | null): Promise<VapiCall> {
  return vapiRequest<VapiCall>('GET', `/call/${vapiCallId}`, undefined, orgPrivateKey)
}

export async function listVapiCalls(
  params: { assistantId?: string; limit?: number; createdAtGt?: string; createdAtLt?: string } = {},
  orgPrivateKey?: string | null
): Promise<VapiCall[]> {
  const qs = new URLSearchParams()
  if (params.assistantId) qs.set('assistantId', params.assistantId)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.createdAtGt) qs.set('createdAtGt', params.createdAtGt)
  if (params.createdAtLt) qs.set('createdAtLt', params.createdAtLt)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return vapiRequest<VapiCall[]>('GET', `/call${query}`, undefined, orgPrivateKey)
}

export async function deleteVapiCall(vapiCallId: string, orgPrivateKey?: string | null): Promise<void> {
  await vapiRequest<void>('DELETE', `/call/${vapiCallId}`, undefined, orgPrivateKey)
}

export async function listVapiPhoneNumbers(orgPrivateKey?: string | null): Promise<VapiPhoneNumber[]> {
  return vapiRequest<VapiPhoneNumber[]>('GET', '/phone-number', undefined, orgPrivateKey)
}

// ─── Assistant Builder ────────────────────────────────────────────────────────

export interface BuildAssistantOptions {
  name: string
  companyName: string
  firstMessage?: string
  /** System prompt text — placed in model.messages[0], never at root */
  systemPrompt?: string
  /** Voice ID in "{provider}:{voiceId}" format, e.g. "openai:alloy" */
  voiceId?: string
  model?: VapiModel
  maxDurationSeconds?: number
  backgroundSound?: 'off' | 'office' | 'cafe'
  orgId: string
  webhookBaseUrl: string
  webhookSecret: string
}

/**
 * Build a correct Vapi v2 assistant payload.
 *
 * ✅ systemPrompt → model.messages[0] with role: 'system'
 * ✅ Voice parsed from "{provider}:{voiceId}" format
 * ✅ No invalid root-level properties
 */
export function buildOrgAssistantPayload(opts: BuildAssistantOptions): VapiAssistantPayload {
  const defaultSystemPrompt = `You are a helpful, professional customer support voice assistant for ${opts.companyName}.
Your job is to answer customer questions clearly, concisely, and warmly.
Be conversational and natural — this is a voice call, not a chat.
Keep answers short (2–3 sentences max) unless the customer asks for more detail.
If you don't know the answer, say so and offer to connect them with a human agent.
Always speak in the same language the customer is using.
Never make up information about pricing, policies, or features.`

  const systemPromptContent = opts.systemPrompt?.trim() || defaultSystemPrompt

  // Parse voice — uses ":" separator to handle Deepgram IDs that contain "-"
  const { provider, voiceId } = parseVoiceId(opts.voiceId ?? DEFAULT_VOICE_ID)

  return {
    name: opts.name,
    firstMessage: opts.firstMessage?.trim() ||
      `Hello! I'm the virtual assistant for ${opts.companyName}. How can I help you today?`,
    model: {
      provider: 'openai',
      model: opts.model ?? 'gpt-4o-mini',
      // ✅ CORRECT: systemPrompt goes inside model.messages — NOT at root
      messages: [
        {
          role: 'system',
          content: systemPromptContent,
        },
      ],
      maxTokens: 256,
      temperature: 0.4,
    },
    voice: {
      provider,
      voiceId,
    },
    endCallMessage: 'Thank you for calling. Have a great day!',
    endCallPhrases: ['goodbye', 'bye', 'thanks bye', "that's all", 'end call'],
    maxDurationSeconds: opts.maxDurationSeconds ?? 600,
    backgroundSound: opts.backgroundSound ?? 'off',
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.4,
    backchannelingEnabled: true,
    serverUrl: `${opts.webhookBaseUrl}/api/vapi-webhook`,
    serverUrlSecret: opts.webhookSecret,
    metadata: {
      orgId: opts.orgId,
      source: 'tinfin',
    },
  }
}

// ─── Webhook Verification ─────────────────────────────────────────────────────

export function verifyVapiWebhookSignature(params: {
  rawBody: string
  signature: string
  secret: string
}): boolean {
  try {
    const { rawBody, signature, secret } = params
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const sigBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex')
    if (expectedBuf.length !== sigBuf.length) return false
    return timingSafeEqual(expectedBuf, sigBuf)
  } catch {
    return false
  }
}

// ─── Call Status Helpers ──────────────────────────────────────────────────────

export type CallStatus = 'created' | 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended'

export function isCallActive(status: string): boolean {
  return ['created', 'queued', 'ringing', 'in-progress'].includes(status)
}

export function formatCallDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
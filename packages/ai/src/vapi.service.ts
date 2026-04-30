/**
 * packages/ai/src/vapi.service.ts
 *
 * FIXES:
 *   - tools moved from assistant root → model.tools (Vapi API requirement)
 *   - silenceTimeoutSeconds minimum raised to 10 (Vapi API requirement)
 *   - artifactPlan kept at root (correct location per Vapi docs)
 */

import { createHmac, timingSafeEqual } from 'crypto'

const VAPI_BASE_URL = 'https://api.vapi.ai'

// ─── Provider types ───────────────────────────────────────────────────────────

export type VapiVoiceProvider = 'openai' | 'deepgram' | '11labs' | 'azure' | 'cartesia'
export type VapiModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | string
export type VapiTranscriptionProvider = 'deepgram' | 'talkscriber' | 'gladia'

// ─── Tool types ───────────────────────────────────────────────────────────────

export interface VapiToolMessage {
  type: 'request-start' | 'request-response-delayed' | 'request-failed' | 'request-complete'
  content: string
  timingMilliseconds?: number
}

export interface VapiToolFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}

/** Tool definition — goes inside model.tools[] NOT at assistant root */
export interface VapiTool {
  type: 'function'
  messages?: VapiToolMessage[]
  function: VapiToolFunction
  server?: {
    url: string
    secret?: string
    timeoutSeconds?: number
  }
}

export interface VapiToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface VapiToolResult {
  toolCallId: string
  result: string
  error?: string
}

// ─── Voice catalogue ──────────────────────────────────────────────────────────

export interface VapiVoiceOption {
  id: string
  label: string
  provider: VapiVoiceProvider
  voiceId: string
  gender: 'Male' | 'Female' | 'Neutral'
  accent: string
  description: string
}

export const VAPI_VOICE_CATALOGUE: VapiVoiceOption[] = [
  { id: 'openai:alloy',   label: 'Alloy',   provider: 'openai',   voiceId: 'alloy',   gender: 'Neutral', accent: 'American', description: 'Balanced, versatile — great default' },
  { id: 'openai:nova',    label: 'Nova',    provider: 'openai',   voiceId: 'nova',    gender: 'Female',  accent: 'American', description: 'Friendly and warm' },
  { id: 'openai:shimmer', label: 'Shimmer', provider: 'openai',   voiceId: 'shimmer', gender: 'Female',  accent: 'American', description: 'Soft and professional' },
  { id: 'openai:echo',    label: 'Echo',    provider: 'openai',   voiceId: 'echo',    gender: 'Male',    accent: 'American', description: 'Clear and confident' },
  { id: 'openai:onyx',    label: 'Onyx',    provider: 'openai',   voiceId: 'onyx',    gender: 'Male',    accent: 'American', description: 'Deep and authoritative' },
  { id: 'openai:fable',   label: 'Fable',   provider: 'openai',   voiceId: 'fable',   gender: 'Male',    accent: 'British',  description: 'Expressive British accent' },
  { id: 'deepgram:aura-asteria-en', label: 'Asteria', provider: 'deepgram', voiceId: 'aura-asteria-en', gender: 'Female', accent: 'American', description: 'Natural, very low latency' },
  { id: 'deepgram:aura-luna-en',    label: 'Luna',    provider: 'deepgram', voiceId: 'aura-luna-en',    gender: 'Female', accent: 'American', description: 'Gentle, ultra-fast' },
  { id: 'deepgram:aura-stella-en',  label: 'Stella',  provider: 'deepgram', voiceId: 'aura-stella-en',  gender: 'Female', accent: 'American', description: 'Bright and cheerful' },
  { id: 'deepgram:aura-athena-en',  label: 'Athena',  provider: 'deepgram', voiceId: 'aura-athena-en',  gender: 'Female', accent: 'British',  description: 'Professional British' },
  { id: 'deepgram:aura-orion-en',   label: 'Orion',   provider: 'deepgram', voiceId: 'aura-orion-en',   gender: 'Male',   accent: 'American', description: 'Clear American male' },
  { id: 'deepgram:aura-arcas-en',   label: 'Arcas',   provider: 'deepgram', voiceId: 'aura-arcas-en',   gender: 'Male',   accent: 'American', description: 'Confident male voice' },
  { id: 'deepgram:aura-zeus-en',    label: 'Zeus',    provider: 'deepgram', voiceId: 'aura-zeus-en',    gender: 'Male',   accent: 'American', description: 'Deep, powerful male' },
  { id: 'deepgram:aura-helios-en',  label: 'Helios',  provider: 'deepgram', voiceId: 'aura-helios-en',  gender: 'Male',   accent: 'British',  description: 'Refined British male' },
]

export const DEFAULT_VOICE_ID = 'openai:alloy'

// ─── Payload types ────────────────────────────────────────────────────────────

export interface VapiTranscriber {
  provider: VapiTranscriptionProvider
  model?: string
  language?: string
  smartFormat?: boolean
  diarize?: boolean
}

export interface VapiArtifactPlan {
  recordingEnabled?: boolean
}

export interface VapiStopSpeakingPlan {
  numWords?: number
  voiceSeconds?: number
  backoffSeconds?: number
}

export interface VapiAssistantPayload {
  name: string
  firstMessage: string
  model: {
    provider: 'openai' | 'anthropic' | 'together-ai' | 'anyscale' | 'openrouter' | 'groq'
    model: VapiModel
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    maxTokens?: number
    temperature?: number
    /**
     * CORRECT LOCATION: tools go inside model{}, NOT at assistant root.
     * Vapi rejects assistant-root-level tools with "property tools should not exist".
     */
    tools?: VapiTool[]
  }
  voice: {
    provider: VapiVoiceProvider
    voiceId: string
    speed?: number
  }
  transcriber?: VapiTranscriber
  /** Recording settings — stays at assistant root (correct per Vapi docs) */
  artifactPlan?: VapiArtifactPlan
  /** Interruption control — stays at assistant root */
  stopSpeakingPlan?: VapiStopSpeakingPlan
  endCallMessage?: string
  endCallPhrases?: string[]
  maxDurationSeconds?: number
  backgroundSound?: 'off' | 'office' | 'cafe'
  /** Minimum: 10 seconds (Vapi API requirement) */
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
  assistant?: { metadata?: Record<string, unknown> }
  assistantOverrides?: {
    metadata?: Record<string, unknown>
    variableValues?: Record<string, unknown>
  }
  status: string
  type: string
  startedAt?: string
  endedAt?: string
  durationSeconds?: number
  duration?: number
  cost?: number
  endedReason?: string
  transcript?: string
  summary?: string
  recordingUrl?: string
  stereoRecordingUrl?: string
  phoneNumberId?: string
  customer?: { number?: string; name?: string; email?: string }
  metadata?: Record<string, unknown>
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
    toolCallList?: VapiToolCall[]
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
  if (!key) throw new Error('Vapi private key not configured. Set VAPI_PRIVATE_KEY env var.')
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

// ─── Voice ID utilities ───────────────────────────────────────────────────────

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

/**
 * Normalize Deepgram voice ID for Vapi API.
 * Vapi expects "asteria" not "aura-asteria-en".
 */
export function normalizeDeepgramVoiceId(voiceId: string): string {
  return voiceId
    .replace(/^aura-/, '')
    .replace(/-[a-z]{2}$/, '')
}

// ─── Tool builder ─────────────────────────────────────────────────────────────

/**
 * Build the Knowledge Base search tool.
 * This goes inside model.tools[] — NOT at assistant root.
 */
export function buildKnowledgeBaseTool(webhookBaseUrl: string, webhookSecret: string): VapiTool {
  return {
    type: 'function',
    messages: [
      {
        type: 'request-start',
        content: 'Let me check our knowledge base for that.',
      },
      {
        type: 'request-response-delayed',
        timingMilliseconds: 4000,
        content: 'Still searching, just a moment.',
      },
      {
        type: 'request-failed',
        content: "I'm having trouble accessing our knowledge base right now.",
      },
    ],
    function: {
      name: 'searchKnowledgeBase',
      description:
        'Search the company knowledge base to find accurate, up-to-date information about ' +
        'products, services, pricing, policies, and procedures. ' +
        'Use this tool whenever a customer asks a specific factual question. ' +
        'Do NOT fabricate answers — always use this tool for factual queries.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The customer question or search query to look up in the knowledge base',
          },
        },
        required: ['query'],
      },
    },
    server: {
      url: `${webhookBaseUrl}/api/vapi-webhook`,
      secret: webhookSecret,
      timeoutSeconds: 20,
    },
  }
}

// ─── Assistant Builder ────────────────────────────────────────────────────────

export interface BuildAssistantOptions {
  name: string
  companyName: string
  firstMessage?: string
  systemPrompt?: string
  voiceId?: string
  model?: VapiModel
  maxDurationSeconds?: number
  backgroundSound?: 'off' | 'office' | 'cafe'
  orgId: string
  webhookBaseUrl: string
  webhookSecret: string
  // KB integration
  toolsEnabled?: boolean
  extraTools?: VapiTool[]
  // Transcription
  transcriptionProvider?: VapiTranscriptionProvider
  transcriptionLanguage?: string
  // Timing — silenceTimeoutSeconds MINIMUM is 10 per Vapi API
  silenceTimeoutSeconds?: number
  responseDelaySeconds?: number
  // Behavior
  interruptionsEnabled?: boolean
  recordingEnabled?: boolean
  endCallPhrases?: string[]
}

export function buildOrgAssistantPayload(opts: BuildAssistantOptions): VapiAssistantPayload {
  const {
    toolsEnabled = true,
    extraTools = [],
    transcriptionProvider = 'deepgram',
    transcriptionLanguage = 'en',
    // FIX: minimum 10, default 30
    silenceTimeoutSeconds = 30,
    responseDelaySeconds = 0.4,
    interruptionsEnabled = true,
    recordingEnabled = true,
    endCallPhrases = ['goodbye', 'bye', 'thanks bye', "that's all", 'end call'],
  } = opts

  // Guard: Vapi minimum is 10 seconds
  const safeSilenceTimeout = Math.max(10, silenceTimeoutSeconds)

  // ── System prompt ─────────────────────────────────────────────────────────

  const kbInstructions = toolsEnabled
    ? `
## Knowledge Base Access
You have a 'searchKnowledgeBase' tool. Use it for ANY factual question about our products, pricing, policies, or procedures.
Rules:
  1. Call the tool before answering factual questions — do NOT guess.
  2. After getting results, summarize concisely for voice (1-2 sentences).
  3. If the tool returns no result, say you don't have that info and offer to connect to a human.
  4. Natural phrasing: "Let me check that..." → wait → "I found that..."
`
    : ''

  const defaultSystemPrompt = `You are a helpful, professional, and warm customer support voice assistant for ${opts.companyName}.
${kbInstructions}
## Core Behaviors
- This is a voice call — be conversational and concise. 2–3 sentences max per response.
- Never recite long lists; summarize and offer to elaborate.
- Always speak in the same language the customer uses.
- If you cannot help, offer to connect to a human agent.
- Never fabricate pricing, policies, or features.`

  const systemPromptContent = opts.systemPrompt?.trim() || defaultSystemPrompt

  // ── Voice ─────────────────────────────────────────────────────────────────

  const { provider, voiceId: rawVoiceId } = parseVoiceId(opts.voiceId ?? DEFAULT_VOICE_ID)
  const vapiVoiceId = provider === 'deepgram' ? normalizeDeepgramVoiceId(rawVoiceId) : rawVoiceId

  // ── Tools → go inside model.tools[] ──────────────────────────────────────

  const baseTools: VapiTool[] = toolsEnabled
    ? [buildKnowledgeBaseTool(opts.webhookBaseUrl, opts.webhookSecret)]
    : []
  const modelTools: VapiTool[] = [...baseTools, ...extraTools]

  // ── Transcriber ───────────────────────────────────────────────────────────

  const transcriber: VapiTranscriber = {
    provider: transcriptionProvider,
    language: transcriptionLanguage,
    ...(transcriptionProvider === 'deepgram' ? { smartFormat: true } : {}),
  }

  // ── Build payload ─────────────────────────────────────────────────────────

  const payload: VapiAssistantPayload = {
    name: opts.name,
    firstMessage:
      opts.firstMessage?.trim() ||
      `Hello! I'm the virtual assistant for ${opts.companyName}. How can I help you today?`,

    model: {
      provider: 'openai',
      model: opts.model ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPromptContent },
      ],
      maxTokens: 256,
      temperature: 0.4,
      // FIX: tools inside model{} not at assistant root
      ...(modelTools.length > 0 ? { tools: modelTools } : {}),
    },

    voice: {
      provider,
      voiceId: vapiVoiceId,
    },

    transcriber,

    artifactPlan: {
      recordingEnabled,
    },

    // Interruption control
    ...(interruptionsEnabled
      ? {}
      : {
          stopSpeakingPlan: {
            numWords: 10,
            voiceSeconds: 0.5,
            backoffSeconds: 1,
          },
        }),

    endCallMessage: 'Thank you for calling. Have a great day!',
    endCallPhrases,
    maxDurationSeconds: opts.maxDurationSeconds ?? 600,
    backgroundSound: opts.backgroundSound ?? 'off',
    // FIX: enforce minimum 10
    silenceTimeoutSeconds: safeSilenceTimeout,
    responseDelaySeconds,
    backchannelingEnabled: true,
    serverUrl: `${opts.webhookBaseUrl}/api/vapi-webhook`,
    serverUrlSecret: opts.webhookSecret,
    metadata: {
      orgId: opts.orgId,
      source: 'tinfin',
    },
  }

  return payload
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

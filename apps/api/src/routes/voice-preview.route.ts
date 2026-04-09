/**
 * apps/api/src/routes/voice-preview.route.ts
 *
 * Generates short TTS audio previews for voice selection in the dashboard.
 * Called by the VoiceSettingsPanel when user clicks the play button.
 *
 * Security:
 *   - Requires Authorization header (same as tRPC — checks Supabase session)
 *   - Rate-limited by org (max 30 previews per minute)
 *   - Preview text is hardcoded on server — no user input reaches TTS
 *
 * Supported providers:
 *   - openai   → OpenAI TTS API (uses OPENAI_API_KEY)
 *   - deepgram  → Deepgram TTS API (uses DEEPGRAM_API_KEY or OPENAI as fallback)
 */

import { Router, type Request, type Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { parseVoiceId, VAPI_VOICE_CATALOGUE } from '@workspace/ai'

export const voicePreviewRoute: Router = Router()

// ─── Preview text ─────────────────────────────────────────────────────────────
const PREVIEW_TEXT = "Hello! I'm your AI voice assistant. How can I help you today?"

// ─── Simple in-memory rate limiter ───────────────────────────────────────────
const previewCounts = new Map<string, { count: number; resetAt: number }>()
const PREVIEW_LIMIT = 30
const PREVIEW_WINDOW_MS = 60_000

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const entry = previewCounts.get(orgId)
  if (!entry || entry.resetAt < now) {
    previewCounts.set(orgId, { count: 1, resetAt: now + PREVIEW_WINDOW_MS })
    return true
  }
  if (entry.count >= PREVIEW_LIMIT) return false
  entry.count++
  return true
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function resolveOrgId(token: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null

  const { data: userRecord } = await supabase
    .from('users')
    .select('active_org_id, org_id')
    .eq('id', user.id)
    .maybeSingle()

  return (userRecord?.active_org_id ?? userRecord?.org_id) as string | null
}

// ─── OpenAI TTS ───────────────────────────────────────────────────────────────
async function generateOpenAIPreview(voiceId: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: PREVIEW_TEXT,
      voice: voiceId,
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => res.status.toString())
    throw new Error(`OpenAI TTS error: ${txt}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── Deepgram TTS ─────────────────────────────────────────────────────────────
async function generateDeepgramPreview(voiceId: string): Promise<Buffer> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    // Fallback: if no Deepgram key, use OpenAI alloy
    console.warn('[voice-preview] DEEPGRAM_API_KEY not set, falling back to OpenAI alloy')
    return generateOpenAIPreview('alloy')
  }

  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: PREVIEW_TEXT }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => res.status.toString())
    // Fallback to OpenAI on Deepgram error
    console.warn(`[voice-preview] Deepgram error for ${voiceId}: ${txt}, falling back to OpenAI`)
    return generateOpenAIPreview('alloy')
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── Route handler ────────────────────────────────────────────────────────────

voicePreviewRoute.get('/:voiceKey(*)', async (req: Request, res: Response) => {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const token = req.headers.authorization?.replace('Bearer ', '').trim()
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const orgId = await resolveOrgId(token)
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' })

    // ── Rate limit ────────────────────────────────────────────────────────
    if (!checkRateLimit(orgId)) {
      return res.status(429).json({ error: 'Too many preview requests. Wait a moment.' })
    }

    // ── Parse and validate voice ──────────────────────────────────────────
    // voiceKey comes as URL param, e.g. "openai:alloy" or "deepgram:aura-asteria-en"
    // Express may decode it differently depending on client encoding
    const rawKey = decodeURIComponent(req.params['voiceKey'] ?? '')
    const { provider, voiceId } = parseVoiceId(rawKey)

    // Verify the voice is in our curated catalogue
    const catalogueEntry = VAPI_VOICE_CATALOGUE.find(v => v.id === `${provider}:${voiceId}`)
    if (!catalogueEntry) {
      return res.status(400).json({ error: `Voice "${rawKey}" is not in the supported catalogue.` })
    }

    // ── Generate audio ────────────────────────────────────────────────────
    let audioBuffer: Buffer

    switch (provider) {
      case 'openai':
        audioBuffer = await generateOpenAIPreview(voiceId)
        break
      case 'deepgram':
        audioBuffer = await generateDeepgramPreview(voiceId)
        break
      default:
        // Unsupported provider — fall back to OpenAI alloy
        audioBuffer = await generateOpenAIPreview('alloy')
    }

    // ── Respond with audio ────────────────────────────────────────────────
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
      'Cache-Control': 'public, max-age=3600',  // cache preview for 1 hour
      'X-Voice-Id': `${provider}:${voiceId}`,
    })
    return res.send(audioBuffer)

  } catch (err) {
    console.error('[voice-preview] Error:', err)
    return res.status(500).json({ error: 'Failed to generate voice preview.' })
  }
})
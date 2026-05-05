export const AI_RESPONSE_CHANNELS = ['chat', 'email', 'whatsapp', 'voice'] as const

export type AiResponseChannel = (typeof AI_RESPONSE_CHANNELS)[number]

export const AI_CHANNEL_TONES = [
  'short_conversational',
  'structured_complete',
  'concise_friendly',
  'very_short_spoken',
] as const

export type AiChannelTone = (typeof AI_CHANNEL_TONES)[number]

export interface AiChannelBehaviorSetting {
  tone: AiChannelTone
}

export interface AiChannelBehaviorConfig {
  version: 1
  channels: Record<AiResponseChannel, AiChannelBehaviorSetting>
}

export const AI_CHANNEL_LABELS: Record<AiResponseChannel, string> = {
  chat: 'Chat',
  email: 'Email',
  whatsapp: 'WhatsApp',
  voice: 'Voice',
}

export const AI_CHANNEL_TONE_LABELS: Record<AiChannelTone, string> = {
  short_conversational: 'Short, conversational',
  structured_complete: 'Structured, complete',
  concise_friendly: 'Concise, friendly',
  very_short_spoken: 'Very short, spoken',
}

export const AI_CHANNEL_TONE_DESCRIPTIONS: Record<AiChannelTone, string> = {
  short_conversational:
    'Use short paragraphs, natural language, and a direct support-chat rhythm.',
  structured_complete:
    'Use a brief greeting, complete explanation, clear bullets or sections, and a polite close.',
  concise_friendly:
    'Keep the answer compact, friendly, and easy to read on a phone.',
  very_short_spoken:
    'Answer like a live call: one or two spoken sentences, no Markdown, no long lists.',
}

export const DEFAULT_AI_CHANNEL_BEHAVIOR: AiChannelBehaviorConfig = {
  version: 1,
  channels: {
    chat: { tone: 'short_conversational' },
    email: { tone: 'structured_complete' },
    whatsapp: { tone: 'concise_friendly' },
    voice: { tone: 'very_short_spoken' },
  },
}

const CHANNEL_SET = new Set<string>(AI_RESPONSE_CHANNELS)
const TONE_SET = new Set<string>(AI_CHANNEL_TONES)

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function normalizeAiResponseChannel(value: unknown): AiResponseChannel {
  return typeof value === 'string' && CHANNEL_SET.has(value) ? (value as AiResponseChannel) : 'chat'
}

export function normalizeAiChannelTone(value: unknown, fallback: AiChannelTone): AiChannelTone {
  return typeof value === 'string' && TONE_SET.has(value) ? (value as AiChannelTone) : fallback
}

export function normalizeAiChannelBehaviorConfig(value: unknown): AiChannelBehaviorConfig {
  const root = asRecord(value)
  const channels = asRecord(root.channels)

  return {
    version: 1,
    channels: Object.fromEntries(
      AI_RESPONSE_CHANNELS.map((channel) => {
        const fallback = DEFAULT_AI_CHANNEL_BEHAVIOR.channels[channel]
        const rawChannel = asRecord(channels[channel])

        return [
          channel,
          {
            tone: normalizeAiChannelTone(rawChannel.tone, fallback.tone),
          },
        ]
      })
    ) as Record<AiResponseChannel, AiChannelBehaviorSetting>,
  }
}

export function buildAiChannelBehaviorPrompt(
  channelInput: unknown,
  configInput: unknown
): string {
  const channel = normalizeAiResponseChannel(channelInput)
  const config = normalizeAiChannelBehaviorConfig(configInput)
  const tone = config.channels[channel].tone

  return [
    '## Channel Style',
    `Current channel: ${AI_CHANNEL_LABELS[channel]}.`,
    `Configured tone: ${AI_CHANNEL_TONE_LABELS[tone]}.`,
    AI_CHANNEL_TONE_DESCRIPTIONS[tone],
    '',
    'Apply this style without changing factual grounding or safety rules.',
    channel === 'email'
      ? 'For email, include a brief greeting and a polite close. Do not invent a sender name.'
      : null,
    channel === 'whatsapp'
      ? 'For WhatsApp, avoid heavy Markdown and keep the message easy to scan on mobile.'
      : null,
    channel === 'voice'
      ? 'For voice, do not use Markdown, bullets, code fences, tables, or long URLs unless explicitly requested.'
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
}

export function aiChannelMaxTokens(channelInput: unknown): number {
  const channel = normalizeAiResponseChannel(channelInput)
  if (channel === 'email') return 900
  if (channel === 'whatsapp') return 280
  if (channel === 'voice') return 140
  return 550
}

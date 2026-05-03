import { Router, type Request, type Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'

export const widgetConfigRoute: Router = Router()

const publicCors = cors({ origin: '*', methods: ['GET', 'OPTIONS'], credentials: false })
widgetConfigRoute.use(publicCors)
widgetConfigRoute.options('*', publicCors)

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const POSITIONS = ['bottom-right', 'bottom-left'] as const
const THEME_MODES = ['light', 'dark', 'system'] as const

const DEFAULT_LIGHT_THEME = {
  backgroundColor: '#f8fafc',
  surfaceColor: '#ffffff',
  textColor: '#111827',
  mutedTextColor: '#6b7280',
  borderColor: '#e5e7eb',
  assistantBubbleColor: '#ffffff',
  assistantTextColor: '#111827',
  userBubbleTextColor: '#ffffff',
  inputBackgroundColor: '#f3f4f6',
  headerTextColor: '#ffffff',
}

const DEFAULT_DARK_THEME = {
  backgroundColor: '#0f172a',
  surfaceColor: '#111827',
  textColor: '#f8fafc',
  mutedTextColor: '#94a3b8',
  borderColor: '#263244',
  assistantBubbleColor: '#172033',
  assistantTextColor: '#f8fafc',
  userBubbleTextColor: '#ffffff',
  inputBackgroundColor: '#0b1220',
  headerTextColor: '#ffffff',
}

const DEFAULT_CONFIG = {
  primaryColor: '#6366f1',
  welcomeMessage: 'Hi, how can we help?',
  companyName: 'Support',
  position: 'bottom-right',
  showBranding: true,
  logoUrl: null,
  themeMode: 'light',
  lightTheme: DEFAULT_LIGHT_THEME,
  darkTheme: DEFAULT_DARK_THEME,
  botName: 'AI Assistant',
  inputPlaceholder: 'Type a message...',
  responseTimeText: 'AI - We reply instantly',
  launcherSize: 'md',
  borderRadius: 20,
  widgetWidth: 380,
  widgetHeight: 580,
  expandedWidth: 720,
  expandedHeight: 720,
  headerStyle: 'gradient',
  userBubbleColor: null,
  autoOpen: false,
  autoOpenDelay: 5,
  showTypingIndicator: true,
  offlineMessage: null,
  suggestions: [] as Array<{ label: string; message: string }>,
  helpItems: [] as Array<{ id?: string; question: string; answer: string; actionLabel?: string; actionMessage?: string }>,
  talkToHumanLabel: 'Talk to Human',
  talkToHumanMessage: 'I want to talk to a human agent.',
  vapiPublicKey: null,
  vapiAssistantId: null,
  voiceEnabled: false,
  callButtonLabel: 'Talk to AI',
}

type ThemeColors = typeof DEFAULT_LIGHT_THEME

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function cleanString(value: unknown, fallback: string, max = 120): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : fallback
}

function cleanOptionalString(value: unknown, max = 240): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function cleanHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_RE.test(value) ? value : fallback
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function cleanChoice<T extends readonly string[]>(value: unknown, choices: T, fallback: T[number]): T[number] {
  return typeof value === 'string' && (choices as readonly string[]).includes(value)
    ? value as T[number]
    : fallback
}

function parseTheme(value: unknown, fallback: ThemeColors): ThemeColors {
  const raw = asRecord(value)
  return {
    backgroundColor: cleanHex(raw.backgroundColor, fallback.backgroundColor),
    surfaceColor: cleanHex(raw.surfaceColor, fallback.surfaceColor),
    textColor: cleanHex(raw.textColor, fallback.textColor),
    mutedTextColor: cleanHex(raw.mutedTextColor, fallback.mutedTextColor),
    borderColor: cleanHex(raw.borderColor, fallback.borderColor),
    assistantBubbleColor: cleanHex(raw.assistantBubbleColor, fallback.assistantBubbleColor),
    assistantTextColor: cleanHex(raw.assistantTextColor, fallback.assistantTextColor),
    userBubbleTextColor: cleanHex(raw.userBubbleTextColor, fallback.userBubbleTextColor),
    inputBackgroundColor: cleanHex(raw.inputBackgroundColor, fallback.inputBackgroundColor),
    headerTextColor: cleanHex(raw.headerTextColor, fallback.headerTextColor),
  }
}

function parseSuggestions(value: unknown): Array<{ label: string; message: string }> {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const raw = asRecord(item)
      const label = cleanOptionalString(raw.label, 40)
      const message = cleanOptionalString(raw.message, 240)
      return label && message ? { label, message } : null
    })
    .filter((item): item is { label: string; message: string } => Boolean(item))
    .slice(0, 6)
}

type HelpItem = { id?: string; question: string; answer: string; actionLabel?: string; actionMessage?: string }

function parseHelpItems(value: unknown): HelpItem[] {
  if (!Array.isArray(value)) return []
  const items: HelpItem[] = []

  value.forEach((item, index) => {
    const raw = asRecord(item)
    const question = cleanOptionalString(raw.question, 90)
    const answer = cleanOptionalString(raw.answer, 700)
    if (!question || !answer) return

    items.push({
      id: cleanOptionalString(raw.id, 60) ?? `help-${index + 1}`,
      question,
      answer,
      actionLabel: cleanOptionalString(raw.actionLabel, 40) ?? undefined,
      actionMessage: cleanOptionalString(raw.actionMessage, 240) ?? undefined,
    })
  })

  return items.slice(0, 8)
}

widgetConfigRoute.get('/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params

    if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) {
      return res.status(400).json({ error: 'Invalid orgId' })
    }

    const supabase = getSupabase()

    const [widgetResult, vapiResult] = await Promise.all([
      supabase
        .from('widget_configs')
        .select('primary_color, welcome_message, company_name, logo_url, position, show_branding, settings')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('vapi_assistants')
        .select('vapi_assistant_id, is_active, settings')
        .eq('org_id', orgId)
        .maybeSingle(),
    ])

    const data = widgetResult.data
    const vapiData = vapiResult.data
    const s = asRecord(data?.settings)
    const vapiSettings = asRecord(vapiData?.settings)

    const voiceEnabled = !!(
      vapiData?.is_active &&
      vapiData?.vapi_assistant_id &&
      process.env.VAPI_PUBLIC_KEY
    )

    return res.json({
      primaryColor: cleanHex(data?.primary_color, DEFAULT_CONFIG.primaryColor),
      welcomeMessage: cleanString(data?.welcome_message, DEFAULT_CONFIG.welcomeMessage, 200),
      companyName: cleanString(data?.company_name, DEFAULT_CONFIG.companyName, 80),
      position: cleanChoice(data?.position, POSITIONS, 'bottom-right'),
      showBranding: typeof data?.show_branding === 'boolean' ? data.show_branding : DEFAULT_CONFIG.showBranding,
      logoUrl: cleanOptionalString(data?.logo_url, 500),
      themeMode: cleanChoice(s.themeMode, THEME_MODES, 'light'),
      lightTheme: parseTheme(s.lightTheme, DEFAULT_LIGHT_THEME),
      darkTheme: parseTheme(s.darkTheme, DEFAULT_DARK_THEME),
      botName: cleanString(s.botName, DEFAULT_CONFIG.botName, 50),
      inputPlaceholder: cleanString(s.inputPlaceholder, DEFAULT_CONFIG.inputPlaceholder, 100),
      responseTimeText: cleanString(s.responseTimeText, DEFAULT_CONFIG.responseTimeText, 100),
      launcherSize: cleanChoice(s.launcherSize, ['sm', 'md', 'lg'] as const, 'md'),
      borderRadius: cleanNumber(s.borderRadius, DEFAULT_CONFIG.borderRadius, 8, 28),
      widgetWidth: cleanNumber(s.widgetWidth, DEFAULT_CONFIG.widgetWidth, 300, 460),
      widgetHeight: cleanNumber(s.widgetHeight, DEFAULT_CONFIG.widgetHeight, 480, 720),
      expandedWidth: cleanNumber(s.expandedWidth, DEFAULT_CONFIG.expandedWidth, 520, 900),
      expandedHeight: cleanNumber(s.expandedHeight, DEFAULT_CONFIG.expandedHeight, 560, 820),
      headerStyle: cleanChoice(s.headerStyle, ['gradient', 'solid'] as const, 'gradient'),
      userBubbleColor: cleanOptionalString(s.userBubbleColor, 7),
      autoOpen: typeof s.autoOpen === 'boolean' ? s.autoOpen : DEFAULT_CONFIG.autoOpen,
      autoOpenDelay: cleanNumber(s.autoOpenDelay, DEFAULT_CONFIG.autoOpenDelay, 0, 60),
      showTypingIndicator: typeof s.showTypingIndicator === 'boolean' ? s.showTypingIndicator : DEFAULT_CONFIG.showTypingIndicator,
      offlineMessage: cleanOptionalString(s.offlineMessage, 200),
      suggestions: parseSuggestions(s.suggestions),
      helpItems: parseHelpItems(s.helpItems),
      talkToHumanLabel: cleanString(s.talkToHumanLabel, DEFAULT_CONFIG.talkToHumanLabel, 40),
      talkToHumanMessage: cleanString(s.talkToHumanMessage, DEFAULT_CONFIG.talkToHumanMessage, 240),
      vapiPublicKey: voiceEnabled ? (process.env.VAPI_PUBLIC_KEY ?? null) : null,
      vapiAssistantId: voiceEnabled ? (vapiData?.vapi_assistant_id ?? null) : null,
      voiceEnabled,
      callButtonLabel: cleanString(vapiSettings.callButtonLabel, DEFAULT_CONFIG.callButtonLabel, 40),
    })
  } catch (err) {
    console.error('[widget-config]', err)
    return res.status(500).json({ error: 'Internal error' })
  }
})

import { Router, type Request, type Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'

export const widgetConfigRoute: Router = Router()

const publicCors = cors({ origin: '*', methods: ['GET', 'OPTIONS'], credentials: false })

// Apply CORS to all routes in this router
widgetConfigRoute.use(publicCors)

// Explicit OPTIONS handler for preflight
widgetConfigRoute.options('*', publicCors)

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const DEFAULT_CONFIG = {
  primaryColor: '#6366f1',
  welcomeMessage: 'Hi 👋 How can we help?',
  companyName: 'Support',
  position: 'bottom-right',
  showBranding: true,
  logoUrl: null,
  // Advanced settings defaults
  botName: 'AI Assistant',
  inputPlaceholder: 'Type a message...',
  responseTimeText: 'AI · We reply instantly',
  launcherSize: 'md',
  borderRadius: 20,
  widgetWidth: 380,
  headerStyle: 'gradient',
  userBubbleColor: null,
  autoOpen: false,
  autoOpenDelay: 5,
  showTypingIndicator: true,
  offlineMessage: null,
  // Quick replies
  suggestions: [] as Array<{ label: string; message: string }>,
  talkToHumanLabel: 'Talk to Human',
  talkToHumanMessage: 'I want to talk to a human agent.',
  // Voice defaults — disabled until configured
  vapiPublicKey: null,
  vapiAssistantId: null,
  voiceEnabled: false,
  callButtonLabel: 'Talk to AI',
}

function parseSuggestions(value: unknown): Array<{ label: string; message: string }> {
  if (!Array.isArray(value)) return []
  const cleaned = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const label = typeof (item as { label?: unknown }).label === 'string'
        ? (item as { label: string }).label.trim()
        : ''
      const message = typeof (item as { message?: unknown }).message === 'string'
        ? (item as { message: string }).message.trim()
        : ''
      if (!label || !message) return null
      return {
        label: label.slice(0, 40),
        message: message.slice(0, 240),
      }
    })
    .filter((item): item is { label: string; message: string } => Boolean(item))

  return cleaned.slice(0, 6)
}

widgetConfigRoute.get('/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params

    if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) {
      return res.status(400).json({ error: 'Invalid orgId' })
    }

    const supabase = getSupabase()

    // Fetch widget config and vapi assistant config in parallel
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

    if (!data) {
      // Return defaults with voice config if available
      return res.json({
        ...DEFAULT_CONFIG,
        vapiPublicKey: vapiData?.is_active ? (process.env.VAPI_PUBLIC_KEY ?? null) : null,
        vapiAssistantId: vapiData?.is_active ? (vapiData.vapi_assistant_id ?? null) : null,
        voiceEnabled: !!(vapiData?.is_active && vapiData?.vapi_assistant_id && process.env.VAPI_PUBLIC_KEY),
      })
    }

    const s = (data.settings ?? {}) as Record<string, unknown>
    const vapiSettings = (vapiData?.settings ?? {}) as Record<string, unknown>

    // Only expose voice if: assistant is active + assistant ID exists + public key is set
    const voiceEnabled = !!(
      vapiData?.is_active &&
      vapiData?.vapi_assistant_id &&
      process.env.VAPI_PUBLIC_KEY
    )

    return res.json({
      // Direct DB columns
      primaryColor:      data.primary_color     ?? DEFAULT_CONFIG.primaryColor,
      welcomeMessage:    data.welcome_message   ?? DEFAULT_CONFIG.welcomeMessage,
      companyName:       data.company_name      ?? DEFAULT_CONFIG.companyName,
      position:          data.position          ?? DEFAULT_CONFIG.position,
      showBranding:      data.show_branding     ?? DEFAULT_CONFIG.showBranding,
      logoUrl:           data.logo_url          ?? null,
      // Advanced settings from JSONB
      botName:            typeof s.botName === 'string' && s.botName ? s.botName : DEFAULT_CONFIG.botName,
      inputPlaceholder:   typeof s.inputPlaceholder === 'string' && s.inputPlaceholder ? s.inputPlaceholder : DEFAULT_CONFIG.inputPlaceholder,
      responseTimeText:   typeof s.responseTimeText === 'string' && s.responseTimeText ? s.responseTimeText : DEFAULT_CONFIG.responseTimeText,
      launcherSize:       typeof s.launcherSize === 'string' ? s.launcherSize : DEFAULT_CONFIG.launcherSize,
      borderRadius:       typeof s.borderRadius === 'number' ? s.borderRadius : DEFAULT_CONFIG.borderRadius,
      widgetWidth:        typeof s.widgetWidth === 'number' ? s.widgetWidth : DEFAULT_CONFIG.widgetWidth,
      headerStyle:        typeof s.headerStyle === 'string' ? s.headerStyle : DEFAULT_CONFIG.headerStyle,
      userBubbleColor:    typeof s.userBubbleColor === 'string' && s.userBubbleColor ? s.userBubbleColor : null,
      autoOpen:           typeof s.autoOpen === 'boolean' ? s.autoOpen : DEFAULT_CONFIG.autoOpen,
      autoOpenDelay:      typeof s.autoOpenDelay === 'number' ? s.autoOpenDelay : DEFAULT_CONFIG.autoOpenDelay,
      showTypingIndicator: typeof s.showTypingIndicator === 'boolean' ? s.showTypingIndicator : DEFAULT_CONFIG.showTypingIndicator,
      offlineMessage:     typeof s.offlineMessage === 'string' && s.offlineMessage ? s.offlineMessage : null,
      suggestions:        parseSuggestions(s.suggestions),
      talkToHumanLabel:   typeof s.talkToHumanLabel === 'string' && s.talkToHumanLabel.trim()
        ? s.talkToHumanLabel.trim()
        : DEFAULT_CONFIG.talkToHumanLabel,
      talkToHumanMessage: typeof s.talkToHumanMessage === 'string' && s.talkToHumanMessage.trim()
        ? s.talkToHumanMessage.trim()
        : DEFAULT_CONFIG.talkToHumanMessage,
      // Voice — public key is safe to expose (read-only)
      vapiPublicKey:    voiceEnabled ? (process.env.VAPI_PUBLIC_KEY ?? null) : null,
      vapiAssistantId:  voiceEnabled ? (vapiData?.vapi_assistant_id ?? null) : null,
      voiceEnabled,
      callButtonLabel: typeof vapiSettings.callButtonLabel === 'string' && vapiSettings.callButtonLabel
        ? vapiSettings.callButtonLabel
        : DEFAULT_CONFIG.callButtonLabel,
    })
  } catch (err) {
    console.error('[widget-config]', err)
    return res.status(500).json({ error: 'Internal error' })
  }
})
import { Router, type Request, type Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'

export const widgetConfigRoute: Router = Router()

const publicCors = cors({ origin: '*', methods: ['GET'], credentials: false })

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
}

widgetConfigRoute.get('/:orgId', publicCors, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params

    if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) {
      return res.status(400).json({ error: 'Invalid orgId' })
    }

    const supabase = getSupabase()

    const { data } = await supabase
      .from('widget_configs')
      .select('primary_color, welcome_message, company_name, logo_url, position, show_branding, settings')
      .eq('org_id', orgId)
      .maybeSingle()

    if (!data) {
      return res.json(DEFAULT_CONFIG)
    }

    // Merge settings JSONB with defaults
    const s = (data.settings ?? {}) as Record<string, unknown>

    return res.json({
      // Direct DB columns
      primaryColor: data.primary_color ?? DEFAULT_CONFIG.primaryColor,
      welcomeMessage: data.welcome_message ?? DEFAULT_CONFIG.welcomeMessage,
      companyName: data.company_name ?? DEFAULT_CONFIG.companyName,
      position: data.position ?? DEFAULT_CONFIG.position,
      showBranding: data.show_branding ?? DEFAULT_CONFIG.showBranding,
      logoUrl: data.logo_url ?? null,
      // Advanced settings from JSONB
      botName: typeof s.botName === 'string' && s.botName ? s.botName : DEFAULT_CONFIG.botName,
      inputPlaceholder: typeof s.inputPlaceholder === 'string' && s.inputPlaceholder ? s.inputPlaceholder : DEFAULT_CONFIG.inputPlaceholder,
      responseTimeText: typeof s.responseTimeText === 'string' && s.responseTimeText ? s.responseTimeText : DEFAULT_CONFIG.responseTimeText,
      launcherSize: typeof s.launcherSize === 'string' ? s.launcherSize : DEFAULT_CONFIG.launcherSize,
      borderRadius: typeof s.borderRadius === 'number' ? s.borderRadius : DEFAULT_CONFIG.borderRadius,
      widgetWidth: typeof s.widgetWidth === 'number' ? s.widgetWidth : DEFAULT_CONFIG.widgetWidth,
      headerStyle: typeof s.headerStyle === 'string' ? s.headerStyle : DEFAULT_CONFIG.headerStyle,
      userBubbleColor: typeof s.userBubbleColor === 'string' && s.userBubbleColor ? s.userBubbleColor : null,
      autoOpen: typeof s.autoOpen === 'boolean' ? s.autoOpen : DEFAULT_CONFIG.autoOpen,
      autoOpenDelay: typeof s.autoOpenDelay === 'number' ? s.autoOpenDelay : DEFAULT_CONFIG.autoOpenDelay,
      showTypingIndicator: typeof s.showTypingIndicator === 'boolean' ? s.showTypingIndicator : DEFAULT_CONFIG.showTypingIndicator,
      offlineMessage: typeof s.offlineMessage === 'string' && s.offlineMessage ? s.offlineMessage : null,
    })
  } catch (err) {
    console.error('[widget-config]', err)
    return res.status(500).json({ error: 'Internal error' })
  }
})
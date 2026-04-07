import { Router, type Request, type Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'

export const widgetConfigRoute: Router = Router()

// Allow all origins — this endpoint is called by the widget embedded on customer sites
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
      .select('primary_color, welcome_message, company_name, logo_url, position, show_branding')
      .eq('org_id', orgId)
      .maybeSingle()

    if (!data) {
      // Org exists but no config yet — return safe defaults
      return res.json(DEFAULT_CONFIG)
    }

    return res.json({
      primaryColor: data.primary_color ?? DEFAULT_CONFIG.primaryColor,
      welcomeMessage: data.welcome_message ?? DEFAULT_CONFIG.welcomeMessage,
      companyName: data.company_name ?? DEFAULT_CONFIG.companyName,
      position: data.position ?? DEFAULT_CONFIG.position,
      showBranding: data.show_branding ?? DEFAULT_CONFIG.showBranding,
      logoUrl: data.logo_url ?? null,
    })
  } catch (err) {
    console.error('[widget-config]', err)
    return res.status(500).json({ error: 'Internal error' })
  }
})
import { useState, useEffect, useRef } from 'react'
import type {
  WidgetConfig,
  WidgetHelpItem,
  WidgetPosition,
  WidgetSuggestion,
  WidgetThemeColors,
  WidgetThemeMode,
} from './types'

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'

export type ResolvedConfig = {
  orgId: string
  primaryColor: string
  welcomeMessage: string
  companyName: string
  logoUrl: string | null
  position: WidgetPosition
  showBranding: boolean
  // Advanced
  themeMode: WidgetThemeMode
  lightTheme: WidgetThemeColors
  darkTheme: WidgetThemeColors
  botName: string
  inputPlaceholder: string
  responseTimeText: string
  launcherSize: 'sm' | 'md' | 'lg'
  borderRadius: number
  widgetWidth: number
  widgetHeight: number
  expandedWidth: number
  expandedHeight: number
  headerStyle: 'gradient' | 'solid'
  userBubbleColor: string | null
  autoOpen: boolean
  autoOpenDelay: number
  showTypingIndicator: boolean
  offlineMessage: string | null
  // Quick replies
  suggestions: WidgetSuggestion[]
  helpItems: WidgetHelpItem[]
  talkToHumanLabel: string
  talkToHumanMessage: string
  // ── Voice / Vapi ────────────────────────────────────────────────────────
  vapiPublicKey: string | null
  vapiAssistantId: string | null
  voiceEnabled: boolean
  callButtonLabel: string
  user?: WidgetConfig['user']
  company?: WidgetConfig['company']
  page?: WidgetConfig['page']
  customAttributes?: WidgetConfig['customAttributes']
}

const DEFAULTS: Omit<ResolvedConfig, 'orgId'> = {
  primaryColor: '#6366f1',
  welcomeMessage: 'Hi, how can we help?',
  companyName: 'Support',
  logoUrl: null,
  position: 'bottom-right',
  showBranding: true,
  themeMode: 'light',
  lightTheme: {
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
  },
  darkTheme: {
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
  },
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
  suggestions: [],
  helpItems: [],
  talkToHumanLabel: 'Talk to Human',
  talkToHumanMessage: 'I want to talk to a human agent.',
  // Voice defaults
  vapiPublicKey: null,
  vapiAssistantId: null,
  voiceEnabled: false,
  callButtonLabel: 'Talk to AI',
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Partial<T>
}

export function useWidgetConfig(orgId: string, staticOverrides: Partial<WidgetConfig>) {
  const [config, setConfig] = useState<ResolvedConfig>({
    orgId,
    ...DEFAULTS,
    ...stripUndefined(staticOverrides),
  })
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetch(`${API_URL}/api/widget-config/${encodeURIComponent(orgId)}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<Partial<ResolvedConfig>>
      })
      .then(dbConfig => {
        setConfig(prev => ({
          ...prev,
          ...dbConfig,
          // Re-apply script-tag overrides on top
          ...stripUndefined(staticOverrides),
          orgId,
        }))
      })
      .catch(err => {
        console.warn('[tinfin-widget] Could not fetch remote config:', (err as Error).message)
      })
      .finally(() => setLoading(false))
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { config, loading }
}

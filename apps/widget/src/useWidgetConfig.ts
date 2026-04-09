import { useState, useEffect, useRef } from 'react'
import type { WidgetConfig } from './types'

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'

export type ResolvedConfig = {
  orgId: string
  primaryColor: string
  welcomeMessage: string
  companyName: string
  logoUrl: string | null
  position: NonNullable<WidgetConfig['position']>
  showBranding: boolean
  // Advanced
  botName: string
  inputPlaceholder: string
  responseTimeText: string
  launcherSize: 'sm' | 'md' | 'lg'
  borderRadius: number
  widgetWidth: number
  headerStyle: 'gradient' | 'solid'
  userBubbleColor: string | null
  autoOpen: boolean
  autoOpenDelay: number
  showTypingIndicator: boolean
  offlineMessage: string | null
  // ── Voice / Vapi ────────────────────────────────────────────────────────
  vapiPublicKey: string | null
  vapiAssistantId: string | null
  voiceEnabled: boolean
  callButtonLabel: string
}

const DEFAULTS: Omit<ResolvedConfig, 'orgId'> = {
  primaryColor: '#6366f1',
  welcomeMessage: 'Hi 👋 How can we help?',
  companyName: 'Support',
  logoUrl: null,
  position: 'bottom-right',
  showBranding: true,
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
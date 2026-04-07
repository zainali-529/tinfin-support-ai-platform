import { useState, useEffect, useRef } from 'react'
import type { WidgetConfig } from './types'

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'

export type ResolvedConfig = Required<Omit<WidgetConfig, 'logoUrl' | 'welcomeMessage' | 'companyName'>> & {
  logoUrl: string | null
  welcomeMessage: string
  companyName: string
}

const DEFAULTS: Omit<ResolvedConfig, 'orgId'> = {
  primaryColor: '#6366f1',
  welcomeMessage: 'Hi 👋 How can we help?',
  companyName: 'Support',
  logoUrl: null,
  position: 'bottom-right',
  showBranding: true,
}

/**
 * Fetches widget config from the API and merges with static script-tag attributes.
 * Script-tag attributes take priority — this lets customers override per-site
 * without changing the DB config.
 *
 * Priority: script-tag-attrs > DB config > defaults
 */
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
          // Apply DB config as base
          ...dbConfig,
          // Then re-apply any explicit script-tag overrides on top
          ...stripUndefined(staticOverrides),
          orgId,
        }))
      })
      .catch(err => {
        // Silently fail — widget still works with static/default config
        console.warn('[tinfin-widget] Could not fetch remote config:', err.message)
      })
      .finally(() => setLoading(false))
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { config, loading }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Partial<T>
}
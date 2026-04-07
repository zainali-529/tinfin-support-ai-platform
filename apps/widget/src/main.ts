import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import Widget from './Widget'
import type { WidgetConfig } from './types'

function resolveWidgetScript() {
  const current = document.currentScript
  if (current instanceof HTMLScriptElement) return current

  const scripts = Array.from(document.querySelectorAll('script'))
  return scripts.find((item) =>
    item.hasAttribute('data-org-id') ||
    item.hasAttribute('data-organization-id') ||
    item.hasAttribute('data-tinfin-widget')
  ) as HTMLScriptElement | undefined
}

function initWidget(config: WidgetConfig) {
  const host = document.createElement('div')
  host.id = 'tinfin-widget-host'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const mount = document.createElement('div')
  shadow.appendChild(mount)

  createRoot(mount).render(createElement(Widget, { config }))
}

const script = resolveWidgetScript()
const envOrgId = (import.meta as any).env?.VITE_WIDGET_ORG_ID as string | undefined
const orgId =
  script?.getAttribute('data-org-id')?.trim() ||
  script?.getAttribute('data-organization-id')?.trim() ||
  envOrgId?.trim() ||
  ''
const primaryColor = script?.getAttribute('data-color') || undefined
const companyName = script?.getAttribute('data-company') || undefined
const position = (script?.getAttribute('data-position') as WidgetConfig['position']) || 'bottom-right'

if (!orgId) {
  console.error('[tinfin-widget] Missing org id. Provide data-org-id (or legacy data-organization-id) on the script tag, or VITE_WIDGET_ORG_ID at build time.')
} else {
  const config: WidgetConfig = { orgId, primaryColor, companyName, position }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initWidget(config))
  } else {
    initWidget(config)
  }
}

export { initWidget }
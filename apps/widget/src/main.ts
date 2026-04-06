import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import Widget from './Widget'
import type { WidgetConfig } from './types'

function initWidget(config: WidgetConfig) {
  const host = document.createElement('div')
  host.id = 'tinfin-widget-host'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const mount = document.createElement('div')
  shadow.appendChild(mount)

  createRoot(mount).render(createElement(Widget, { config }))
}

const script = document.currentScript as HTMLScriptElement
const orgId = script?.getAttribute('data-org-id') || 'f672108e-1fcb-4c6a-a5d4-42b84452364a'
const primaryColor = script?.getAttribute('data-color') || undefined
const companyName = script?.getAttribute('data-company') || undefined
const position = (script?.getAttribute('data-position') as WidgetConfig['position']) || 'bottom-right'

const config: WidgetConfig = { orgId, primaryColor, companyName, position }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initWidget(config))
} else {
  initWidget(config)
}

export { initWidget }
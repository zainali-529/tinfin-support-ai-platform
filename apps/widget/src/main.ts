import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Widget from './Widget'
import type { WidgetConfig } from './types'

type TinfinCommand =
  | 'boot'
  | 'update'
  | 'shutdown'
  | 'show'
  | 'hide'
  | 'open'
  | 'close'
  | 'newChat'
  | 'openNewMessage'
  | 'trackEvent'
  | 'on'
  | 'off'

type TinfinQueuedCall = [TinfinCommand, ...unknown[]]

type TinfinEventName =
  | 'ready'
  | 'booted'
  | 'updated'
  | 'shutdown'
  | 'track'
  | 'error'

type TinfinApi = {
  (command: TinfinCommand, ...args: unknown[]): unknown
  q?: TinfinQueuedCall[]
  boot: (options?: Partial<WidgetConfig>) => void
  update: (patch?: Partial<WidgetConfig>) => void
  shutdown: () => void
  show: () => void
  hide: () => void
  open: () => void
  close: () => void
  newChat: () => void
  openNewMessage: (message?: string) => void
  trackEvent: (name: string, metadata?: Record<string, unknown>) => void
  on: (eventName: TinfinEventName, handler: EventListener) => void
  off: (eventName: TinfinEventName, handler: EventListener) => void
  version: string
  initialized: boolean
}

type RuntimeState = {
  host: HTMLDivElement
  mount: HTMLDivElement
  root: Root
  config: WidgetConfig
}

declare global {
  interface Window {
    Tinfin?: TinfinApi | ((command: TinfinCommand, ...args: unknown[]) => void) & { q?: TinfinQueuedCall[] }
    tinfinSettings?: Partial<WidgetConfig>
    TinfinSettings?: Partial<WidgetConfig>
  }
}

const VERSION = '1.0.0'
const HOST_ID = 'tinfin-widget-host'
let runtime: RuntimeState | null = null

function resolveWidgetScript() {
  const current = document.currentScript
  if (current instanceof HTMLScriptElement) return current

  const scripts = Array.from(document.querySelectorAll('script'))
  return scripts.find((item) =>
    item.hasAttribute('data-org-id') ||
    item.hasAttribute('data-organization-id') ||
    item.hasAttribute('data-tinfin-widget') ||
    /tinfin|widget/i.test(item.src)
  ) as HTMLScriptElement | undefined
}

function injectFonts() {
  if (document.getElementById('tinfin-widget-fonts')) return
  const link = document.createElement('link')
  link.id = 'tinfin-widget-fonts'
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap'
  document.head.appendChild(link)
}

function safeJsonAttribute<T>(script: HTMLScriptElement | undefined, name: string): T | undefined {
  const raw = script?.getAttribute(name)
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    console.warn(`[tinfin-widget] Ignoring invalid JSON in ${name}.`)
    return undefined
  }
}

function readScriptConfig(script: HTMLScriptElement | undefined): Partial<WidgetConfig> {
  const envOrgId = (import.meta as any).env?.VITE_WIDGET_ORG_ID as string | undefined
  const orgId =
    script?.getAttribute('data-org-id')?.trim() ||
    script?.getAttribute('data-organization-id')?.trim() ||
    envOrgId?.trim() ||
    ''

  const userId = script?.getAttribute('data-user-id')?.trim() || undefined
  const userEmail = script?.getAttribute('data-user-email')?.trim() || undefined
  const userName = script?.getAttribute('data-user-name')?.trim() || undefined
  const userHash = script?.getAttribute('data-user-hash')?.trim() || undefined
  const companyId = script?.getAttribute('data-company-id')?.trim() || undefined
  const companyName =
    script?.getAttribute('data-company-name')?.trim() ||
    script?.getAttribute('data-company')?.trim() ||
    undefined

  return {
    orgId,
    primaryColor: script?.getAttribute('data-color') || undefined,
    companyName,
    position: script?.getAttribute('data-position') === 'bottom-left'
      ? 'bottom-left'
      : script?.getAttribute('data-position') === 'bottom-right'
        ? 'bottom-right'
        : undefined,
    user: userId || userEmail || userName || userHash
      ? {
          id: userId,
          email: userEmail,
          name: userName,
          userHash,
          traits: safeJsonAttribute(script, 'data-user-traits'),
        }
      : undefined,
    company: companyId || companyName
      ? {
          id: companyId,
          name: companyName,
          plan: script?.getAttribute('data-company-plan')?.trim() || undefined,
          traits: safeJsonAttribute(script, 'data-company-traits'),
        }
      : undefined,
    customAttributes: safeJsonAttribute(script, 'data-custom-attributes'),
  }
}

function getPageContext(): NonNullable<WidgetConfig['page']> {
  return {
    url: window.location.href,
    title: document.title,
    referrer: document.referrer || undefined,
  }
}

function mergeConfig(base: WidgetConfig, patch: Partial<WidgetConfig>): WidgetConfig {
  return {
    ...base,
    ...patch,
    user: patch.user ? { ...base.user, ...patch.user } : base.user,
    company: patch.company ? { ...base.company, ...patch.company } : base.company,
    page: patch.page ? { ...base.page, ...patch.page } : base.page,
    customAttributes: patch.customAttributes
      ? { ...base.customAttributes, ...patch.customAttributes }
      : base.customAttributes,
  }
}

function emit(eventName: TinfinEventName, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(`tinfin:${eventName}`, { detail }))
}

function dispatchWidgetCommand(type: string, payload?: unknown) {
  window.dispatchEvent(new CustomEvent('tinfin:command', { detail: { type, payload } }))
}

function getOrCreateMount(): Pick<RuntimeState, 'host' | 'mount' | 'root'> {
  injectFonts()

  const existing = document.getElementById(HOST_ID)
  if (existing && runtime) {
    return { host: runtime.host, mount: runtime.mount, root: runtime.root }
  }
  if (existing) existing.remove()

  const host = document.createElement('div')
  host.id = HOST_ID
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const mount = document.createElement('div')
  shadow.appendChild(mount)

  return { host, mount, root: createRoot(mount) }
}

function renderWidget(config: WidgetConfig) {
  const mount = getOrCreateMount()
  mount.root.render(createElement(Widget, { config }))
  runtime = { ...mount, config }
  if (window.Tinfin && typeof window.Tinfin === 'function') {
    ;(window.Tinfin as TinfinApi).initialized = true
  }
}

function boot(options: Partial<WidgetConfig> = {}) {
  const base = runtime?.config ?? readScriptConfig(resolveWidgetScript())
  const globalSettings = window.TinfinSettings ?? window.tinfinSettings ?? {}
  const config = mergeConfig(
    {
      ...base,
      ...globalSettings,
      page: { ...getPageContext(), ...base.page, ...globalSettings.page },
    } as WidgetConfig,
    options
  )

  if (!config.orgId?.trim()) {
    const message = 'Missing orgId. Provide data-org-id on the script tag or call Tinfin("boot", { orgId }).'
    console.error(`[tinfin-widget] ${message}`)
    emit('error', { message })
    return
  }

  const wasBooted = Boolean(runtime)
  renderWidget(config)
  emit(wasBooted ? 'booted' : 'ready', { orgId: config.orgId })
}

function update(patch: Partial<WidgetConfig> = {}) {
  if (!runtime) {
    boot(patch)
    return
  }

  const config = mergeConfig(runtime.config, {
    ...patch,
    page: { ...getPageContext(), ...patch.page },
  })
  renderWidget(config)
  emit('updated', { orgId: config.orgId })
}

function shutdown() {
  if (!runtime) return
  runtime.root.unmount()
  runtime.host.remove()
  runtime = null
  if (window.Tinfin && typeof window.Tinfin === 'function') {
    ;(window.Tinfin as TinfinApi).initialized = false
  }
  emit('shutdown')
}

function trackEvent(name: string, metadata: Record<string, unknown> = {}) {
  const event = {
    name,
    metadata,
    orgId: runtime?.config.orgId ?? null,
    page: getPageContext(),
    createdAt: new Date().toISOString(),
  }
  emit('track', event)
}

function invoke(command: TinfinCommand, ...args: unknown[]) {
  switch (command) {
    case 'boot':
      boot((args[0] ?? {}) as Partial<WidgetConfig>)
      break
    case 'update':
      update((args[0] ?? {}) as Partial<WidgetConfig>)
      break
    case 'shutdown':
      shutdown()
      break
    case 'show':
    case 'open':
      dispatchWidgetCommand('show')
      break
    case 'hide':
    case 'close':
      dispatchWidgetCommand('hide')
      break
    case 'newChat':
      dispatchWidgetCommand('newChat')
      break
    case 'openNewMessage':
      dispatchWidgetCommand('openNewMessage', args[0])
      break
    case 'trackEvent':
      trackEvent(String(args[0] ?? ''), (args[1] ?? {}) as Record<string, unknown>)
      break
    case 'on':
      if (typeof args[0] === 'string' && typeof args[1] === 'function') {
        window.addEventListener(`tinfin:${args[0]}`, args[1] as EventListener)
      }
      break
    case 'off':
      if (typeof args[0] === 'string' && typeof args[1] === 'function') {
        window.removeEventListener(`tinfin:${args[0]}`, args[1] as EventListener)
      }
      break
    default:
      console.warn(`[tinfin-widget] Unknown command: ${String(command)}`)
  }
}

function createTinfinApi(queuedCalls: TinfinQueuedCall[]): TinfinApi {
  const api = ((command: TinfinCommand, ...args: unknown[]) => invoke(command, ...args)) as TinfinApi
  api.q = queuedCalls
  api.boot = boot
  api.update = update
  api.shutdown = shutdown
  api.show = () => invoke('show')
  api.hide = () => invoke('hide')
  api.open = () => invoke('open')
  api.close = () => invoke('close')
  api.newChat = () => invoke('newChat')
  api.openNewMessage = (message = '') => invoke('openNewMessage', message)
  api.trackEvent = trackEvent
  api.on = (eventName, handler) => window.addEventListener(`tinfin:${eventName}`, handler)
  api.off = (eventName, handler) => window.removeEventListener(`tinfin:${eventName}`, handler)
  api.version = VERSION
  api.initialized = false
  return api
}

function installGlobalApi() {
  const previous = window.Tinfin
  const queuedCalls = typeof previous === 'function' && Array.isArray(previous.q)
    ? previous.q
    : []

  window.Tinfin = createTinfinApi(queuedCalls)
  queuedCalls.forEach((call) => invoke(...call))
}

function shouldAutoBoot(script: HTMLScriptElement | undefined) {
  return script?.getAttribute('data-auto-boot') !== 'false'
}

function bootWhenReady() {
  if (runtime) return
  const script = resolveWidgetScript()
  if (!shouldAutoBoot(script)) return

  const config = readScriptConfig(script)
  if (!config.orgId) {
    const globalSettings = window.TinfinSettings ?? window.tinfinSettings
    if (globalSettings?.orgId) {
      boot(globalSettings)
      return
    }
    if (!globalSettings?.orgId) {
      console.error('[tinfin-widget] Missing org id. Provide data-org-id or call Tinfin("boot", { orgId }).')
    }
    return
  }
  boot(config)
}

installGlobalApi()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootWhenReady, { once: true })
} else {
  bootWhenReady()
}

export { boot as initWidget, boot, update, shutdown }

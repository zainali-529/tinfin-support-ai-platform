'use client'

import { useEffect, useState, type CSSProperties, type ComponentType } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { ArrowLeftIcon, HelpCircleIcon, InboxIcon, MessageCircleIcon, SendIcon, ZapIcon } from 'lucide-react'

interface WidgetThemeColors {
  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedTextColor: string
  borderColor: string
  assistantBubbleColor: string
  assistantTextColor: string
  userBubbleTextColor: string
  inputBackgroundColor: string
  headerTextColor: string
}

export interface PreviewConfig {
  primaryColor: string
  welcomeMessage: string
  companyName: string
  position: 'bottom-right' | 'bottom-left'
  showBranding: boolean
  logoUrl: string
  themeMode: 'light' | 'dark' | 'system'
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
  userBubbleColor: string
  autoOpen: boolean
  autoOpenDelay: number
  showTypingIndicator: boolean
  offlineMessage: string
  suggestions: Array<{ label: string; message: string }>
  helpItems: Array<{ id: string; question: string; answer: string; actionLabel?: string; actionMessage?: string }>
  talkToHumanLabel: string
  talkToHumanMessage: string
}

interface Props {
  config: PreviewConfig
}

const LAUNCHER_PX: Record<PreviewConfig['launcherSize'], number> = { sm: 48, md: 56, lg: 64 }

const DEFAULT_LIGHT_THEME: WidgetThemeColors = {
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

const DEFAULT_DARK_THEME: WidgetThemeColors = {
  backgroundColor: '#0f172a',
  surfaceColor: '#111827',
  textColor: '#f8fafc',
  mutedTextColor: '#94a3b8',
  borderColor: '#263244',
  assistantBubbleColor: '#1f2937',
  assistantTextColor: '#f8fafc',
  userBubbleTextColor: '#ffffff',
  inputBackgroundColor: '#0b1220',
  headerTextColor: '#ffffff',
}

const MOCK_MESSAGES = [
  { role: 'assistant' as const, content: 'Hello. How can I help you today?' },
  { role: 'user' as const, content: 'I need help with my recent order.' },
  { role: 'assistant' as const, content: 'Sure, share the order number and I will check it for you.' },
]

const NAV_ITEMS: Array<{
  value: 'inbox' | 'chat' | 'help'
  label: string
  Icon: ComponentType<{ className?: string }>
}> = [
  { value: 'inbox', label: 'Inbox', Icon: InboxIcon },
  { value: 'chat', label: 'Chat', Icon: MessageCircleIcon },
  { value: 'help', label: 'Help', Icon: HelpCircleIcon },
]

function themeWithFallback(theme: Partial<WidgetThemeColors> | undefined, fallback: WidgetThemeColors): WidgetThemeColors {
  return { ...fallback, ...(theme ?? {}) }
}

export function WidgetPreview({ config }: Props) {
  const [open, setOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbox' | 'chat' | 'help'>('chat')
  const [systemDark, setSystemDark] = useState(false)

  const color = config.primaryColor || '#6366f1'
  const activeThemeMode = config.themeMode === 'system'
    ? (systemDark ? 'dark' : 'light')
    : config.themeMode
  const activeTheme = activeThemeMode === 'dark'
    ? themeWithFallback(config.darkTheme, DEFAULT_DARK_THEME)
    : themeWithFallback(config.lightTheme, DEFAULT_LIGHT_THEME)
  const launcherPx = LAUNCHER_PX[config.launcherSize] ?? LAUNCHER_PX.md
  const borderRadius = config.borderRadius ?? 20
  const widgetWidth = Math.min(config.widgetWidth ?? 380, 340)
  const widgetHeight = Math.min(config.widgetHeight ?? 580, 390)
  const userBubbleColor = config.userBubbleColor || color
  const botName = config.botName || 'AI Assistant'
  const suggestions = (config.suggestions ?? []).slice(0, 3)
  const helpItems = (config.helpItems ?? []).filter(item => item.question && item.answer).slice(0, 3)
  const headerBg = config.headerStyle === 'gradient'
    ? `linear-gradient(135deg, ${color}, ${color}cc)`
    : color

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setSystemDark(query.matches)
    sync()
    query.addEventListener?.('change', sync)
    return () => query.removeEventListener?.('change', sync)
  }, [])

  const launcherStyle: CSSProperties = config.position === 'bottom-left'
    ? { bottom: 20, left: 20 }
    : { bottom: 20, right: 20 }
  const panelStyle: CSSProperties = config.position === 'bottom-left'
    ? { bottom: 84, left: 20 }
    : { bottom: 84, right: 20 }

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-xl border border-border bg-slate-50 dark:bg-zinc-950">
      <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background: `linear-gradient(135deg, ${color}14, transparent 35%), radial-gradient(circle at 85% 15%, ${color}18, transparent 32%)`,
          }}
        />
        <div className="absolute inset-x-0 top-0 flex h-10 items-center justify-between border-b border-black/5 bg-white/80 px-5 backdrop-blur-sm dark:border-white/5 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md" style={{ background: `${color}28` }} />
            <div className="h-2 w-16 rounded-full bg-slate-200 dark:bg-zinc-700" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-8 rounded-full bg-slate-200 dark:bg-zinc-700" />
            <div className="h-1.5 w-8 rounded-full bg-slate-200 dark:bg-zinc-700" />
            <div className="h-5 w-16 rounded-md" style={{ background: `${color}20` }} />
          </div>
        </div>
        <div className="absolute left-6 right-6 top-16 space-y-2">
          <div className="h-3 w-40 rounded-full bg-slate-200 opacity-80 dark:bg-zinc-700" />
          <div className="h-5 w-56 rounded-full bg-slate-300 opacity-60 dark:bg-zinc-600" />
          <div className="h-2.5 w-48 rounded-full bg-slate-200 opacity-60 dark:bg-zinc-700" />
        </div>
        <div className="absolute left-4 right-4 top-[150px] grid grid-cols-3 gap-2">
          {[0.16, 0.11, 0.08].map((opacity, index) => (
            <div
              key={index}
              className="h-16 rounded-lg border border-black/5 dark:border-white/5"
              style={{ background: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}` }}
            />
          ))}
        </div>
        <div className="absolute right-3 top-[46px] rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ background: `${color}20`, color }}>
          Preview
        </div>
      </div>

      {open && (
        <div
          className="absolute z-40 flex flex-col overflow-hidden border"
          style={{
            ...panelStyle,
            width: widgetWidth,
            height: widgetHeight,
            borderRadius,
            background: activeTheme.surfaceColor,
            borderColor: activeTheme.borderColor,
            color: activeTheme.textColor,
            boxShadow: 'none',
          }}
        >
          <div className="flex shrink-0 items-center gap-2.5 px-3.5 py-2.5" style={{ background: headerBg }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-white">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <MessageCircleIcon className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight" style={{ color: activeTheme.headerTextColor }}>
                {config.companyName || 'Support'}
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                <span className="truncate text-[11px]" style={{ color: `${activeTheme.headerTextColor}cc` }}>
                  {config.responseTimeText || 'AI replies instantly'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20"
              onClick={() => setOpen(false)}
              aria-label="Close preview widget"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {activeTab === 'chat' ? (
            <div className="relative flex min-h-0 flex-1 flex-col" style={{ background: activeTheme.backgroundColor }}>
              <div className="flex shrink-0 items-center gap-2 border-b px-2.5 py-2" style={{ background: activeTheme.surfaceColor, borderColor: activeTheme.borderColor }}>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border"
                  style={{ borderColor: activeTheme.borderColor, color: activeTheme.textColor, background: activeTheme.inputBackgroundColor }}
                  onClick={() => setActiveTab('inbox')}
                >
                  <ArrowLeftIcon className="h-3.5 w-3.5" />
                </button>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-bold" style={{ color: activeTheme.textColor }}>Support Chat</div>
                  <div className="truncate text-[10px]" style={{ color: activeTheme.mutedTextColor }}>{config.responseTimeText || 'AI replies instantly'}</div>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-hidden p-2.5 pb-12" style={{ background: activeTheme.backgroundColor }}>
                {MOCK_MESSAGES.map((message, index) => (
                  <div key={index} className={cn('flex items-end gap-2', message.role === 'user' && 'flex-row-reverse')}>
                    {message.role === 'assistant' && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${color}20`, color }}>
                        <ZapIcon className="h-3 w-3" />
                      </div>
                    )}
                    <div className={cn('flex min-w-0 max-w-[78%] flex-col gap-0.5', message.role === 'user' ? 'items-end' : 'items-start')}>
                      {message.role === 'assistant' && (
                        <div className="px-0.5 text-[9px] leading-none" style={{ color: activeTheme.mutedTextColor }}>
                          {botName}
                        </div>
                      )}
                      <div
                        className="px-2.5 py-1.5 text-[11px] leading-relaxed"
                        style={{
                          background: message.role === 'user' ? userBubbleColor : activeTheme.assistantBubbleColor,
                          color: message.role === 'user' ? activeTheme.userBubbleTextColor : activeTheme.assistantTextColor,
                          border: message.role === 'user' ? 'none' : `1px solid ${activeTheme.borderColor}`,
                          borderRadius: message.role === 'user'
                            ? `${Math.max(borderRadius - 7, 10)}px ${Math.max(borderRadius - 7, 10)}px 4px ${Math.max(borderRadius - 7, 10)}px`
                            : `${Math.max(borderRadius - 7, 10)}px ${Math.max(borderRadius - 7, 10)}px ${Math.max(borderRadius - 7, 10)}px 4px`,
                        }}
                      >
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))}

                {suggestions.length > 0 && (
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${color}20`, color }}>
                      <ZapIcon className="h-3 w-3" />
                    </div>
                    <div className="max-w-[78%] rounded-xl rounded-bl-[4px] border p-2" style={{ background: activeTheme.assistantBubbleColor, borderColor: activeTheme.borderColor }}>
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: activeTheme.mutedTextColor }}>Suggested replies</div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((item, index) => (
                          <span key={`${item.label}-${index}`} className="rounded-full border px-2 py-1 text-[10px] font-semibold" style={{ background: `${color}10`, borderColor: `${color}55`, color }}>
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {config.showTypingIndicator && (
                  <div className="flex items-end gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${color}20`, color }}>
                      <ZapIcon className="h-3 w-3" />
                    </div>
                    <div className="flex items-center gap-1 rounded-xl border px-2.5 py-2" style={{ background: activeTheme.assistantBubbleColor, borderColor: activeTheme.borderColor }}>
                      {[0, 0.2, 0.4].map((delay, index) => (
                        <span key={index} className="h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animation: `previewBounce 1.2s infinite ${delay}s` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {config.talkToHumanLabel && (
                <div className="absolute right-2.5 bottom-[54px] rounded-full border px-2.5 py-1.5 text-[11px] font-bold" style={{ borderColor: `${color}77`, color, background: activeTheme.surfaceColor }}>
                  {config.talkToHumanLabel}
                </div>
              )}

              <div className="flex shrink-0 items-center gap-1.5 border-t p-2" style={{ background: activeTheme.surfaceColor, borderColor: activeTheme.borderColor }}>
                <div className="flex-1 px-2.5 py-1.5 text-[11px]" style={{ background: activeTheme.inputBackgroundColor, color: activeTheme.mutedTextColor, borderRadius: Math.max(borderRadius - 8, 14) }}>
                  {config.inputPlaceholder || 'Type a message...'}
                </div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: color }}>
                  <SendIcon className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            </div>
          ) : activeTab === 'help' ? (
            <div className="flex flex-1 flex-col gap-2 overflow-hidden p-2.5" style={{ background: activeTheme.backgroundColor }}>
              <div className="rounded-xl border p-3" style={{ background: activeTheme.surfaceColor, borderColor: activeTheme.borderColor }}>
                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
                  Help center
                </div>
                <div className="mt-1 text-[13px] font-semibold" style={{ color: activeTheme.textColor }}>
                  Quick answers for visitors
                </div>
              </div>
              {helpItems.length === 0 ? (
                <div className="rounded-xl border p-3 text-[11px]" style={{ borderColor: activeTheme.borderColor, color: activeTheme.mutedTextColor }}>
                  Add FAQs in the Content tab to show help articles here.
                </div>
              ) : (
                helpItems.map(item => (
                  <div key={item.id} className="rounded-xl border p-3" style={{ background: activeTheme.surfaceColor, borderColor: activeTheme.borderColor }}>
                    <div className="text-[11px] font-semibold" style={{ color: activeTheme.textColor }}>
                      {item.question}
                    </div>
                    <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed" style={{ color: activeTheme.mutedTextColor }}>
                      {item.answer}
                    </p>
                    {item.actionLabel && (
                      <div className="mt-2 text-[10px] font-semibold" style={{ color }}>
                        {item.actionLabel}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-2 p-2.5" style={{ background: activeTheme.backgroundColor }}>
              <div className="rounded-xl border p-2.5" style={{ background: activeTheme.surfaceColor, borderColor: activeTheme.borderColor }}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold" style={{ color: activeTheme.textColor }}>
                    Support Chat
                  </span>
                  <span className="text-[9px]" style={{ color: activeTheme.mutedTextColor }}>
                    2m
                  </span>
                </div>
                <p className="line-clamp-2 text-[10px]" style={{ color: activeTheme.mutedTextColor }}>
                  {config.welcomeMessage || 'Hello. How can I help you today?'}
                </p>
                <div className="mt-1.5">
                  <span className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase" style={{ background: `${color}20`, color }}>
                    AI
                  </span>
                </div>
              </div>
              <button type="button" className="w-full rounded-xl py-2 text-[11px] font-semibold text-white" style={{ background: color }} onClick={() => setActiveTab('chat')}>
                Start New Chat
              </button>
            </div>
          )}

          {activeTab !== 'chat' && (
            <div className="grid grid-cols-3 gap-1 border-t p-1.5" style={{ background: activeTheme.surfaceColor, borderColor: activeTheme.borderColor }}>
              {NAV_ITEMS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-colors"
                  style={{
                    color: activeTab === value ? color : activeTheme.mutedTextColor,
                    background: activeTab === value ? `${color}14` : 'transparent',
                  }}
                  onClick={() => setActiveTab(value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {config.showBranding && (
            <div className="shrink-0 border-t py-1 text-center text-[9px]" style={{ color: activeTheme.mutedTextColor, background: activeTheme.surfaceColor, borderColor: activeTheme.borderColor }}>
              Powered by <span className="font-medium">Tinfin</span>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="absolute z-50 flex items-center justify-center border border-white/20 transition-transform hover:scale-105"
        style={{
          ...launcherStyle,
          width: launcherPx,
          height: launcherPx,
          borderRadius: '50%',
          background: headerBg,
          boxShadow: 'none',
        }}
        onClick={() => setOpen(current => !current)}
        aria-label="Toggle preview widget"
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <MessageCircleIcon className="h-5 w-5 text-white" />
        )}
      </button>

      <style>{`
        @keyframes previewBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}

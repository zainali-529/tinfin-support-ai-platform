'use client'

import { useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { ZapIcon } from 'lucide-react'

export interface PreviewConfig {
  primaryColor: string
  welcomeMessage: string
  companyName: string
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  showBranding: boolean
  logoUrl: string
  botName: string
  inputPlaceholder: string
  responseTimeText: string
  launcherSize: 'sm' | 'md' | 'lg'
  borderRadius: number
  widgetWidth: number
  headerStyle: 'gradient' | 'solid'
  userBubbleColor: string
  autoOpen: boolean
  autoOpenDelay: number
  showTypingIndicator: boolean
  offlineMessage: string
  suggestions: Array<{ label: string; message: string }>
  talkToHumanLabel: string
  talkToHumanMessage: string
}

const LAUNCHER_PX: Record<string, number> = { sm: 48, md: 56, lg: 64 }

const MOCK_MESSAGES = [
  { role: 'assistant' as const, content: "Hello! 👋 How can I help you today?" },
  { role: 'user' as const, content: "I need help with my recent order." },
  { role: 'assistant' as const, content: "I'd be happy to help! Could you share your order number?" },
]

interface Props {
  config: PreviewConfig
}

export function WidgetPreview({ config }: Props) {
  const [open, setOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbox' | 'chat'>('chat')

  const color = config.primaryColor || '#6366f1'
  const userBubbleColor = config.userBubbleColor || color
  const launcherPx = LAUNCHER_PX[config.launcherSize] ?? 56
  const borderRadius = config.borderRadius ?? 20
  const widgetWidth = config.widgetWidth ?? 380
  const botName = config.botName || 'AI Assistant'
  const previewSuggestions = (config.suggestions ?? []).slice(0, 3)
  const talkToHumanLabel = config.talkToHumanLabel || 'Talk to Human'

  const headerBg = config.headerStyle === 'gradient'
    ? `linear-gradient(135deg, ${color}, ${color}bb)`
    : color

  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { bottom: 20, right: 20 },
    'bottom-left':  { bottom: 20, left: 20 },
    'top-right':    { top: 20, right: 20 },
    'top-left':     { top: 20, left: 20 },
  }
  const windowPositionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { bottom: 84, right: 20 },
    'bottom-left':  { bottom: 84, left: 20 },
    'top-right':    { top: 84, right: 20 },
    'top-left':     { top: 84, left: 20 },
  }

  const launcherStyle = positionStyles[config.position] ?? positionStyles['bottom-right']!
  const windowStyle   = windowPositionStyles[config.position] ?? windowPositionStyles['bottom-right']!

  const maxWindowWidth = Math.min(widgetWidth, 340) // constrain in preview

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-white dark:bg-zinc-950" style={{ height: 520 }}>
      {/* ── Mock Website Background ── */}
      <div className="absolute inset-0 select-none pointer-events-none overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.08) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Top gradient */}
        <div className="absolute inset-x-0 top-0 h-48 opacity-30"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}40 0%, transparent 70%)` }}
        />

        {/* Fake nav bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 h-10 bg-white/80 dark:bg-zinc-900/80 border-b border-black/5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md" style={{ background: `${color}30` }} />
            <div className="w-16 h-2 rounded-full bg-gray-200 dark:bg-zinc-700" />
          </div>
          <div className="flex items-center gap-3">
            {['', '', ''].map((_, i) => (
              <div key={i} className="w-8 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700" />
            ))}
            <div className="w-16 h-5 rounded-md" style={{ background: `${color}25` }} />
          </div>
        </div>

        {/* Hero section */}
        <div className="absolute top-14 left-0 right-0 px-6 space-y-2">
          <div className="w-40 h-3 rounded-full bg-gray-200 dark:bg-zinc-700 opacity-80" />
          <div className="w-56 h-5 rounded-full bg-gray-300 dark:bg-zinc-600 opacity-60" />
          <div className="w-48 h-2.5 rounded-full bg-gray-200 dark:bg-zinc-700 opacity-50" />
          <div className="flex gap-2 mt-3">
            <div className="w-20 h-6 rounded-md" style={{ background: `${color}40` }} />
            <div className="w-16 h-6 rounded-md bg-gray-200 dark:bg-zinc-700 opacity-50" />
          </div>
        </div>

        {/* Cards row */}
        <div className="absolute top-[140px] left-4 right-4 grid grid-cols-3 gap-2">
          {[0.6, 0.45, 0.3].map((opacity, i) => (
            <div key={i}
              className="h-16 rounded-lg border border-black/5 dark:border-white/5"
              style={{
                background: `${color}${Math.round(opacity * 15).toString(16).padStart(2,'0')}`,
                opacity: 0.7
              }}
            />
          ))}
        </div>

        {/* Preview label */}
        <div className="absolute top-[46px] right-3 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
          style={{ background: `${color}20`, color }}>
          Preview
        </div>
      </div>

      {/* ── Widget Panel ── */}
      {open && (
        <div
          className="absolute flex flex-col bg-white dark:bg-zinc-900 shadow-2xl border border-black/8 dark:border-white/8 overflow-hidden"
          style={{
            ...windowStyle,
            width: maxWindowWidth,
            height: 380,
            borderRadius,
            zIndex: 40,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 shrink-0" style={{ background: headerBg }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              {config.logoUrl
                ? <img src={config.logoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                : <span>💬</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[13px] font-semibold leading-tight truncate">
                {config.companyName || 'Support'}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-white/80 text-[11px] truncate">{config.responseTimeText || 'AI · We reply instantly'}</span>
              </div>
            </div>
            <button className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition-colors"
              onClick={() => setOpen(false)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
            {(['inbox', 'chat'] as const).map(t => (
              <button key={t}
                className={cn(
                  'flex-1 py-2 text-[11px] font-semibold capitalize border-b-2 transition-colors',
                  activeTab === t ? 'text-current border-current' : 'border-transparent text-zinc-400 dark:text-zinc-500'
                )}
                style={activeTab === t ? { color, borderBottomColor: color } : {}}
                onClick={() => setActiveTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === 'chat' ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-hidden p-2.5 flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-950/50">
                {MOCK_MESSAGES.map((msg, i) => (
                  <div key={i} className={cn('flex gap-2 items-end', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: `${color}22`, color }}>
                        <ZapIcon className="w-3 h-3" />
                      </div>
                    )}
                    <div className={cn('flex flex-col gap-0.5', msg.role !== 'user' ? 'items-start' : 'items-end')}>
                      {msg.role === 'assistant' && (
                        <div className="text-[9px] text-zinc-400 px-0.5 leading-none mb-0.5">{botName}</div>
                      )}
                      <div
                        className="max-w-[75%] px-2.5 py-1.5 text-[11px] leading-relaxed"
                        style={{
                          ...(msg.role === 'user'
                            ? {
                                background: userBubbleColor,
                                color: '#fff',
                                borderTopLeftRadius: Math.max(borderRadius - 6, 6),
                                borderTopRightRadius: Math.max(borderRadius - 6, 6),
                                borderBottomLeftRadius: Math.max(borderRadius - 6, 6),
                                borderBottomRightRadius: 4,
                              }
                            : {
                                background: 'white',
                                color: '#111827',
                                borderTopLeftRadius: Math.max(borderRadius - 6, 6),
                                borderTopRightRadius: Math.max(borderRadius - 6, 6),
                                borderBottomRightRadius: Math.max(borderRadius - 6, 6),
                                borderBottomLeftRadius: 4,
                                border: '1px solid rgba(0,0,0,0.07)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                              }),
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {config.showTypingIndicator && (
                  <div className="flex gap-2 items-end">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}22`, color }}>
                      <ZapIcon className="w-3 h-3" />
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-2 bg-white dark:bg-zinc-800 rounded-xl rounded-bl-[4px] shadow-sm border border-black/5">
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400"
                          style={{ animation: `bounce 1.2s infinite ${delay}s` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(previewSuggestions.length > 0 || talkToHumanLabel) && (
                <div className="px-2.5 pb-2 space-y-2">
                  {previewSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {previewSuggestions.map((item, idx) => (
                        <span
                          key={`${item.label}-${idx}`}
                          className="px-2 py-1 rounded-full text-[10px] font-semibold border border-zinc-200 bg-white text-zinc-700"
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {talkToHumanLabel && (
                    <div
                      className="w-full text-center text-[11px] font-semibold rounded-lg border px-2.5 py-1.5"
                      style={{ borderColor: color, color, background: `${color}12` }}
                    >
                      {talkToHumanLabel}
                    </div>
                  )}
                </div>
              )}

              {/* Input */}
              <div className="shrink-0 p-2 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex gap-1.5 items-center">
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-400"
                  style={{ borderRadius: Math.max(borderRadius - 8, 16) }}>
                  {config.inputPlaceholder || 'Type a message...'}
                </div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 p-2.5 bg-zinc-50 dark:bg-zinc-950/50 flex flex-col gap-2">
              {/* Conversation card */}
              <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">Support Chat</span>
                  <span className="text-[9px] text-zinc-400">2m</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  Hello! 👋 How can I help you today?
                </p>
                <div className="mt-1.5">
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold uppercase" style={{ background: `${color}20`, color }}>
                    AI
                  </span>
                </div>
              </div>
              <button className="w-full py-2 text-white text-[11px] font-semibold rounded-xl" style={{ background: color }}>
                Start New Chat
              </button>
            </div>
          )}

          {config.showBranding && (
            <div className="text-center py-1 text-[9px] text-zinc-300 dark:text-zinc-600 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
              Powered by <span className="font-medium">Tinfin</span>
            </div>
          )}
        </div>
      )}

      {/* ── Launcher Button ── */}
      <button
        className="absolute flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
        style={{
          ...launcherStyle,
          width: launcherPx,
          height: launcherPx,
          borderRadius: '50%',
          background: headerBg,
          zIndex: 50,
        }}
        onClick={() => setOpen(o => !o)}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}

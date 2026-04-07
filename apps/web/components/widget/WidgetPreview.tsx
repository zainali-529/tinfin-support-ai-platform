'use client'

import { useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { ZapIcon } from 'lucide-react'

interface PreviewConfig {
  primaryColor: string
  welcomeMessage: string
  companyName: string
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  showBranding: boolean
  logoUrl: string
}

interface Props {
  config: PreviewConfig
}

const MOCK_MESSAGES = [
  { role: 'assistant' as const, content: "Hello! 👋 How can I help you today?" },
  { role: 'user' as const, content: "I need help with my order." },
  { role: 'assistant' as const, content: "I'd be happy to help with that! Could you share your order number?" },
]

export function WidgetPreview({ config }: Props) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<'inbox' | 'chat'>('chat')

  const color = config.primaryColor || '#6366f1'
  const isLeft = config.position === 'bottom-left'
  const isTop = config.position.startsWith('top')

  const positionClass = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  }[config.position]

  const windowPositionClass = {
    'bottom-right': 'bottom-[88px] right-6',
    'bottom-left': 'bottom-[88px] left-6',
    'top-right': 'top-[88px] right-6',
    'top-left': 'top-[88px] left-6',
  }[config.position]

  return (
    <div className="relative w-full h-full min-h-[540px] rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-border">
      {/* Mock website content */}
      <div className="absolute inset-0 p-8 pointer-events-none select-none">
        {/* Fake browser nav bar */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
            <div className="w-3 h-3 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 h-6 bg-white/40 dark:bg-white/10 rounded-md mx-4 flex items-center px-3">
            <span className="text-[10px] text-muted-foreground/50">your-website.com</span>
          </div>
        </div>

        {/* Fake page content */}
        <div className="space-y-3 opacity-30">
          <div className="h-8 w-48 bg-foreground/10 rounded-lg" />
          <div className="h-4 w-72 bg-foreground/8 rounded" />
          <div className="h-4 w-60 bg-foreground/8 rounded" />
          <div className="mt-6 flex gap-3">
            <div className="h-9 w-28 bg-foreground/10 rounded-lg" />
            <div className="h-9 w-20 bg-foreground/6 rounded-lg border border-foreground/10" />
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-foreground/6 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Preview label */}
        <div className="absolute top-4 right-4 px-2 py-1 bg-primary/10 rounded-full">
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Live Preview</span>
        </div>
      </div>

      {/* Widget Panel */}
      {open && (
        <div
          className={cn(
            'absolute w-[340px] rounded-2xl shadow-2xl overflow-hidden flex flex-col',
            'bg-white dark:bg-zinc-900 border border-black/10',
            windowPositionClass
          )}
          style={{ height: 420, zIndex: 40 }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="" className="w-full h-full object-cover rounded-full" />
              ) : '💬'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-semibold leading-tight truncate">
                {config.companyName || 'Support'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-white/80 text-xs">AI · We reply instantly</span>
              </div>
            </div>
            <button
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors text-white"
              onClick={() => setOpen(false)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
            {(['inbox', 'chat'] as const).map(t => (
              <button
                key={t}
                className={cn(
                  'flex-1 py-2.5 text-xs font-semibold capitalize border-b-2 transition-colors',
                  tab === t ? 'border-b-[var(--c)] text-[var(--c)]' : 'border-transparent text-zinc-400'
                )}
                style={{ '--c': color } as React.CSSProperties}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          {tab === 'chat' ? (
            <>
              <div className="flex-1 overflow-hidden p-3 flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-950/50">
                {MOCK_MESSAGES.map((msg, i) => (
                  <div
                    key={i}
                    className={cn('flex gap-2 items-end', msg.role === 'user' ? 'flex-row-reverse' : '')}
                  >
                    {msg.role === 'assistant' && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px]"
                        style={{ background: `${color}20`, color }}
                      >
                        <ZapIcon className="w-3 h-3" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[76%] px-3 py-2 rounded-2xl text-xs leading-relaxed',
                        msg.role === 'user'
                          ? 'rounded-br-sm text-white'
                          : 'rounded-bl-sm bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 shadow-sm border border-zinc-100 dark:border-zinc-700'
                      )}
                      style={msg.role === 'user' ? { background: color } : {}}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="shrink-0 p-2.5 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex gap-2 items-center">
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-2 text-xs text-zinc-400">
                  Type a message...
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: color }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-950/50 flex flex-col gap-2">
              <div className="w-full rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-100">Support Chat</span>
                  <span className="text-[10px] text-zinc-400">2m</span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 line-clamp-2">Hello! 👋 How can I help you today?</p>
                <div className="mt-1.5">
                  <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold uppercase">
                    AI
                  </span>
                </div>
              </div>
              <button
                className="w-full rounded-xl py-2.5 text-white text-xs font-semibold"
                style={{ background: color }}
              >
                Start New Chat
              </button>
            </div>
          )}

          {config.showBranding && (
            <div className="text-center py-1.5 text-[10px] text-zinc-300 dark:text-zinc-600 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
              Powered by <span className="font-medium">Tinfin</span>
            </div>
          )}
        </div>
      )}

      {/* Launcher Button */}
      <button
        className={cn('absolute w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105', positionClass)}
        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, zIndex: 50 }}
        onClick={() => setOpen(o => !o)}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  )
}
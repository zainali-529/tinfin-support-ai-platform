'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'
import {
  ArrowRightIcon,
  Sparkles,
  Zap,
  PhoneIcon,
  CheckCircle2,
  Star,
  TrendingUp,
  MessageSquare,
  BarChart3,
} from 'lucide-react'
import { useAnimatedCounter, useInView } from '@/hooks/useInView'

// ─── Animated stat counter ────────────────────────────────────────────────────

function StatCounter({
  value,
  suffix,
  prefix,
  label,
  enabled,
}: {
  value: number
  suffix?: string
  prefix?: string
  label: string
  enabled: boolean
}) {
  const count = useAnimatedCounter(value, 1800, enabled)
  return (
    <div>
      <p className="text-3xl font-bold tabular-nums tracking-tight">
        {prefix}{count.toLocaleString()}{suffix}
      </p>
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </div>
  )
}

// ─── Live chat widget preview ─────────────────────────────────────────────────

const DEMO_MESSAGES = [
  { role: 'bot' as const, content: "Hi! Where's my order?" },
  { role: 'user' as const, content: "I can't find the tracking info" },
  {
    role: 'bot' as const,
    content:
      'Found order #8821! Shipped yesterday, arrives tomorrow by 5 PM 📦',
  },
]

function ChatPreview() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    DEMO_MESSAGES.forEach((_, i) => {
      if (i > 0) {
        timers.push(setTimeout(() => setTyping(true), i * 2200 - 800))
      }
      timers.push(
        setTimeout(
          () => {
            setTyping(false)
            setVisibleCount(i + 1)
          },
          i * 2200
        )
      )
    })

    const restart = setTimeout(
      () => {
        setVisibleCount(0)
        setTyping(false)
      },
      DEMO_MESSAGES.length * 2200 + 2000
    )

    timers.push(restart)
    return () => timers.forEach(clearTimeout)
  }, [visibleCount === 0])

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3 border-b border-white/10"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        }}
      >
        <div className="size-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-lg shrink-0 shadow-lg">
          ✨
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-semibold leading-none">Support AI</p>
          <p className="text-white/65 text-xs mt-0.5 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Always online
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {['bg-red-400', 'bg-amber-400', 'bg-emerald-400'].map((c, i) => (
            <div key={i} className={cn('size-2.5 rounded-full', c, 'opacity-70')} />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="px-3 py-4 space-y-3 min-h-[240px] bg-gradient-to-b from-white/2 to-transparent">
        {DEMO_MESSAGES.slice(0, visibleCount).map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex animate-in fade-in slide-in-from-bottom-2 duration-300',
              msg.role === 'user' ? 'justify-end' : 'items-end gap-2'
            )}
          >
            {msg.role === 'bot' && (
              <div className="size-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 mb-0.5 flex-shrink-0">
                <Zap className="size-3.5 text-white" />
              </div>
            )}
            <div
              className={cn(
                'max-w-xs rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md shadow-lg'
                  : 'bg-white/10 border border-white/20 text-white rounded-bl-md backdrop-blur'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex items-end gap-2">
            <div className="size-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 flex-shrink-0">
              <Zap className="size-3.5 text-white" />
            </div>
            <div className="bg-white/10 border border-white/20 rounded-2xl rounded-bl-md px-4 py-3 backdrop-blur">
              <div className="flex gap-1.5">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="size-2 rounded-full bg-white/50 animate-bounce"
                    style={{ animationDelay: `${delay}ms`, animationDuration: '900ms' }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/10 bg-gradient-to-t from-white/5 to-transparent flex items-center gap-2">
        <div className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-xs text-white/50 border border-white/10">
          Message...
        </div>
        <div className="size-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 hover:shadow-lg transition-all cursor-pointer">
          <ArrowRightIcon className="size-4 text-white" />
        </div>
      </div>
    </div>
  )
}

// ─── Floating stat card ───────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'absolute z-20 flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 shadow-xl',
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400/20 to-blue-600/20 border border-blue-400/30 shrink-0">
        <Icon className="size-5 text-blue-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white leading-none">{value}</p>
        <p className="text-[10px] text-white/60 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Main hero section ────────────────────────────────────────────────────────

export function HeroSection() {
  const [heroRef, heroInView] = useInView<HTMLElement>({ threshold: 0.1 })

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100svh] flex items-center overflow-hidden pt-16"
    >
      {/* ── Premium background ── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900" />

        {/* Animated gradient orbs */}
        <div
          className="absolute -top-40 -left-40 size-[600px] rounded-full opacity-40"
          style={{
            background:
              'radial-gradient(circle at center, rgba(59,130,246,0.5) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'float-slow 20s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-40 -right-40 size-[500px] rounded-full opacity-30"
          style={{
            background:
              'radial-gradient(circle at center, rgba(139,92,246,0.4) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'float-slow 25s ease-in-out infinite reverse',
          }}
        />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

        {/* Top fade */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-slate-950 to-transparent" />

        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />
      </div>

      {/* ── Content ── */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Left: Copy ── */}
          <div
            className="space-y-8"
            style={{
              opacity: heroInView ? 1 : 0,
              transform: heroInView ? 'none' : 'translateY(40px)',
              transition: 'opacity 0.9s ease 0.1s, transform 0.9s ease 0.1s',
            }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse" />
              <span className="text-xs font-medium text-white/80">AI Support Platform</span>
            </div>

            {/* Headline */}
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-white">
                Support that{' '}
                <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-purple-400 bg-clip-text text-transparent">
                  learns & adapts
                </span>
              </h1>
              <p className="text-lg text-white/70 leading-relaxed max-w-lg">
                Your AI customer support agent that handles tickets, calls, and conversations. Reduce response time by 80% while maintaining human touch.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all"
                asChild
              >
                <Link href="/signup">
                  Start free
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2 border-white/20 text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <a href="#features">
                  See demo
                </a>
              </Button>
            </div>

            {/* Trust section */}
            <div className="flex items-center gap-6 pt-8 border-t border-white/10">
              <div>
                <div className="flex gap-1 mb-2">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <Star
                        key={i}
                        className="size-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                </div>
                <p className="text-sm font-medium text-white">
                  <span className="text-amber-400">4.9/5</span> from 500+ teams
                </p>
              </div>
              <div className="h-8 border-l border-white/20" />
              <div>
                <p className="text-sm font-medium text-white">Used by</p>
                <p className="text-xs text-white/60">Fortune 500 companies & startups</p>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/10">
              <StatCounter value={98} suffix="%" label="Resolution rate" enabled={heroInView} />
              <StatCounter value={80} suffix="%" label="Time saved" enabled={heroInView} />
              <StatCounter value={2} suffix="min" label="Setup time" enabled={heroInView} />
            </div>
          </div>

          {/* ── Right: Product preview ── */}
          <div
            className="relative flex items-center justify-center h-full"
            style={{
              opacity: heroInView ? 1 : 0,
              transform: heroInView ? 'none' : 'translateY(40px) scale(0.95)',
              transition: 'opacity 0.9s ease 0.3s, transform 0.9s ease 0.3s',
            }}
          >
            {/* Glow effect */}
            <div
              className="absolute -inset-20 rounded-3xl opacity-50 -z-10"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(59,130,246,0.3) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />

            {/* Chat widget */}
            <div className="relative z-10 w-full max-w-sm">
              <ChatPreview />
            </div>

            {/* Stat card: Resolved */}
            <StatCard
              icon={CheckCircle2}
              label="Resolved instantly"
              value="4,521"
              className="top-12 -right-6 lg:-right-12 animate-bounce-soft"
            />

            {/* Stat card: Active calls */}
            <StatCard
              icon={PhoneIcon}
              label="Active calls"
              value="247"
              className="-bottom-4 -left-6 lg:-left-12"
            />

            {/* Stat card: Performance */}
            <StatCard
              icon={BarChart3}
              label="Efficiency gain"
              value="+340%"
              className="bottom-32 -right-6 lg:-right-12"
            />
          </div>
        </div>
      </div>

      {/* ── Animation keyframes ── */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -20px) scale(1.05); }
          50% { transform: translate(-20px, 40px) scale(0.98); }
          75% { transform: translate(-40px, -30px) scale(1.02); }
        }
      `}</style>
    </section>
  )
}

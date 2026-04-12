'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'
import {
  ArrowRightIcon,
  SparklesIcon,
  ZapIcon,
  PhoneCallIcon,
  CheckCircleIcon,
  StarIcon,
  TrendingUpIcon,
  UserCheckIcon,
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
      <p className="text-2xl font-bold tabular-nums tracking-tight">
        {prefix}{count.toLocaleString()}{suffix}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

// ─── Live chat widget preview ─────────────────────────────────────────────────

const DEMO_MESSAGES = [
  { role: 'bot' as const, content: 'Hi there! 👋 How can I help you today?' },
  { role: 'user' as const, content: "I can't find my order tracking link." },
  {
    role: 'bot' as const,
    content:
      "I found order #8821 — it shipped yesterday and arrives tomorrow by 5 PM. I'll send the tracking link to your email!",
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

    // restart loop
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
    <div className="w-full rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden ring-1 ring-foreground/5">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--foreground)/0.85) 100%)',
        }}
      >
        <div className="size-9 rounded-full bg-white/15 flex items-center justify-center text-lg shrink-0">
          💬
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-semibold leading-none">Acme Support</p>
          <p className="text-white/65 text-xs mt-0.5 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            AI · We reply instantly
          </p>
        </div>
        {/* Fake window controls */}
        <div className="flex gap-1.5 shrink-0">
          {['bg-red-400', 'bg-amber-400', 'bg-emerald-400'].map((c, i) => (
            <div key={i} className={cn('size-2.5 rounded-full', c, 'opacity-70')} />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="px-3 py-3 space-y-2.5 min-h-[200px] bg-muted/20">
        {DEMO_MESSAGES.slice(0, visibleCount).map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex animate-in fade-in slide-in-from-bottom-2 duration-300',
              msg.role === 'user' ? 'justify-end' : 'items-end gap-2'
            )}
          >
            {msg.role === 'bot' && (
              <div className="size-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mb-0.5">
                <ZapIcon className="size-3 text-foreground" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-foreground text-background rounded-br-[4px]'
                  : 'bg-card border border-border/60 text-foreground rounded-bl-[4px] shadow-sm'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex items-end gap-2">
            <div className="size-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
              <ZapIcon className="size-3 text-foreground" />
            </div>
            <div className="bg-card border border-border/60 rounded-2xl rounded-bl-[4px] px-3 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                    style={{ animationDelay: `${delay}ms`, animationDuration: '900ms' }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="px-3 py-3 border-t border-border/50 bg-card flex items-center gap-2">
        <div className="flex-1 bg-muted/60 rounded-xl px-3 py-2 text-xs text-muted-foreground">
          Type a message...
        </div>
        <div className="size-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
          <ArrowRightIcon className="size-3.5 text-background" />
        </div>
      </div>
    </div>
  )
}

// ─── Floating notification card ───────────────────────────────────────────────

function FloatingCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  sub,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  title: string
  sub: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'absolute z-20 flex items-center gap-3 rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm px-3.5 py-2.5 shadow-xl ring-1 ring-foreground/5',
        className
      )}
    >
      <div className={cn('flex size-8 items-center justify-center rounded-lg shrink-0', iconBg)}>
        <Icon className={cn('size-4', iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-none truncate">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
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
      {/* ── Background layers ── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(var(--foreground)/0.07)_1px,transparent_1px)] bg-[size:28px_28px]" />

        {/* Gradient orbs */}
        <div
          className="animate-orb-1 absolute -top-40 -left-40 size-[600px] rounded-full opacity-30"
          style={{
            background:
              'radial-gradient(circle at center, hsl(var(--primary)/0.35) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="animate-orb-2 absolute -bottom-40 -right-40 size-[500px] rounded-full opacity-20"
          style={{
            background:
              'radial-gradient(circle at center, hsl(var(--primary)/0.25) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* ── Left column: Copy ── */}
          <div
            className="space-y-8"
            style={{
              opacity: heroInView ? 1 : 0,
              transform: heroInView ? 'none' : 'translateY(30px)',
              transition: 'opacity 0.8s ease, transform 0.8s ease',
            }}
          >
            {/* Eyebrow badge */}
            <Badge
              variant="outline"
              className="gap-2 border-border/60 bg-muted/40 backdrop-blur-sm w-fit"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI-powered customer support
            </Badge>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]">
                Support that{' '}
                <span
                  className="animate-gradient-shift bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--foreground)/0.6) 40%, hsl(var(--primary)) 70%, hsl(var(--foreground)) 100%)',
                    backgroundSize: '300% 300%',
                  }}
                >
                  thinks ahead
                </span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                Replace slow, expensive tickets with an AI that knows your products
                cold — chat, voice, and instant human handoff included.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-shadow" asChild>
                <Link href="/signup">
                  Start free — no card
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <a href="#features">
                  See how it works
                </a>
              </Button>
            </div>

            {/* Trust: avatars + stars */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[
                  'bg-violet-200 text-violet-800',
                  'bg-blue-200 text-blue-800',
                  'bg-emerald-200 text-emerald-800',
                  'bg-amber-200 text-amber-800',
                  'bg-rose-200 text-rose-800',
                ].map((style, i) => (
                  <div
                    key={i}
                    className={cn(
                      'size-8 rounded-full border-2 border-background flex items-center justify-center text-[11px] font-bold',
                      style
                    )}
                  >
                    {['A', 'B', 'C', 'D', 'E'][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 mb-0.5">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <StarIcon
                        key={i}
                        className="size-3 fill-amber-400 text-amber-400"
                      />
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Trusted by <span className="font-semibold text-foreground">500+</span> support teams
                </p>
              </div>
            </div>

            {/* Stat strip */}
            <div
              className="grid grid-cols-3 gap-6 pt-6 border-t border-border/50"
              style={{ transitionDelay: '0.3s' }}
            >
              <StatCounter value={98} suffix="%" label="Satisfaction rate" enabled={heroInView} />
              <StatCounter value={60} suffix="%" label="Ticket reduction" enabled={heroInView} />
              <StatCounter value={2} suffix="min" label="Setup time" enabled={heroInView} />
            </div>
          </div>

          {/* ── Right column: Product preview ── */}
          <div
            className="relative flex items-center justify-center"
            style={{
              opacity: heroInView ? 1 : 0,
              transform: heroInView ? 'none' : 'translateY(20px) scale(0.96)',
              transition: 'opacity 0.9s ease 0.2s, transform 0.9s ease 0.2s',
            }}
          >
            {/* Glow behind card */}
            <div
              className="absolute inset-0 -z-10 scale-110 rounded-3xl opacity-60"
              style={{
                background:
                  'radial-gradient(ellipse at center, hsl(var(--primary)/0.2) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />

            {/* Chat widget */}
            <div className="relative z-10 w-full max-w-sm animate-float-updown">
              <ChatPreview />
            </div>

            {/* Floating card: AI resolved */}
            <FloatingCard
              icon={CheckCircleIcon}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              title="AI resolved #4521"
              sub="3 seconds ago"
              className="top-4 -right-4 lg:-right-10 animate-float-gentle"
            />

            {/* Floating card: Voice call */}
            <FloatingCard
              icon={PhoneCallIcon}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              title="Voice call active"
              sub="AI handling · 1:24"
              className="-bottom-2 -left-4 lg:-left-10"
              // staggered float
            />

            {/* Floating card: Trend */}
            <FloatingCard
              icon={TrendingUpIcon}
              iconBg="bg-violet-100 dark:bg-violet-900/30"
              iconColor="text-violet-600 dark:text-violet-400"
              title="Ticket volume −62%"
              sub="vs last month"
              className="bottom-24 -right-4 lg:-right-8 animate-float-gentle"
              // style={{ animationDelay: '1s' }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
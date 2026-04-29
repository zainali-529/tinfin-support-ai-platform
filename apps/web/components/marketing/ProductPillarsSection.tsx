'use client'

import Link from 'next/link'
import { cn } from '@workspace/ui/lib/utils'
import {
  ArrowUpRightIcon,
  BarChart3Icon,
  BookOpenIcon,
  BotIcon,
  InboxIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  PhoneCallIcon,
  SparklesIcon,
} from 'lucide-react'

type PillarCardProps = {
  title: string
  status: string
  description: string
  href: string
  highlights?: string[]
  className?: string
  children: React.ReactNode
}

const INBOX_ROWS = [
  { customer: 'Ali Khan', channel: 'WhatsApp', text: 'Order #1192 delayed', state: 'New' },
  { customer: 'Sara J.', channel: 'Email', text: 'Need invoice copy', state: 'Open' },
  { customer: 'Michael', channel: 'Chat', text: 'Can I upgrade plan?', state: 'Bot' },
  { customer: 'Ayesha', channel: 'WhatsApp', text: 'Account access issue', state: 'Pending' },
]

const KB_SOURCES = [
  { name: 'Refund policy', type: 'DOC', chunks: 28 },
  { name: 'Shipping FAQs', type: 'URL', chunks: 41 },
  { name: 'Escalation SOP', type: 'NOTE', chunks: 16 },
]

const CHANNEL_ROWS = [
  { name: 'Website Chat', icon: MessageSquareIcon, color: 'text-blue-500', delay: '0s' },
  { name: 'Email', icon: MailIcon, color: 'text-violet-500', delay: '0.9s' },
  { name: 'WhatsApp', icon: MessageCircleIcon, color: 'text-emerald-500', delay: '1.8s' },
]

const ANALYTICS_BARS = [44, 66, 51, 74, 59, 84, 71]

// const PILLAR_METRICS = [
//   { label: 'First Response Time', value: '1m 48s', note: 'Across channels' },
//   { label: 'AI Deflection', value: '41%', note: 'Tickets auto-resolved' },
//   { label: 'Voice Pickup', value: '99.2%', note: 'Instant call readiness' },
// ]

export function ProductPillarsSection() {
  return (
    <section className="relative overflow-hidden bg-background pb-20 md:pb-24">
      <style>{`
        @keyframes pillar-msg-loop {
          0%, 12% { opacity: 0; transform: translateY(10px) scale(0.98); }
          16%, 36% { opacity: 1; transform: translateY(0) scale(1); }
          42%, 100% { opacity: 0; transform: translateY(-5px) scale(0.98); }
        }

        @keyframes pillar-row-focus {
          0%, 75%, 100% { background: transparent; transform: translateX(0); }
          8%, 20% { background: hsl(var(--primary) / 0.11); transform: translateX(2px); }
        }

        @keyframes pillar-dot-pulse {
          0%, 100% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        @keyframes pillar-typing {
          0%, 14%, 100% { opacity: 0; transform: translateY(8px); }
          22%, 48% { opacity: 1; transform: translateY(0); }
        }

        @keyframes pillar-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-3px); opacity: 1; }
        }

        @keyframes pillar-chunk-rise {
          0% { opacity: 0; transform: translateY(20px) scale(0.92); }
          20%, 60% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-18px) scale(0.96); }
        }

        @keyframes pillar-progress-fill {
          0%, 15% { transform: scaleX(0.18); opacity: 0.6; }
          55%, 75% { transform: scaleX(0.88); opacity: 1; }
          100% { transform: scaleX(0.35); opacity: 0.7; }
        }

        @keyframes pillar-flow {
          0% { left: 0%; opacity: 0; }
          14%, 80% { opacity: 1; }
          100% { left: calc(100% - 6px); opacity: 0; }
        }

        @keyframes pillar-wave {
          0%, 100% { transform: scaleY(0.35); opacity: 0.4; }
          35% { transform: scaleY(1); opacity: 1; }
          70% { transform: scaleY(0.55); opacity: 0.65; }
        }

        @keyframes pillar-transcript {
          0%, 8% { opacity: 0; transform: translateX(-6px); }
          15%, 40% { opacity: 1; transform: translateX(0); }
          52%, 100% { opacity: 0; transform: translateX(5px); }
        }

        @keyframes pillar-launcher-ping {
          0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.45); }
          75%, 100% { box-shadow: 0 0 0 14px hsl(var(--primary) / 0); }
        }

        @keyframes pillar-widget-flow {
          0% { left: 0%; opacity: 0; }
          20%, 70% { opacity: 1; }
          100% { left: calc(100% - 6px); opacity: 0; }
        }

        @keyframes pillar-bar-grow {
          0%, 14% { transform: scaleY(0.2); opacity: 0.5; }
          45%, 70% { transform: scaleY(1); opacity: 1; }
          100% { transform: scaleY(0.45); opacity: 0.65; }
        }

        @keyframes pillar-line-draw {
          0% { stroke-dashoffset: 140; opacity: 0.2; }
          40%, 75% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -25; opacity: 0.7; }
        }

        @keyframes pillar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pillar-card-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        @keyframes pillar-metric-glow {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); }
          45% { box-shadow: 0 0 0 8px hsl(var(--primary) / 0.08); }
        }

        .pillar-anim {
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .pillar-anim {
            animation: none !important;
            transition-duration: 0ms !important;
          }
        }
      `}</style>

      <div className="relative z-10 mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
            Product Pillars
          </div> */}
          <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            One support platform, six workflows, always in motion.
          </h2>
          {/* <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            See inbox automation, channel routing, voice handling, knowledge chunking, widget
            conversations, and analytics insights working together as a single smooth loop.
          </p> */}
        </div>

        {/* <div className="mx-auto mt-7 grid max-w-5xl grid-cols-1 gap-2.5 sm:grid-cols-3">
          {PILLAR_METRICS.map((metric, index) => (
            <div
              key={metric.label}
              className="rounded-xl border border-border/80 bg-background/75 px-3 py-2 text-center backdrop-blur-sm"
              style={{
                animation: 'pillar-metric-glow 5.4s ease-in-out infinite',
                animationDelay: `${index * 0.55}s`,
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{metric.value}</p>
              <p className="text-[10px] text-muted-foreground">{metric.note}</p>
            </div>
          ))}
        </div> */}

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <PillarCard
            title="Inbox"
            status="Live"
            description="Resolve more conversations from one unified, real-time workspace."
            href="/inbox"
            highlights={['Live routing', 'Smart handoff']}
            className="order-1 lg:col-span-6"
          >
            <InboxPreview />
          </PillarCard>

          <PillarCard
            title="Channels"
            status="Connected"
            description="Route chat, email, and WhatsApp into one queue with zero context switching."
            href="/settings/channels"
            highlights={['Email + WhatsApp', 'Unified queue']}
            className="order-2 lg:col-span-3"
          >
            <ChannelsPreview />
          </PillarCard>

          <PillarCard
            title="Knowledge Base"
            status="Synced"
            description="Ingest docs, split chunks, and keep answers grounded in trusted sources."
            href="/knowledge"
            highlights={['Source chunking', 'Citation ready']}
            className="order-3 lg:col-span-3"
          >
            <KnowledgePreview />
          </PillarCard>

          <PillarCard
            title="Voice"
            status="Always On"
            description="Handle calls with live waveform intelligence and instant transcripts."
            href="/voice-assistant"
            highlights={['Realtime transcript', 'AI call control']}
            className="order-4 lg:col-span-3"
          >
            <VoicePreview />
          </PillarCard>

          <PillarCard
            title="Widget"
            status="Active"
            description="Convert site visitors with embedded support journeys end to end."
            href="/widget"
            highlights={['On-page assist', 'Conversion flow']}
            className="order-5 lg:col-span-3"
          >
            <WidgetPreview />
          </PillarCard>

          <PillarCard
            title="Analytics"
            status="Insight Ready"
            description="Track deflection, trend lines, and channel performance in one glance."
            href="/analytics"
            highlights={['Trend intelligence', 'KPI snapshots']}
            className="order-6 lg:col-span-6"
          >
            <AnalyticsPreview />
          </PillarCard>
        </div>
      </div>
    </section>
  )
}

function PillarCard({ title, status, description, href, highlights, className, children }: PillarCardProps) {
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-border/70 bg-card/45 p-4 shadow-[0_14px_42px_-28px_hsl(var(--foreground)/0.45)] transition-all duration-500 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_24px_45px_-30px_hsl(var(--primary)/0.4)] md:p-5',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(circle at 86% -10%, hsl(var(--primary) / 0.22), transparent 42%), radial-gradient(circle at 4% 94%, hsl(var(--primary) / 0.1), transparent 44%)',
        }}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Core Workflow
            </p>
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {status}
          </span>
        </div>

        <div className="mt-4 min-h-[232px] flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-3 backdrop-blur-sm md:p-4">
          {children}
        </div>

        <div className="mt-4">
          {highlights?.length ? (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {highlights.map((item, index) => (
                <span
                  key={`${title}-highlight-${index}-${item}`}
                  className="rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-end justify-between gap-4">
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            <Link
              href={href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/30 hover:text-primary"
            >
              Explore
              <ArrowUpRightIcon className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

function InboxPreview() {
  return (
    <div className="grid h-full min-h-[220px] grid-cols-[minmax(0,1fr)_minmax(0,1.28fr)] overflow-hidden rounded-xl border border-border/70">
      <div className="border-r border-border/70 bg-muted/30 p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conversations
          </p>
          <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            24
          </span>
        </div>

        <div className="space-y-1.5">
          {INBOX_ROWS.map((row, index) => (
            <div
              key={row.customer}
              className="pillar-anim flex items-start gap-2 rounded-lg border border-transparent px-2 py-1.5"
              style={{
                animationName: 'pillar-row-focus',
                animationDuration: '8s',
                animationDelay: `${index * 1.15}s`,
              }}
            >
              <span className="mt-0.5 size-2.5 rounded-full bg-primary/70" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-[10px] font-semibold text-foreground">{row.customer}</p>
                  <span className="text-[9px] text-muted-foreground">{row.channel}</span>
                </div>
                <p className="truncate text-[9px] text-muted-foreground">{row.text}</p>
              </div>
              <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-muted-foreground">
                {row.state}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col bg-gradient-to-b from-background via-muted/20 to-background">
        <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold text-foreground">Order support thread</p>
            <p className="text-[9px] text-muted-foreground">AI + Agent handoff ready</p>
          </div>
          <span
            className="pillar-anim size-2 rounded-full bg-emerald-400"
            style={{ animationName: 'pillar-dot-pulse', animationDuration: '1.5s' }}
          />
        </div>

        <div className="relative flex-1 overflow-hidden p-2.5">
          <div className="flex h-full flex-col justify-end gap-1.5">
            <div
              className="pillar-anim max-w-[85%] self-start rounded-xl rounded-bl-sm border border-border/70 bg-background px-2 py-1.5 text-[9px] text-foreground"
              style={{ animationName: 'pillar-msg-loop', animationDuration: '9s' }}
            >
              Hi, my package still has not arrived.
            </div>
            <div
              className="pillar-anim max-w-[80%] self-end rounded-xl rounded-br-sm bg-primary px-2 py-1.5 text-[9px] text-primary-foreground"
              style={{
                animationName: 'pillar-msg-loop',
                animationDuration: '9s',
                animationDelay: '1.25s',
              }}
            >
              I checked it, delivery is expected tomorrow before 6 PM.
            </div>
            <div
              className="pillar-anim max-w-[82%] self-start rounded-xl rounded-bl-sm border border-border/70 bg-background px-2 py-1.5 text-[9px] text-foreground"
              style={{
                animationName: 'pillar-msg-loop',
                animationDuration: '9s',
                animationDelay: '2.5s',
              }}
            >
              Great, can I change drop-off location?
            </div>

            <div
              className="pillar-anim inline-flex w-fit items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-1"
              style={{
                animationName: 'pillar-typing',
                animationDuration: '9s',
                animationDelay: '3.75s',
              }}
            >
              {[0, 0.15, 0.3].map((delay) => (
                <span
                  key={delay}
                  className="pillar-anim size-1.5 rounded-full bg-muted-foreground"
                  style={{
                    animationName: 'pillar-bounce',
                    animationDuration: '0.95s',
                    animationDelay: `${delay}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KnowledgePreview() {
  return (
    <div className="flex h-full min-h-[220px] flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-2.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sources</p>
          <p className="text-xs font-semibold text-foreground">Knowledge Pipeline</p>
        </div>
        <span className="rounded-md border border-border/70 bg-background px-2 py-0.5 text-[10px] text-foreground">
          85 Chunks
        </span>
      </div>

      <div className="space-y-1.5">
        {KB_SOURCES.map((item) => (
          <div key={item.name} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-2 py-1.5">
            <BookOpenIcon className="size-3.5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-medium text-foreground">{item.name}</p>
              <p className="text-[9px] text-muted-foreground">{item.chunks} chunks indexed</p>
            </div>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-primary">
              {item.type}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-lg border border-border/70 bg-background/80 p-2">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Chunking Activity</p>
        <div className="relative mt-2 h-10 overflow-hidden rounded border border-dashed border-border/70 bg-muted/40">
          {[0, 1, 2, 3].map((item) => (
            <span
              key={item}
              className="pillar-anim absolute bottom-1 rounded bg-primary/15 px-1.5 py-0.5 text-[8px] font-semibold text-primary"
              style={{
                left: `${8 + item * 22}%`,
                animationName: 'pillar-chunk-rise',
                animationDuration: '4.6s',
                animationDelay: `${item * 0.8}s`,
              }}
            >
              chunk_{item + 1}
            </span>
          ))}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted">
          <div
            className="pillar-anim h-full origin-left rounded-full bg-primary"
            style={{ animationName: 'pillar-progress-fill', animationDuration: '4.8s' }}
          />
        </div>
      </div>
    </div>
  )
}

function ChannelsPreview() {
  return (
    <div className="relative h-full min-h-[220px] overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-2.5">
      <div className="absolute right-2.5 top-1/2 w-[44%] -translate-y-1/2 rounded-lg border border-border/70 bg-background/90 p-2">
        <div className="flex items-center gap-1.5">
          <InboxIcon className="size-3.5 text-primary" />
          <p className="text-[10px] font-semibold text-foreground">Unified Inbox</p>
        </div>
        <p className="mt-1 text-[9px] text-muted-foreground">All channels merged into one queue.</p>
        <div className="mt-2 space-y-1">
          <div className="h-1.5 rounded-full bg-primary/40" />
          <div className="h-1.5 w-4/5 rounded-full bg-muted" />
          <div className="h-1.5 w-2/3 rounded-full bg-muted" />
        </div>
      </div>

      <div className="relative z-10 flex h-full w-[50%] flex-col justify-center gap-2">
        {CHANNEL_ROWS.map((item, index) => (
          <div key={item.name} className="relative rounded-lg border border-border/70 bg-background/90 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <item.icon className={cn('size-3.5', item.color)} />
              <p className="text-[10px] font-medium text-foreground">{item.name}</p>
            </div>
            <span
              className="pillar-anim absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-400"
              style={{
                animationName: 'pillar-dot-pulse',
                animationDuration: '1.3s',
                animationDelay: `${index * 0.2}s`,
              }}
            />
          </div>
        ))}
      </div>

      {[26, 50, 74].map((top, index) => (
        <div
          key={top}
          className="absolute left-[50%] z-0 h-px w-[30%] bg-border/70"
          style={{ top: `${top}%` }}
        >
          <span
            className="pillar-anim absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary"
            style={{
              animationName: 'pillar-flow',
              animationDuration: '2.5s',
              animationDelay: `${index * 0.85}s`,
            }}
          />
        </div>
      ))}
    </div>
  )
}

function VoicePreview() {
  return (
    <div className="flex h-full min-h-[220px] flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-2.5">
      <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/90 px-2.5 py-2">
        <div className="flex items-center gap-2">
          <span
            className="pillar-anim flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary"
            style={{ animationName: 'pillar-card-float', animationDuration: '2.2s' }}
          >
            <PhoneCallIcon className="size-3.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold text-foreground">Live AI Call</p>
            <p className="text-[9px] text-muted-foreground">00:19 in progress</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-600">
          Active
        </span>
      </div>

      <div className="rounded-lg border border-border/70 bg-background/90 px-2 py-2.5">
        <div className="flex h-12 items-end gap-1">
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="pillar-anim w-1 origin-bottom rounded-full bg-primary/75"
              style={{
                height: `${22 + ((index * 9) % 62)}%`,
                animationName: 'pillar-wave',
                animationDuration: '1.2s',
                animationDelay: `${index * 0.06}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-background/90 p-2">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Transcript</p>
        <div className="mt-1.5 space-y-1">
          <p
            className="pillar-anim truncate text-[9px] text-foreground"
            style={{ animationName: 'pillar-transcript', animationDuration: '6s' }}
          >
            Customer: I want to reschedule delivery.
          </p>
          <p
            className="pillar-anim truncate text-[9px] text-primary"
            style={{
              animationName: 'pillar-transcript',
              animationDuration: '6s',
              animationDelay: '1.3s',
            }}
          >
            AI: Sure, I can move it to Friday afternoon.
          </p>
          <p
            className="pillar-anim truncate text-[9px] text-foreground"
            style={{
              animationName: 'pillar-transcript',
              animationDuration: '6s',
              animationDelay: '2.6s',
            }}
          >
            Customer: Perfect, please confirm by SMS.
          </p>
        </div>
      </div>
    </div>
  )
}

function WidgetPreview() {
  return (
    <div className="relative h-full min-h-[220px] overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-2.5">
      <div className="grid h-full grid-cols-[1fr_minmax(0,148px)] gap-2">
        <div className="rounded-lg border border-border/70 bg-background/90 p-2">
          <p className="text-[10px] font-semibold text-foreground">Storefront</p>
          <div className="mt-2 space-y-1.5">
            <div className="h-2 w-4/5 rounded-full bg-muted" />
            <div className="h-2 w-3/5 rounded-full bg-muted" />
            <div className="h-10 rounded border border-border/60 bg-muted/50" />
            <div className="inline-flex rounded-md bg-primary/15 px-2 py-1 text-[9px] font-semibold text-primary">
              Need help with delivery?
            </div>
          </div>
        </div>

        <div className="relative rounded-lg border border-border/70 bg-background/90 p-1.5">
          <div className="rounded-md bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground">
            Tinfin Assistant
          </div>
          <div className="mt-1.5 space-y-1">
            <div
              className="pillar-anim w-[88%] rounded-md border border-border/70 bg-background px-1.5 py-1 text-[8px] text-foreground"
              style={{ animationName: 'pillar-msg-loop', animationDuration: '7.4s' }}
            >
              Hi, where is my order?
            </div>
            <div
              className="pillar-anim ml-auto w-[90%] rounded-md bg-primary px-1.5 py-1 text-[8px] text-primary-foreground"
              style={{
                animationName: 'pillar-msg-loop',
                animationDuration: '7.4s',
                animationDelay: '1.35s',
              }}
            >
              It is out for delivery and arriving today.
            </div>
          </div>

          <button
            type="button"
            className="pillar-anim absolute -bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
            style={{
              animationName: 'pillar-launcher-ping',
              animationDuration: '2.2s',
            }}
          >
            <MessageCircleIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="absolute bottom-[38%] left-[48%] h-px w-[18%] bg-border/70">
        <span
          className="pillar-anim absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ animationName: 'pillar-widget-flow', animationDuration: '2.1s' }}
        />
      </div>
    </div>
  )
}

function AnalyticsPreview() {
  return (
    <div className="grid h-full min-h-[220px] grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)] gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-2.5">
      <div className="rounded-lg border border-border/70 bg-background/90 p-2.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Conversations
            </p>
            <p className="text-xs font-semibold text-foreground">Resolution trend</p>
          </div>
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
            +18%
          </span>
        </div>

        <div className="relative mt-2 h-[118px] overflow-hidden rounded-md border border-border/70 bg-background/80 px-2 pb-1 pt-2">
          <div className="flex h-full items-end gap-1.5">
            {ANALYTICS_BARS.map((value, index) => (
              <span
                key={`analytics-bar-${index}-${value}`}
                className="pillar-anim block w-3 origin-bottom rounded-t-md bg-primary/70"
                style={{
                  height: `${value}%`,
                  animationName: 'pillar-bar-grow',
                  animationDuration: '3.8s',
                  animationDelay: `${index * 0.18}s`,
                }}
              />
            ))}
          </div>

          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 220 118"
            preserveAspectRatio="none"
          >
            <polyline
              points="4,95 36,82 68,89 100,64 132,69 164,48 196,52 216,36"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="140"
              className="pillar-anim"
              style={{ animationName: 'pillar-line-draw', animationDuration: '4.2s' }}
            />
          </svg>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/70 bg-background/90 p-2">
            <p className="text-[9px] text-muted-foreground">Deflection</p>
            <p className="mt-1 text-sm font-semibold text-foreground">41%</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/90 p-2">
            <p className="text-[9px] text-muted-foreground">FRT</p>
            <p className="mt-1 text-sm font-semibold text-foreground">1m 48s</p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-3 rounded-lg border border-border/70 bg-background/90 p-2.5">
          <div
            className="pillar-anim relative size-16 rounded-full"
            style={{
              background:
                'conic-gradient(hsl(var(--primary)) 0 56%, hsl(var(--primary) / 0.35) 56% 78%, hsl(var(--primary) / 0.15) 78% 100%)',
              animationName: 'pillar-spin',
              animationDuration: '5.8s',
            }}
          >
            <div className="absolute inset-2 rounded-full bg-background" />
            <span className="absolute inset-0 z-10 flex items-center justify-center text-[10px] font-semibold text-foreground">
              56%
            </span>
          </div>

          <div className="space-y-1 text-[9px]">
            <p className="flex items-center gap-1 text-muted-foreground">
              <SparklesIcon className="size-3 text-primary" /> AI resolved
            </p>
            <p className="flex items-center gap-1 text-muted-foreground">
              <BotIcon className="size-3 text-violet-500" /> 1,328 tickets
            </p>
            <p className="flex items-center gap-1 text-muted-foreground">
              <BarChart3Icon className="size-3 text-emerald-500" /> Weekly growth
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

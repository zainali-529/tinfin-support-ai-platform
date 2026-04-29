'use client'

import Link from 'next/link'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  Clock3Icon,
  InboxIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  PanelsTopLeftIcon,
  TrendingDownIcon,
  WorkflowIcon,
} from 'lucide-react'

const PAIN_POINTS = [
  {
    title: 'Ticket overload',
    metric: '247 open tickets',
    detail: 'Backlogs build up when volume spikes faster than team capacity.',
    accent: 'amber',
    impact: '36% of incoming requests stay unresolved after 2 hours.',
    icon: AlertTriangleIcon,
  },
  {
    title: 'Slow first response',
    metric: '18m avg first reply',
    detail: 'Every extra minute increases drop-off and frustration.',
    accent: 'rose',
    impact: 'Response delay is directly reducing conversion and satisfaction.',
    icon: Clock3Icon,
  },
  {
    title: 'Context switching',
    metric: '5 tools per agent',
    detail: 'Channel hopping burns focus and creates QA inconsistency.',
    accent: 'orange',
    impact: 'Fragmented tooling causes missed context and inconsistent tone.',
    icon: WorkflowIcon,
  },
] as const

const IMPACT_STATS = [
  { label: 'First Response', before: '18m', after: '<2m', note: 'With AI routing + assist' },
  { label: 'Open Backlog', before: '247', after: '109', note: 'Queue pressure reduction' },
  { label: 'Context Switches', before: '5 tools', after: '1 inbox', note: 'Single workspace flow' },
] as const

export function WhyNowSection() {
  return (
    <section className="relative bg-background pt-20 pb-20 md:pt-24 md:pb-24">
      <style>{`
        @keyframes why-progress-sweep {
          0% { left: -20%; opacity: 0; }
          20%, 75% { opacity: 1; }
          100% { left: 105%; opacity: 0; }
        }

        @keyframes why-timeline-pulse {
          0%, 100% { transform: scale(0.9); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        @keyframes why-badge-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        @keyframes why-signal-flow {
          0% { left: 0%; opacity: 0; }
          18%, 72% { opacity: 1; }
          100% { left: calc(100% - 8px); opacity: 0; }
        }

        @keyframes why-strip-shift {
          0%, 100% { transform: translateX(0); opacity: 0.6; }
          50% { transform: translateX(3px); opacity: 1; }
        }

        @keyframes why-card-sheen {
          0% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
          24%, 70% { opacity: 0.35; }
          100% { transform: translateX(160%) skewX(-18deg); opacity: 0; }
        }

        @keyframes why-arrow-shift {
          0%, 100% { transform: translateX(0); opacity: 0.45; }
          50% { transform: translateX(4px); opacity: 1; }
        }

        .why-anim {
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .why-anim {
            animation: none !important;
            transition-duration: 0ms !important;
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-1.5 text-xs text-muted-foreground">
              Why now
            </div>

            <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Support breaks when volume scales.
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Ticket overload, delayed first replies, constant context switching, and uneven quality
              create a compounding support bottleneck. Teams need one focused system before volume
              outgrows execution.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
              {IMPACT_STATS.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border/75 bg-background/80 px-3 py-2.5"
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{item.label}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{item.before}</span>
                    <ArrowRightIcon className="size-3 text-muted-foreground" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{item.after}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{item.note}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button variant="outline" asChild className="rounded-full">
                <Link href="/dashboard" className="inline-flex items-center gap-1.5">
                  See how Tinfin fixes this
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">No extra headcount required to start.</p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-border/80 bg-background/70 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="why-anim size-2 rounded-full bg-rose-500"
                  style={{ animationName: 'why-timeline-pulse', animationDuration: '1.6s' }}
                />
                <p className="text-xs font-medium text-foreground">Operational strain is compounding each hour</p>
              </div>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <TrendingDownIcon className="size-3" />
                SLA at risk
              </Badge>
            </div>

            <div className="space-y-3">
              {PAIN_POINTS.map((pain, index) => (
                <PainCard key={pain.title} pain={pain} index={index} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          <div className="rounded-2xl border border-amber-300/50 bg-amber-50/45 px-4 py-3 dark:bg-amber-950/20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              Before
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">Agents juggling tabs and losing context.</p>
            <p className="mt-0.5 text-xs text-muted-foreground">High queue pressure, delayed replies, and QA drift.</p>
          </div>

          <div className="hidden items-center justify-center md:flex">
            <ArrowRightIcon
              className="why-anim size-4 text-muted-foreground"
              style={{ animationName: 'why-arrow-shift', animationDuration: '2.2s' }}
            />
          </div>

          <div className="rounded-2xl border border-emerald-300/50 bg-emerald-50/45 px-4 py-3 dark:bg-emerald-950/20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              After
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">One inbox + AI assist with consistent responses.</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Faster resolution, focused agents, measurable SLA recovery.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

type PainPoint = (typeof PAIN_POINTS)[number]

function PainCard({ pain, index }: { pain: PainPoint; index: number }) {
  const isTicket = pain.title === 'Ticket overload'
  const isResponse = pain.title === 'Slow first response'
  const isSwitch = pain.title === 'Context switching'
  const Icon = pain.icon

  const accentClass =
    pain.accent === 'amber'
      ? 'border-amber-300/45 bg-amber-50/50 dark:bg-amber-950/20'
      : pain.accent === 'rose'
        ? 'border-rose-300/40 bg-rose-50/50 dark:bg-rose-950/20'
        : 'border-orange-300/45 bg-orange-50/50 dark:bg-orange-950/20'

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border px-4 py-3 backdrop-blur-sm transition-all duration-400 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-24px_hsl(var(--foreground)/0.5)] ${accentClass}`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <span
          className="why-anim absolute top-0 h-full w-14 bg-gradient-to-r from-transparent via-background/55 to-transparent"
          style={{ animationName: 'why-card-sheen', animationDuration: '3.8s', animationDelay: `${index * 0.35}s` }}
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-lg border border-background/70 bg-background/85">
              <Icon className="size-3.5 text-foreground" />
            </span>
            <p className="text-sm font-semibold text-foreground">{pain.title}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{pain.detail}</p>
        </div>
        <span
          className="why-anim inline-flex items-center rounded-full border border-background/70 bg-background/85 px-2 py-1 text-[10px] font-semibold text-foreground"
          style={{ animationName: 'why-badge-float', animationDuration: '2.8s', animationDelay: `${index * 0.25}s` }}
        >
          {pain.metric}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">{pain.impact}</p>

      {isTicket ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-background/80 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Queue pressure
            </p>
            <AlertTriangleIcon className="size-3.5 text-amber-600" />
          </div>
          <div className="mt-2 h-2 rounded-full bg-amber-200/50 dark:bg-amber-900/35">
            <div className="relative h-full w-[78%] overflow-hidden rounded-full bg-amber-500/70">
              <span
                className="why-anim absolute top-1/2 h-1.5 w-7 -translate-y-1/2 rounded-full bg-amber-100/90"
                style={{ animationName: 'why-progress-sweep', animationDuration: '2.4s' }}
              />
            </div>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">94 tickets waiting beyond SLA threshold.</p>
        </div>
      ) : null}

      {isResponse ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-background/80 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Reply timeline
            </p>
            <Clock3Icon className="size-3.5 text-rose-600" />
          </div>
          <div className="relative mt-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            {[2, 7, 18].map((min, nodeIndex) => (
              <div key={min} className="flex flex-col items-center gap-1">
                <span
                  className="why-anim size-2 rounded-full bg-rose-500"
                  style={{
                    animationName: 'why-timeline-pulse',
                    animationDuration: '1.7s',
                    animationDelay: `${nodeIndex * 0.25}s`,
                  }}
                />
                <span className="text-[9px] font-medium text-muted-foreground">{min}m</span>
              </div>
            ))}
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Reply latency grows as queue depth increases.</p>
        </div>
      ) : null}

      {isSwitch ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-background/80 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Context load
            </p>
            <PanelsTopLeftIcon className="size-3.5 text-orange-600" />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <ChannelChip icon={MessageSquareIcon} label="Chat" />
            <ChannelChip icon={MailIcon} label="Email" />
            <ChannelChip icon={MessageCircleIcon} label="WhatsApp" />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="relative h-px flex-1 bg-border">
              <span
                className="why-anim absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-orange-500"
                style={{ animationName: 'why-signal-flow', animationDuration: '2.4s' }}
              />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-1 text-[10px] font-semibold text-foreground">
              <InboxIcon className="size-3" />
              Unified inbox
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Fragmented channels create duplicated and missed replies.</p>
        </div>
      ) : null}

      <div className="why-anim pointer-events-none absolute inset-x-4 bottom-1.5 h-px bg-gradient-to-r from-transparent via-foreground/25 to-transparent"
        style={{ animationName: 'why-strip-shift', animationDuration: '3.2s', animationDelay: `${index * 0.2}s` }}
      />
    </article>
  )
}

function ChannelChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-1 text-[10px] text-muted-foreground">
      <Icon className="size-3" />
      {label}
    </span>
  )
}

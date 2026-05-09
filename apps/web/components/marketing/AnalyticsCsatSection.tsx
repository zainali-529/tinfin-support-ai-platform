"use client"

import { useEffect, useState } from "react"
import {
  ActivityIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  GaugeIcon,
  HeartHandshakeIcon,
  LineChartIcon,
  RadioTowerIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const ANALYTICS_IMAGE = "track.png"
const ANALYTICS_FALLBACK_IMAGE = "analytics.png"

const SIGNALS = [
  {
    icon: ActivityIcon,
    title: "Conversation demand",
    body: "Track volume, intake patterns, and resolution movement before queues pile up.",
  },
  {
    icon: GaugeIcon,
    title: "SLA pressure",
    body: "See at-risk and breached conversations beside the channels causing pressure.",
  },
  {
    icon: HeartHandshakeIcon,
    title: "CSAT",
    body: "Measure customer sentiment after resolved conversations and compare AI vs human handling.",
  },
  {
    icon: SparklesIcon,
    title: "AI and action quality",
    body: "Review AI confidence, action success, failure reasons, retries, and latency.",
  },
  {
    icon: RadioTowerIcon,
    title: "Channel quality",
    body: "Understand where chat, email, WhatsApp, and voice need operational attention.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Readiness checks",
    body: "Confirm the workspace has the essentials configured before support volume grows.",
  },
] as const

const SCORE_STRIPS = [
  { label: "Demand", value: "Volume trend", tone: "primary" },
  { label: "SLA", value: "Pressure view", tone: "warning" },
  { label: "CSAT", value: "Customer signal", tone: "success" },
] as const

type MarketingTheme = "light" | "dark"

function mediaSrc(theme: MarketingTheme, image: string) {
  return `/marketing/images/${theme}/${image}`
}

export function AnalyticsCsatSection() {
  return (
    <section id="analytics-csat" className="relative overflow-hidden bg-background py-20 md:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute right-[-14rem] top-20 -z-10 h-[34rem] w-[34rem] rounded-full bg-primary/8 blur-3xl"
      />

      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(300px,0.36fr)_minmax(0,0.64fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <div className="inline-flex border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Analytics and CSAT
            </div>
            <h2 className="mt-5 max-w-xl text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Measure support quality without hunting through reports.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
              Tinfiz turns conversation demand, SLA pressure, customer satisfaction, AI quality, and channel health into one operational view for the team.
            </p>

            <div className="mt-8 border border-border bg-muted/20 p-1.5">
              {SCORE_STRIPS.map((strip) => (
                <div key={strip.label} className="grid grid-cols-[6.5rem_1fr] border-b border-border bg-background px-3 py-3 last:border-b-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {strip.label}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      strip.tone === "primary" && "text-primary",
                      strip.tone === "warning" && "text-amber-600",
                      strip.tone === "success" && "text-emerald-600"
                    )}
                  >
                    {strip.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="analytics-stage border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center border border-border bg-background text-primary">
                    <LineChartIcon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Performance and satisfaction</p>
                    <p className="text-xs text-muted-foreground">Demand, SLA, CSAT, AI quality, and channel visibility.</p>
                  </div>
                </div>
                <div className="hidden items-center gap-2 border border-border bg-background px-3 py-1 text-xs text-muted-foreground sm:flex">
                  <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                  Quality view
                </div>
              </div>

              <AnalyticsMedia />
            </div>

            <div className="mt-5 grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-3">
              {SIGNALS.map((signal, index) => (
                <AnalyticsSignal key={signal.title} signal={signal} index={index} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes analytics-stage-scan {
          0%, 100% {
            transform: translateX(-42%);
            opacity: 0;
          }
          18%, 72% {
            opacity: 0.42;
          }
          100% {
            transform: translateX(142%);
          }
        }

        .analytics-stage {
          position: relative;
          overflow: hidden;
        }

        .analytics-stage::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            105deg,
            transparent 0%,
            transparent 40%,
            color-mix(in oklch, var(--primary) 10%, transparent) 50%,
            transparent 60%,
            transparent 100%
          );
          animation: analytics-stage-scan 7.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .analytics-stage::after {
            animation: none !important;
            opacity: 0;
          }
        }
      `}</style>
    </section>
  )
}

function AnalyticsMedia() {
  const [lightSrc, setLightSrc] = useState(() => mediaSrc("light", ANALYTICS_IMAGE))
  const [darkSrc, setDarkSrc] = useState(() => mediaSrc("dark", ANALYTICS_IMAGE))
  const [darkUnavailable, setDarkUnavailable] = useState(false)

  useEffect(() => {
    const preloadTargets = [
      mediaSrc("light", ANALYTICS_IMAGE),
      mediaSrc("dark", ANALYTICS_IMAGE),
      mediaSrc("light", ANALYTICS_FALLBACK_IMAGE),
      mediaSrc("dark", ANALYTICS_FALLBACK_IMAGE),
    ]

    for (const src of preloadTargets) {
      const image = new Image()
      image.decoding = "async"
      image.src = src
    }
  }, [])

  const handleLightError = () => {
    const fallback = mediaSrc("light", ANALYTICS_FALLBACK_IMAGE)
    if (lightSrc !== fallback) {
      setLightSrc(fallback)
    }
  }

  const handleDarkError = () => {
    const fallback = mediaSrc("dark", ANALYTICS_FALLBACK_IMAGE)

    if (darkSrc !== fallback) {
      setDarkSrc(fallback)
      return
    }

    setDarkUnavailable(true)
  }

  return (
    <div className="relative aspect-video overflow-hidden bg-muted/20">
      <img
        src={lightSrc}
        alt="Tinfiz analytics and CSAT reporting dashboard"
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-left-top transition-opacity duration-300",
          darkUnavailable ? "dark:opacity-100" : "dark:opacity-0"
        )}
        loading="lazy"
        decoding="async"
        onError={handleLightError}
      />
      {!darkUnavailable ? (
        <img
          src={darkSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-left-top opacity-0 transition-opacity duration-300 dark:opacity-100"
          loading="lazy"
          decoding="async"
          onError={handleDarkError}
        />
      ) : null}
    </div>
  )
}

function AnalyticsSignal({
  signal,
  index,
}: {
  signal: (typeof SIGNALS)[number]
  index: number
}) {
  const Icon = signal.icon

  return (
    <div className="bg-background p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center border border-border bg-muted/20 text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">0{index + 1}</span>
            <h3 className="text-sm font-medium tracking-tight text-foreground">{signal.title}</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.body}</p>
        </div>
      </div>
    </div>
  )
}

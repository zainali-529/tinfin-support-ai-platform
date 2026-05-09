"use client"

import { useEffect, useState } from "react"
import {
  BrainCircuit,
  Clock3,
  Inbox,
  ListFilter,
  NotebookText,
  Radio,
  UserRoundCheck,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const INBOX_FEATURES = [
  {
    id: "realtime",
    icon: Radio,
    title: "Realtime conversations",
    body: "Live messages, assignments, notes, and timeline events without refresh cycles.",
    image: "inbox-realtime.png",
  },
  {
    id: "saved-views",
    icon: ListFilter,
    title: "Saved views",
    body: "Focused queues for My open, Unassigned, SLA risk, handoff, and channels.",
    image: "inbox-saved-views.png",
  },
  {
    id: "assignments",
    icon: UserRoundCheck,
    title: "Assignments",
    body: "Clear ownership for every conversation and next handoff.",
    image: "inbox-assignments.png",
  },
  {
    id: "sla-backlog",
    icon: Clock3,
    title: "SLA and backlog",
    body: "At-risk, breached, met, waiting, and backlog signals in context.",
    image: "inbox-sla-backlog.png",
  },
  {
    id: "notes-timeline",
    icon: NotebookText,
    title: "Notes and timeline",
    body: "Internal context, status changes, handoffs, and action activity.",
    image: "inbox-notes-timeline.png",
  },
  {
    id: "agent-copilot",
    icon: BrainCircuit,
    title: "Agent Copilot",
    body: "Drafts, summaries, rewrites, and next-step suggestions for agents.",
    image: "inbox-copilot.png",
  },
] as const

type InboxFeature = (typeof INBOX_FEATURES)[number]
type InboxTheme = "light" | "dark"

const INBOX_FALLBACK_IMAGE = "inbox.png"
const INBOX_STEP_DURATION_MS = 5600

function inboxImageSrc(theme: InboxTheme, image: string) {
  return `/marketing/images/${theme}/${image}`
}

export function UnifiedInboxSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)
  const activeFeature = INBOX_FEATURES[activeIndex] ?? INBOX_FEATURES[0]!
  const ActiveIcon = activeFeature.icon

  useEffect(() => {
    const images = new Set<string>()

    for (const feature of INBOX_FEATURES) {
      images.add(inboxImageSrc("light", feature.image))
      images.add(inboxImageSrc("dark", feature.image))
    }

    images.add(inboxImageSrc("light", INBOX_FALLBACK_IMAGE))
    images.add(inboxImageSrc("dark", INBOX_FALLBACK_IMAGE))

    for (const src of images) {
      const image = new Image()
      image.decoding = "async"
      image.src = src
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % INBOX_FEATURES.length)
      setCycleKey((current) => current + 1)
    }, INBOX_STEP_DURATION_MS)

    return () => window.clearTimeout(timeout)
  }, [activeIndex, cycleKey])

  function selectFeature(index: number) {
    setActiveIndex(index)
    setCycleKey((current) => current + 1)
  }

  return (
    <section id="unified-inbox" className="relative overflow-hidden bg-background py-20 md:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-24 -z-10 h-[34rem] w-[58rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 12%, transparent), transparent 68%)",
        }}
      />

      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-end">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Unified inbox
            </div>
            <h2 className="mt-5 max-w-3xl text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              One place for AI, humans, and customer context to work together.
            </h2>
          </div>

          <p className="max-w-xl text-sm leading-6 text-muted-foreground lg:justify-self-end">
            Tinfiz brings live conversations, ownership, SLA pressure, internal notes, source visibility, and Copilot assistance into the same operational surface. Agents do not need to jump between tabs to understand what is happening.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(260px,0.32fr)_minmax(0,0.68fr)] lg:items-stretch">
          <div className="flex h-full border border-border bg-muted/20 p-1.5">
            <div className="flex w-full flex-col divide-y divide-border overflow-hidden border border-border bg-background">
              {INBOX_FEATURES.map((feature, index) => (
                <InboxFeatureRow
                  key={feature.title}
                  feature={feature}
                  active={index === activeIndex}
                  cycleKey={cycleKey}
                  durationMs={INBOX_STEP_DURATION_MS}
                  onClick={() => selectFeature(index)}
                />
              ))}
            </div>
          </div>

          <div className="relative flex h-full flex-col overflow-hidden border border-border bg-background">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 18%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 42%)",
              }}
            />
            <div className="relative z-10 flex h-12 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="flex size-7 items-center justify-center rounded-lg border border-border bg-background">
                  <ActiveIcon className="size-3.5 text-primary" />
                </span>
                {activeFeature.title}
              </div>
              <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <span className="size-1.5 rounded-full bg-primary" />
                Inbox preview
              </div>
            </div>

            <div className="relative z-10 m-3 aspect-video overflow-hidden border border-border bg-muted/15 sm:m-4">
              {INBOX_FEATURES.map((feature, index) => (
                <InboxScreenshotLayer
                  key={feature.id}
                  feature={feature}
                  active={index === activeIndex}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes inbox-tab-progress {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }

        .inbox-tab-progress {
          transform-origin: left center;
          animation-name: inbox-tab-progress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .inbox-tab-progress {
            animation: none !important;
            transform: scaleX(1);
          }
        }
      `}</style>
    </section>
  )
}

function InboxScreenshotLayer({
  feature,
  active,
}: {
  feature: InboxFeature
  active: boolean
}) {
  const [lightSrc, setLightSrc] = useState(() => inboxImageSrc("light", feature.image))
  const [darkSrc, setDarkSrc] = useState(() => inboxImageSrc("dark", feature.image))
  const [darkUnavailable, setDarkUnavailable] = useState(false)

  useEffect(() => {
    setLightSrc(inboxImageSrc("light", feature.image))
    setDarkSrc(inboxImageSrc("dark", feature.image))
    setDarkUnavailable(false)
  }, [feature.image])

  const handleLightError = () => {
    const fallback = inboxImageSrc("light", INBOX_FALLBACK_IMAGE)
    if (lightSrc !== fallback) {
      setLightSrc(fallback)
    }
  }

  const handleDarkError = () => {
    const fallback = inboxImageSrc("dark", INBOX_FALLBACK_IMAGE)

    if (darkSrc !== fallback) {
      setDarkSrc(fallback)
      return
    }

    setDarkUnavailable(true)
  }

  return (
    <div
      aria-hidden={!active}
      className={cn(
        "absolute inset-0 transition-all duration-500 ease-out",
        active ? "opacity-100 blur-0" : "pointer-events-none opacity-0 blur-md"
      )}
    >
      <img
        src={lightSrc}
        alt=""
        className={cn(
          "absolute inset-0 h-full w-full scale-[1.04] object-cover object-center opacity-20 blur-xl transition-opacity duration-300",
          darkUnavailable ? "dark:opacity-20" : "dark:opacity-0"
        )}
        loading={active ? "eager" : "lazy"}
        decoding="async"
        onError={handleLightError}
      />
      {!darkUnavailable ? (
        <img
          src={darkSrc}
          alt=""
          className="absolute inset-0 h-full w-full scale-[1.04] object-cover object-center opacity-0 blur-xl transition-opacity duration-300 dark:opacity-25"
          loading={active ? "eager" : "lazy"}
          decoding="async"
          onError={handleDarkError}
        />
      ) : null}
      <img
        src={lightSrc}
        alt={`Tinfiz ${feature.title.toLowerCase()} inbox preview`}
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-left-top transition-opacity duration-300",
          darkUnavailable ? "dark:opacity-100" : "dark:opacity-0"
        )}
        loading={active ? "eager" : "lazy"}
        decoding="async"
        onError={handleLightError}
      />
      {!darkUnavailable ? (
        <img
          src={darkSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-left-top opacity-0 transition-opacity duration-300 dark:opacity-100"
          loading={active ? "eager" : "lazy"}
          decoding="async"
          onError={handleDarkError}
        />
      ) : null}
    </div>
  )
}

function InboxFeatureRow({
  feature,
  active,
  cycleKey,
  durationMs,
  onClick,
}: {
  feature: InboxFeature
  active: boolean
  cycleKey: number
  durationMs: number
  onClick: () => void
}) {
  const Icon = feature.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative grid w-full flex-1 gap-3 overflow-hidden p-3.5 text-left transition-colors sm:grid-cols-[auto_1fr]",
        active ? "bg-primary/[0.06]" : "hover:bg-muted/35"
      )}
      aria-pressed={active}
    >
      {active ? (
        <span
          key={`${feature.id}-${cycleKey}`}
          aria-hidden="true"
          className="inbox-tab-progress absolute inset-x-0 bottom-0 h-px bg-primary/80"
          style={{ animationDuration: `${durationMs}ms` }}
        />
      ) : null}
      <span
        className={cn(
          "flex size-8 items-center justify-center border bg-background",
          active ? "border-primary/30 text-primary" : "border-border text-muted-foreground"
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div>
        <h3 className="text-sm font-medium tracking-tight text-foreground">{feature.title}</h3>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{feature.body}</p>
      </div>
    </button>
  )
}

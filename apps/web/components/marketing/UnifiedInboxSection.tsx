 "use client"

import { useState } from "react"
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
    body: "New messages, assignments, notes, and timeline events update without making agents wait on refresh cycles.",
    imageSrc: "/marketing/images/light/inbox.png",
    videoSrc: "/marketing/videos/inbox-realtime.mp4",
  },
  {
    id: "saved-views",
    icon: ListFilter,
    title: "Saved views",
    body: "Keep daily work focused with views like My open, Unassigned, SLA risk, Human takeover, and channel-specific queues.",
    imageSrc: "/marketing/images/light/inbox.png",
    videoSrc: "/marketing/videos/inbox-saved-views.mp4",
  },
  {
    id: "assignments",
    icon: UserRoundCheck,
    title: "Assignments",
    body: "Route ownership clearly so every conversation shows who is responsible and what needs attention next.",
    imageSrc: "/marketing/images/light/inbox.png",
    videoSrc: "/marketing/videos/inbox-assignments.mp4",
  },
  {
    id: "sla-backlog",
    icon: Clock3,
    title: "SLA and backlog",
    body: "Show at-risk, breached, met, waiting, and backlog signals where agents make decisions.",
    imageSrc: "/marketing/images/light/inbox.png",
    videoSrc: "/marketing/videos/inbox-sla-backlog.mp4",
  },
  {
    id: "notes-timeline",
    icon: NotebookText,
    title: "Notes and timeline",
    body: "Capture internal context, status changes, handoff events, contact changes, and action activity beside the thread.",
    imageSrc: "/marketing/images/light/inbox.png",
    videoSrc: "/marketing/videos/inbox-notes-timeline.mp4",
  },
  {
    id: "agent-copilot",
    icon: BrainCircuit,
    title: "Agent Copilot",
    body: "Draft replies, summarize context, rewrite tone, suggest next steps, and keep human agents faster without losing control.",
    imageSrc: "/marketing/images/light/inbox.png",
    videoSrc: "/marketing/videos/inbox-copilot.mp4",
  },
] as const

export function UnifiedInboxSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeFeature = INBOX_FEATURES[activeIndex] ?? INBOX_FEATURES[0]!
  const ActiveIcon = activeFeature.icon

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

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(320px,0.42fr)_minmax(0,0.58fr)]">
          <div className="rounded-[1.55rem] border border-border bg-muted/20 p-2">
            <div className="divide-y divide-border overflow-hidden rounded-[1.2rem] border border-border bg-background">
              {INBOX_FEATURES.map((feature, index) => (
                <InboxFeatureRow
                  key={feature.title}
                  feature={feature}
                  active={index === activeIndex}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
          </div>

          <div className="relative min-h-[520px] overflow-hidden border border-border bg-background lg:min-h-[650px]">
            <div className="flex h-12 items-center justify-between border-b border-border bg-muted/20 px-4">
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

            <div className="absolute inset-x-4 bottom-4 top-14 overflow-hidden border border-border bg-muted/15">
              <video
                key={activeFeature.id}
                src={activeFeature.videoSrc}
                className="hidden h-full w-full object-cover object-left-top"
                muted
                playsInline
                autoPlay
                loop
                preload="metadata"
              />
              <img
                key={`${activeFeature.id}-image`}
                src={activeFeature.imageSrc}
                alt={`Tinfiz ${activeFeature.title.toLowerCase()} inbox preview`}
                className="inbox-media-reveal h-full w-full object-cover object-left-top"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes inbox-media-reveal {
          from {
            opacity: 0;
            filter: blur(10px);
            transform: scale(1.01);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: scale(1);
          }
        }

        .inbox-media-reveal {
          animation: inbox-media-reveal 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .inbox-media-reveal {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  )
}

function InboxFeatureRow({
  feature,
  active,
  onClick,
}: {
  feature: (typeof INBOX_FEATURES)[number]
  active: boolean
  onClick: () => void
}) {
  const Icon = feature.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group grid w-full gap-4 p-5 text-left transition-colors sm:grid-cols-[auto_1fr] sm:p-6",
        active ? "bg-primary/[0.06]" : "hover:bg-muted/35"
      )}
      aria-pressed={active}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center border bg-background",
          active ? "border-primary/30 text-primary" : "border-border text-muted-foreground"
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <div>
        <h3 className="text-base font-medium tracking-tight text-foreground">{feature.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.body}</p>
      </div>
    </button>
  )
}


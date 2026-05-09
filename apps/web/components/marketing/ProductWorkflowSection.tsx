"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BarChart3,
  Bot,
  FileSearch,
  Handshake,
  MousePointer2,
  Pause,
  Play,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const STEP_DURATION_MS = 6000

type WorkflowStep = {
  id: string
  title: string
  eyebrow: string
  description: string
  image: string
  icon: React.ComponentType<{ className?: string }>
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "install-widget",
    title: "Install widget",
    eyebrow: "Step 01",
    description: "Add the customer-facing widget to your site and match it to your brand before customers start chatting.",
    image: "widget-install.png",
    icon: MousePointer2,
  },
  {
    id: "add-knowledge",
    title: "Add Knowledge Base",
    eyebrow: "Step 02",
    description: "Upload approved company knowledge so AI has the right source material to answer from.",
    image: "Knoledge-base.png",
    icon: FileSearch,
  },
  {
    id: "ai-answers",
    title: "AI answers from sources",
    eyebrow: "Step 03",
    description: "AI replies from approved knowledge and shows the team whether an answer is verified.",
    image: "answer-sources.png",
    icon: Bot,
  },
  {
    id: "human-handoff",
    title: "Human takes over",
    eyebrow: "Step 04",
    description: "Agents can take over, assign ownership, add notes, and keep the full timeline in view.",
    image: "human-takeover.png",
    icon: Handshake,
  },
  {
    id: "track-quality",
    title: "Track quality",
    eyebrow: "Step 05",
    description: "Measure support with CSAT, SLA pressure, action quality, and channel reporting.",
    image: "track.png",
    icon: BarChart3,
  },
] as const

function workflowImageSrc(theme: "light" | "dark", image: string) {
  return `/marketing/images/${theme}/${image}`
}

export function ProductWorkflowSection() {
  return (
    <section id="workflow" className="bg-background py-20 md:py-24">
      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="mb-9 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Product workflow
            </div>
            <h2 className="mt-5 max-w-4xl text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              From installed widget to measured support quality.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            A simple loop for running AI support without losing source control, agent ownership, or reporting clarity.
          </p>
        </div>

        <ProductWorkflowPreview />
      </div>
    </section>
  )
}

export function ProductWorkflowPreview({
  className,
  variant = "default",
}: {
  className?: string
  variant?: "default" | "hero"
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [playbackKey, setPlaybackKey] = useState(0)
  const [transitionKey, setTransitionKey] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const remainingMsRef = useRef(STEP_DURATION_MS)
  const startedAtRef = useRef<number | null>(null)

  const activateStep = useCallback((nextIndex: number | ((current: number) => number), options?: { resume?: boolean }) => {
    remainingMsRef.current = STEP_DURATION_MS
    startedAtRef.current = null

    setActiveIndex((current) => {
      const resolvedIndex = typeof nextIndex === 'function' ? nextIndex(current) : nextIndex
      if (resolvedIndex !== current) {
        setTransitionKey((key) => key + 1)
      }

      return resolvedIndex
    })
    if (options?.resume) {
      setIsPaused(false)
    }
    setPlaybackKey((current) => current + 1)
  }, [])

  const goToNextStep = useCallback(() => {
    activateStep((current) => (current + 1) % WORKFLOW_STEPS.length, { resume: true })
  }, [activateStep])

  const activeDurationMs = STEP_DURATION_MS
  const heroVariant = variant === "hero"

  useEffect(() => {
    const preloadedImages = WORKFLOW_STEPS.flatMap((step) =>
      (["light", "dark"] as const).map((theme) => {
        const image = new Image()
        image.decoding = "async"
        image.src = workflowImageSrc(theme, step.image)
        return image
      })
    )

    return () => {
      preloadedImages.length = 0
    }
  }, [])

  useEffect(() => {
    if (isPaused) return undefined

    startedAtRef.current = performance.now()
    const timeout = window.setTimeout(goToNextStep, remainingMsRef.current)

    return () => window.clearTimeout(timeout)
  }, [activeIndex, playbackKey, isPaused, goToNextStep])

  function selectStep(index: number) {
    if (index === activeIndex) {
      togglePlayback()
      return
    }

    activateStep(index, { resume: true })
  }

  function togglePlayback() {
    setIsPaused((current) => {
      if (!current) {
        const startedAt = startedAtRef.current ?? performance.now()
        const elapsedMs = performance.now() - startedAt
        remainingMsRef.current = Math.max(250, remainingMsRef.current - elapsedMs)
        return true
      }

      startedAtRef.current = performance.now()
      return false
    })
  }

  return (
    <div className={className}>
        <div className={cn(
          "grid gap-2 rounded-2xl border border-border bg-muted/20 p-1.5 md:grid-cols-5",
          heroVariant && "rounded-[1.15rem] bg-background/60 backdrop-blur-sm"
        )}>
          {WORKFLOW_STEPS.map((step, index) => (
            <WorkflowTab
              key={step.id}
              step={step}
              active={index === activeIndex}
              paused={isPaused}
              durationMs={index === activeIndex ? activeDurationMs : 0}
              playbackKey={playbackKey}
              transitionKey={transitionKey}
              compact={heroVariant}
              onClick={() => selectStep(index)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={togglePlayback}
          className={cn(
            "group mt-5 block w-full overflow-hidden rounded-[1.15rem] border border-border bg-background p-2 text-left transition-colors hover:border-primary/30",
            heroVariant && "mt-3 rounded-[1rem] bg-background/85 p-1.5 backdrop-blur-sm"
          )}
          aria-label={isPaused ? "Resume workflow preview" : "Pause workflow preview"}
        >
          <div className={cn(
            "relative overflow-hidden rounded-[0.8rem] bg-muted/20 ring-1 ring-border/70",
            heroVariant ? "aspect-[1902/941] rounded-[0.7rem]" : "aspect-video"
          )}>
            {WORKFLOW_STEPS.map((step, index) => {
              const active = index === activeIndex

              return (
                <WorkflowImageStack key={step.id} step={step} active={active} />
              )
            })}
            <div className="pointer-events-none absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </div>
          </div>
        </button>

      <style>{`
        @keyframes workflow-tab-progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        @keyframes workflow-tab-active-reveal {
          from {
            opacity: 0.72;
            filter: blur(8px);
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0);
          }
        }

        .workflow-tab-active-reveal {
          animation: workflow-tab-active-reveal 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .workflow-tab-active-reveal {
            animation: none !important;
          }

          .workflow-tab-progress {
            animation: none !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}

function WorkflowTab({
  step,
  active,
  paused,
  durationMs,
  playbackKey,
  transitionKey,
  compact,
  onClick,
}: {
  step: WorkflowStep
  active: boolean
  paused: boolean
  durationMs: number
  playbackKey: number
  transitionKey: number
  compact?: boolean
  onClick: () => void
}) {
  const Icon = step.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative min-h-[64px] overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors",
        compact && "min-h-[54px] rounded-lg px-2.5 py-2",
        active
          ? "border-primary/25 bg-background text-foreground"
          : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground"
      )}
      aria-pressed={active}
    >
      <span
        key={active ? `${step.id}-${playbackKey}-${durationMs}` : `${step.id}-idle`}
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-0 bg-primary/20",
          active && "workflow-tab-progress"
        )}
        style={active ? {
          animation: `workflow-tab-progress ${durationMs}ms linear forwards`,
          animationPlayState: paused ? "paused" : "running",
        } : undefined}
      />
      <span
        key={active ? `${step.id}-active-${transitionKey}` : `${step.id}-inactive-${transitionKey}`}
        className={cn("relative flex h-full items-center gap-3", active && "workflow-tab-active-reveal")}
      >
        <span className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background/80",
          compact && "size-7 rounded-md",
          active ? "border-primary/25 text-primary" : "border-border/80 text-muted-foreground"
        )}>
          <Icon className={cn("size-3.5", compact && "size-3")} />
        </span>
        <span className="min-w-0">
          <span className={cn("block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground", compact && "text-[9px]")}>
            {step.eyebrow}
          </span>
          <span className={cn("mt-0.5 block truncate text-sm font-medium leading-tight", compact && "text-xs")}>
            {step.title}
          </span>
        </span>
        {active ? (
          <span className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground">
            {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          </span>
        ) : null}
      </span>
    </button>
  )
}

function WorkflowImageStack({ step, active }: { step: WorkflowStep; active: boolean }) {
  const [darkFailed, setDarkFailed] = useState(false)
  const sharedClassName = cn(
    "absolute inset-0 size-full object-cover object-left-top transition-[opacity,filter,transform] duration-700 ease-out",
    active
      ? "blur-0 scale-100"
      : "pointer-events-none opacity-0 blur-sm scale-[1.006]"
  )

  return (
    <>
      <img
        src={workflowImageSrc("light", step.image)}
        alt={`${step.title} workflow preview`}
        className={cn(sharedClassName, active ? (darkFailed ? "opacity-100" : "opacity-100 dark:opacity-0") : "opacity-0")}
        loading="eager"
        decoding="async"
        aria-hidden={!active}
      />
      <img
        src={workflowImageSrc("dark", step.image)}
        alt=""
        className={cn(sharedClassName, active && !darkFailed ? "opacity-0 dark:opacity-100" : "opacity-0")}
        loading="eager"
        decoding="async"
        aria-hidden="true"
        onError={(event) => {
          setDarkFailed(true)
          event.currentTarget.style.display = "none"
        }}
      />
    </>
  )
}

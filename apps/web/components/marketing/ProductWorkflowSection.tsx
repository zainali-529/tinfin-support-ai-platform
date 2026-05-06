"use client"

import { useCallback, useRef, useState } from "react"
import {
  BarChart3,
  Bot,
  FileSearch,
  Handshake,
  MousePointer2,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const FALLBACK_STEP_DURATION_SECONDS = 6
const WORKFLOW_VIDEO_SRC = "/marketing/videos/test.mp4"

type WorkflowStep = {
  id: string
  title: string
  eyebrow: string
  description: string
  videoSrc: string
  icon: React.ComponentType<{ className?: string }>
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "install-widget",
    title: "Install widget",
    eyebrow: "Step 01",
    description: "Add the customer-facing widget to your site and match it to your brand before customers start chatting.",
    videoSrc: WORKFLOW_VIDEO_SRC,
    icon: MousePointer2,
  },
  {
    id: "add-knowledge",
    title: "Add Knowledge Base",
    eyebrow: "Step 02",
    description: "Upload approved company knowledge so AI has the right source material to answer from.",
    videoSrc: WORKFLOW_VIDEO_SRC,
    icon: FileSearch,
  },
  {
    id: "ai-answers",
    title: "AI answers from sources",
    eyebrow: "Step 03",
    description: "AI replies from approved knowledge and shows the team whether an answer is verified.",
    videoSrc: WORKFLOW_VIDEO_SRC,
    icon: Bot,
  },
  {
    id: "human-handoff",
    title: "Human takes over",
    eyebrow: "Step 04",
    description: "Agents can take over, assign ownership, add notes, and keep the full timeline in view.",
    videoSrc: WORKFLOW_VIDEO_SRC,
    icon: Handshake,
  },
  {
    id: "track-quality",
    title: "Track quality",
    eyebrow: "Step 05",
    description: "Measure support with CSAT, SLA pressure, action quality, and channel reporting.",
    videoSrc: WORKFLOW_VIDEO_SRC,
    icon: BarChart3,
  },
] as const

export function ProductWorkflowSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [playbackKey, setPlaybackKey] = useState(0)
  const [transitionKey, setTransitionKey] = useState(0)
  const [stepDurations, setStepDurations] = useState<Record<string, number>>({})
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const activateStep = useCallback((nextIndex: number | ((current: number) => number)) => {
    setActiveIndex((current) => {
      const resolvedIndex = typeof nextIndex === 'function' ? nextIndex(current) : nextIndex
      if (resolvedIndex !== current) {
        setTransitionKey((key) => key + 1)
      }

      return resolvedIndex
    })
    setPlaybackKey((current) => current + 1)
  }, [])

  const goToNextStep = useCallback(() => {
    activateStep((current) => (current + 1) % WORKFLOW_STEPS.length)
  }, [activateStep])

  const activeStep = WORKFLOW_STEPS[activeIndex] ?? WORKFLOW_STEPS[0]!
  const activeDurationMs = stepDurations[activeStep.id] ?? FALLBACK_STEP_DURATION_SECONDS * 1000

  function selectStep(index: number) {
    activateStep(index)
  }

  function handleLoadedMetadata() {
    const video = videoRef.current
    if (!video) return

    if (Number.isFinite(video.duration) && video.duration > 0) {
      const durationMs = Math.max(1000, Math.round(video.duration * 1000))
      setStepDurations((current) => (
        current[activeStep.id] === durationMs ? current : { ...current, [activeStep.id]: durationMs }
      ))
    }

    video.currentTime = 0
    void video.play().catch(() => {
      // Browsers can pause autoplay in edge cases; the posterless video still remains visible.
    })
  }

  function handleCanPlay() {
    const video = videoRef.current
    if (!video) return
    void video.play().catch(() => undefined)
  }

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

        <div className="grid gap-2 rounded-2xl border border-border bg-muted/20 p-1.5 md:grid-cols-5">
          {WORKFLOW_STEPS.map((step, index) => (
            <WorkflowTab
              key={step.id}
              step={step}
              active={index === activeIndex}
              durationMs={index === activeIndex ? activeDurationMs : 0}
              playbackKey={playbackKey}
              transitionKey={transitionKey}
              onClick={() => selectStep(index)}
            />
          ))}
        </div>

        <div className="mt-5 overflow-hidden border border-border bg-background">
          <div className="aspect-video bg-muted/20">
            <video
              key={`${activeStep.id}-${playbackKey}`}
              ref={videoRef}
              src={activeStep.videoSrc}
              className="workflow-video-reveal size-full object-cover"
              autoPlay
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={handleLoadedMetadata}
              onCanPlay={handleCanPlay}
              onEnded={goToNextStep}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes workflow-tab-progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        @keyframes workflow-video-reveal {
          from {
            opacity: 0;
            filter: blur(12px);
            transform: scale(1.018);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: scale(1);
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

        .workflow-video-reveal {
          animation: workflow-video-reveal 820ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .workflow-tab-active-reveal {
          animation: workflow-tab-active-reveal 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .workflow-video-reveal,
          .workflow-tab-active-reveal {
            animation: none !important;
          }

          .workflow-tab-progress {
            animation: none !important;
            width: 100% !important;
          }
        }
      `}</style>

    </section>
  )
}

function WorkflowTab({
  step,
  active,
  durationMs,
  playbackKey,
  transitionKey,
  onClick,
}: {
  step: WorkflowStep
  active: boolean
  durationMs: number
  playbackKey: number
  transitionKey: number
  onClick: () => void
}) {
  const Icon = step.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative min-h-[64px] overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors",
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
        style={active ? { animation: `workflow-tab-progress ${durationMs}ms linear forwards` } : undefined}
      />
      <span
        key={active ? `${step.id}-active-${transitionKey}` : `${step.id}-inactive-${transitionKey}`}
        className={cn("relative flex h-full items-center gap-3", active && "workflow-tab-active-reveal")}
      >
        <span className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background/80",
          active ? "border-primary/25 text-primary" : "border-border/80 text-muted-foreground"
        )}>
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {step.eyebrow}
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium leading-tight">
            {step.title}
          </span>
        </span>
      </span>
    </button>
  )
}

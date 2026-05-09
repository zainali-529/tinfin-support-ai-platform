"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  FileTextIcon,
  Globe2Icon,
  Loader2Icon,
  MessageCircleIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const DEMO_SOURCE_OPTIONS = [
  {
    id: "url",
    icon: Globe2Icon,
    label: "URL",
    title: "Crawl a page",
    helper: "Paste a public help article or product page.",
    placeholder: "https://help.example.com/refunds",
  },
  {
    id: "document",
    icon: UploadCloudIcon,
    label: "Doc",
    title: "Upload a document",
    helper: "Preview how a PDF, policy, or guide becomes chunks.",
    placeholder: "refund-policy.pdf",
  },
  {
    id: "note",
    icon: FileTextIcon,
    label: "Note",
    title: "Add a text note",
    helper: "Write a verified answer or company instruction.",
    placeholder: "Paste a verified support note...",
  },
] as const

const TRUST_POINTS = [
  "Verified source chunks",
  "Source health signals",
  "No-answer fallback",
  "Widget answer preview",
] as const

const DEMO_RUN_LIMIT = 3
const DEMO_RUNS_STORAGE_KEY = "tinfiz-marketing-kb-demo-runs"
const DEFAULT_DEMO_URL = "https://help.example.com/refunds"
const DEFAULT_DEMO_NOTE =
  "Tinfiz helps support teams answer customers from approved knowledge. If the answer is not verified, the assistant should explain the gap and offer human handoff."

type DemoSourceKind = (typeof DEMO_SOURCE_OPTIONS)[number]["id"]
type DemoPhase = "idle" | "reading" | "chunking" | "ready"

type DemoChunk = {
  id: string
  title: string
  body: string
  tokens: number
  confidence: number
  source: string
}

type DemoMessage = {
  id: string
  role: "user" | "assistant"
  body: string
}

export function GroundedKnowledgeSection() {
  return (
    <section id="grounded-ai" className="relative overflow-hidden bg-background py-20 md:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute -left-24 top-24 -z-10 h-[34rem] w-[34rem] rounded-full bg-primary/8 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-10 right-0 -z-10 h-[28rem] w-[28rem] rounded-full bg-muted-foreground/5 blur-3xl"
      />

      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.72fr)] lg:items-end">
          <div>
            <div className="inline-flex border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Grounded AI and Knowledge Base
            </div>
            <h2 className="mt-5 max-w-4xl text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Test knowledge, then see the answer experience instantly.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base lg:justify-self-end">
            Add a URL, document, or note, watch it become retrievable chunks, then preview how a customer would receive a grounded answer.
          </p>
        </div>

        <KnowledgeLabDemo />
      </div>

      <style>{`
        @keyframes kb-demo-scan {
          0% {
            transform: translateX(-120%);
            opacity: 0;
          }
          16%, 82% {
            opacity: 1;
          }
          100% {
            transform: translateX(120%);
            opacity: 0;
          }
        }

        @keyframes kb-demo-chunk-reveal {
          from {
            opacity: 0;
            transform: translateY(10px);
            filter: blur(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes kb-demo-message-reveal {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes kb-demo-pulse {
          0%, 100% {
            opacity: 0.48;
          }
          50% {
            opacity: 1;
          }
        }

        .kb-demo-scan::after {
          content: "";
          position: absolute;
          inset-block: 0;
          width: 44%;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in oklch, var(--primary) 18%, transparent),
            transparent
          );
          animation: kb-demo-scan 1.45s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }

        .kb-demo-chunk {
          animation: kb-demo-chunk-reveal 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .kb-demo-message {
          animation: kb-demo-message-reveal 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .kb-demo-pulse {
          animation: kb-demo-pulse 1.15s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .kb-demo-scan::after,
          .kb-demo-chunk,
          .kb-demo-message,
          .kb-demo-pulse {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  )
}

function KnowledgeLabDemo() {
  const [sourceKind, setSourceKind] = useState<DemoSourceKind>("url")
  const [urlValue, setUrlValue] = useState(DEFAULT_DEMO_URL)
  const [noteValue, setNoteValue] = useState(DEFAULT_DEMO_NOTE)
  const [fileName, setFileName] = useState("")
  const [phase, setPhase] = useState<DemoPhase>("idle")
  const [runs, setRuns] = useState(0)
  const [chunks, setChunks] = useState<DemoChunk[]>([])
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [draft, setDraft] = useState("")
  const [isAnswering, setIsAnswering] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const selectedSource = useMemo(
    () => DEMO_SOURCE_OPTIONS.find((source) => source.id === sourceKind) ?? DEMO_SOURCE_OPTIONS[0],
    [sourceKind],
  )

  const sourceValue = useMemo(() => {
    if (sourceKind === "url") return urlValue.trim() || DEFAULT_DEMO_URL
    if (sourceKind === "document") return fileName || "refund-policy.pdf"
    return noteValue.trim() || DEFAULT_DEMO_NOTE
  }, [fileName, noteValue, sourceKind, urlValue])

  const isRunning = phase === "reading" || phase === "chunking"
  const hasChunks = chunks.length > 0
  const remainingRuns = Math.max(DEMO_RUN_LIMIT - runs, 0)
  const progressValue = phase === "reading" ? 42 : phase === "chunking" ? 76 : phase === "ready" ? 100 : 0

  useEffect(() => {
    if (typeof window === "undefined") return

    const timer = window.setTimeout(() => {
      const storedRuns = Number.parseInt(window.sessionStorage.getItem(DEMO_RUNS_STORAGE_KEY) ?? "0", 10)
      if (Number.isFinite(storedRuns)) {
        setRuns(Math.min(Math.max(storedRuns, 0), DEMO_RUN_LIMIT))
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    return () => clearTimers()
  }, [])

  function clearTimers() {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current = []
  }

  function handleGenerate() {
    if (isRunning || remainingRuns <= 0) return

    clearTimers()
    setPhase("reading")
    setChunks([])
    setMessages([])
    setIsAnswering(false)

    const nextRuns = Math.min(runs + 1, DEMO_RUN_LIMIT)
    setRuns(nextRuns)
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DEMO_RUNS_STORAGE_KEY, String(nextRuns))
    }

    timersRef.current = [
      setTimeout(() => setPhase("chunking"), 620),
      setTimeout(() => {
        setChunks(buildDemoChunks(sourceKind, sourceValue))
        setPhase("ready")
      }, 1480),
    ]
  }

  function handleAsk(question = draft) {
    const cleanQuestion = question.trim()
    if (!cleanQuestion || !hasChunks || isAnswering) return

    setDraft("")
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", body: cleanQuestion },
    ])
    setIsAnswering(true)

    const answerTimer = setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          body: buildPreviewAnswer(cleanQuestion, chunks),
        },
      ])
      setIsAnswering(false)
    }, 520)

    timersRef.current.push(answerTimer)
  }

  return (
    <div className="mt-10 overflow-hidden border border-border bg-background">
      <div className="grid border-b border-border bg-muted/15 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Interactive knowledge test</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                A safe marketing demo. It simulates ingestion locally without calling your production crawler or AI credits.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="border border-border bg-background px-2.5 py-1">{remainingRuns} runs left</span>
              <span className="border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-600">No credits used</span>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="flex size-8 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
              <MessageCircleIcon className="size-4" />
            </span>
            Widget answer preview
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Once chunks are ready, test how a customer-facing answer can stay grounded.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-h-[620px] border-b border-border bg-background lg:border-b-0 lg:border-r">
          <div className="p-5">
            <div className="inline-grid grid-cols-3 border border-border bg-muted/20 p-1">
              {DEMO_SOURCE_OPTIONS.map((source) => {
                const Icon = source.icon
                const isSelected = source.id === sourceKind

                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => setSourceKind(source.id)}
                    className={cn(
                      "inline-flex h-9 items-center justify-center gap-2 px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                      isSelected && "bg-background text-foreground shadow-[inset_0_0_0_1px_var(--border)]",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {source.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(260px,0.58fr)]">
              <SourceInput
                fileName={fileName}
                noteValue={noteValue}
                selectedSource={selectedSource}
                setFileName={setFileName}
                setNoteValue={setNoteValue}
                setUrlValue={setUrlValue}
                sourceKind={sourceKind}
                urlValue={urlValue}
              />

              <div className="border border-border bg-muted/15 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center border border-border bg-background text-primary">
                    <DatabaseIcon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Index pipeline</p>
                    <p className="mt-1 text-xs text-muted-foreground">Visible only after testing.</p>
                  </div>
                </div>

                {phase === "idle" ? (
                  <div className="mt-5 border border-dashed border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
                    Add a source and run the test. The chunk preview will appear here only after ingestion starts.
                  </div>
                ) : (
                  <div className="mt-5">
                    <PipelineList phase={phase} sourceValue={sourceValue} />
                    <div className="mt-5 h-1 overflow-hidden bg-muted">
                      <div
                        className="h-full bg-primary transition-[width] duration-700 ease-out"
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isRunning || remainingRuns <= 0}
              className="mt-5 inline-flex h-11 items-center gap-2 border border-primary/35 bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
            >
              {isRunning ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
              {remainingRuns <= 0 ? "Demo limit reached" : isRunning ? "Building source index" : "Test this source"}
            </button>

            {isRunning || hasChunks ? (
              <div className="mt-6 border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Generated chunks</p>
                    <p className="mt-1 text-xs text-muted-foreground">Small retrieval units the assistant can use later.</p>
                  </div>
                  {hasChunks ? (
                    <span className="border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                      {chunks.length} chunks ready
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-3 xl:grid-cols-3">
                  {isRunning ? <ChunkSkeleton phase={phase} /> : null}
                  {!isRunning && hasChunks
                    ? chunks.map((chunk, index) => <ChunkPreview key={chunk.id} chunk={chunk} index={index} />)
                    : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <KnowledgeWidgetPreview
          chunks={chunks}
          draft={draft}
          isAnswering={isAnswering}
          isRunning={isRunning}
          messages={messages}
          onAsk={handleAsk}
          setDraft={setDraft}
        />
      </div>

      <div className="grid border-t border-border bg-muted/10 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_POINTS.map((point, index) => (
          <div key={point} className="flex items-center gap-2 border-b border-border px-5 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
            <span className="flex size-6 items-center justify-center border border-primary/20 bg-primary/8 text-primary">
              {index === 2 ? <AlertTriangleIcon className="size-3" /> : index === 3 ? <BotIcon className="size-3" /> : <CheckCircle2Icon className="size-3" />}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{point}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SourceInput({
  fileName,
  noteValue,
  selectedSource,
  setFileName,
  setNoteValue,
  setUrlValue,
  sourceKind,
  urlValue,
}: {
  fileName: string
  noteValue: string
  selectedSource: (typeof DEMO_SOURCE_OPTIONS)[number]
  setFileName: (fileName: string) => void
  setNoteValue: (value: string) => void
  setUrlValue: (value: string) => void
  sourceKind: DemoSourceKind
  urlValue: string
}) {
  const SelectedIcon = selectedSource.icon

  return (
    <div className="border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
          <SelectedIcon className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">{selectedSource.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedSource.helper}</p>
        </div>
      </div>

      <div className="mt-5">
        {sourceKind === "url" ? (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Source URL</span>
            <input
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
              className="mt-2 h-12 w-full border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary/45"
              placeholder={selectedSource.placeholder}
            />
          </label>
        ) : null}

        {sourceKind === "document" ? (
          <div>
            <span className="text-xs font-medium text-muted-foreground">Document source</span>
            <label className="mt-2 flex min-h-32 cursor-pointer flex-col items-center justify-center border border-dashed border-border bg-muted/15 px-4 py-5 text-center transition-colors hover:border-primary/35 hover:bg-primary/5">
              <UploadCloudIcon className="size-5 text-primary" />
              <span className="mt-2 text-sm font-medium text-foreground">{fileName || "Choose a document"}</span>
              <span className="mt-1 text-xs text-muted-foreground">PDF, DOCX, TXT, or Markdown preview</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                className="sr-only"
                onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
              />
            </label>
          </div>
        ) : null}

        {sourceKind === "note" ? (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Verified note</span>
            <textarea
              value={noteValue}
              onChange={(event) => setNoteValue(event.target.value)}
              className="mt-2 min-h-32 w-full resize-none border border-border bg-background px-3 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary/45"
              placeholder={selectedSource.placeholder}
            />
          </label>
        ) : null}
      </div>
    </div>
  )
}

function PipelineList({ phase, sourceValue }: { phase: DemoPhase; sourceValue: string }) {
  return (
    <div className="space-y-3">
      <PipelineStep active={phase === "reading"} complete={phase === "chunking" || phase === "ready"} label="Read source" detail={sourceValue} />
      <PipelineStep active={phase === "chunking"} complete={phase === "ready"} label="Create chunks" detail="Clean content, preserve meaning, prepare retrieval units." />
      <PipelineStep active={phase === "ready"} complete={phase === "ready"} label="Answer-ready" detail="The widget preview can now respond from these chunks." />
    </div>
  )
}

function PipelineStep({
  active,
  complete,
  label,
  detail,
}: {
  active: boolean
  complete: boolean
  label: string
  detail: string
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <span
        className={cn(
          "mt-1 flex size-5 items-center justify-center border border-border bg-background text-[10px] text-muted-foreground",
          active && "border-primary/35 bg-primary/10 text-primary kb-demo-pulse",
          complete && "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
        )}
      >
        {complete ? <CheckCircle2Icon className="size-3" /> : ""}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

function KnowledgeWidgetPreview({
  chunks,
  draft,
  isAnswering,
  isRunning,
  messages,
  onAsk,
  setDraft,
}: {
  chunks: DemoChunk[]
  draft: string
  isAnswering: boolean
  isRunning: boolean
  messages: DemoMessage[]
  onAsk: (question?: string) => void
  setDraft: (draft: string) => void
}) {
  const hasChunks = chunks.length > 0
  const quickQuestions = ["What does this source say?", "What happens if the answer is missing?"]

  return (
    <div className="flex min-h-[620px] flex-col bg-card">
      <div className="border-b border-border p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
            <BotIcon className="size-4.5" />
          </span>
          <div>
            <h3 className="text-base font-medium tracking-tight text-foreground">Customer chat preview</h3>
            <p className="mt-1 text-xs text-muted-foreground">Minimal widget flow powered by the generated chunks.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="min-h-[360px] space-y-3 overflow-hidden">
          {!hasChunks && !isRunning ? (
            <div className="flex h-[360px] flex-col items-center justify-center border border-dashed border-border bg-background/55 p-6 text-center">
              <ShieldCheckIcon className="size-7 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">Add a source first</p>
              <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
                The chat preview stays quiet until knowledge has been tested, so the demo does not feel pre-filled or fake.
              </p>
            </div>
          ) : null}

          {isRunning ? (
            <div className="relative overflow-hidden border border-border bg-background p-4 kb-demo-scan">
              <p className="text-sm font-medium text-foreground">Waiting for verified chunks</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">The preview unlocks after the source is indexed.</p>
            </div>
          ) : null}

          {hasChunks && messages.length === 0 ? (
            <div className="kb-demo-message border border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground">Source is ready.</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Ask a customer-style question and the preview will answer using the chunks generated on the left.
              </p>
              <div className="mt-4 space-y-2">
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => onAsk(question)}
                    className="block w-full border border-border bg-muted/20 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "kb-demo-message max-w-[88%] border px-3 py-2 text-sm leading-6",
                message.role === "user"
                  ? "ml-auto border-primary/20 bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground",
              )}
            >
              {message.body}
            </div>
          ))}

          {isAnswering ? (
            <div className="kb-demo-message inline-flex border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              Writing from verified chunks...
            </div>
          ) : null}
        </div>

        <form
          className="flex items-center gap-2 border border-border bg-background p-2"
          onSubmit={(event) => {
            event.preventDefault()
            onAsk()
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!hasChunks || isRunning}
            className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
            placeholder={hasChunks ? "Ask from this source..." : "Preview unlocks after source test"}
          />
          <button
            type="submit"
            disabled={!hasChunks || isRunning || isAnswering || draft.trim().length === 0}
            className="flex size-10 items-center justify-center border border-primary/25 bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
            aria-label="Send preview question"
          >
            <SendIcon className="size-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

function ChunkSkeleton({ phase }: { phase: DemoPhase }) {
  const label = phase === "reading" ? "Reading source content" : "Creating retrieval chunks"

  return (
    <div className="relative overflow-hidden border border-border bg-muted/18 p-4 kb-demo-scan xl:col-span-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-3/4 bg-muted-foreground/14" />
        <div className="h-2 w-full bg-muted-foreground/12" />
        <div className="h-2 w-2/3 bg-muted-foreground/10" />
      </div>
    </div>
  )
}

function ChunkPreview({ chunk, index }: { chunk: DemoChunk; index: number }) {
  return (
    <div className="kb-demo-chunk border border-border bg-background p-4" style={{ animationDelay: `${index * 95}ms` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{chunk.title}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{chunk.source}</p>
        </div>
        <div className="text-[11px] text-muted-foreground">
          <span className="text-primary">{chunk.confidence}%</span> match
        </div>
      </div>
      <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">{chunk.body}</p>
      <p className="mt-3 text-[11px] text-muted-foreground">{chunk.tokens} tokens</p>
    </div>
  )
}

function buildDemoChunks(kind: DemoSourceKind, value: string): DemoChunk[] {
  if (kind === "url") {
    return buildUrlDemoChunks(value)
  }

  if (kind === "document") {
    const source = value || "support-policy.pdf"

    return [
      {
        id: "doc-outline",
        title: "Document outline",
        source,
        tokens: 210,
        confidence: 95,
        body: "The document is split by headings, lists, and policy sections so long-form guidance stays readable for retrieval.",
      },
      {
        id: "doc-sop",
        title: "Agent SOP",
        source,
        tokens: 168,
        confidence: 93,
        body: "Operational steps are separated from customer-facing language, helping AI draft concise answers while agents keep internal context.",
      },
      {
        id: "doc-review",
        title: "Review signal",
        source,
        tokens: 88,
        confidence: 89,
        body: "Large files can surface stale or duplicate sections for review before they affect the support assistant.",
      },
    ]
  }

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
  const firstLine = sentences.slice(0, 2).join(" ") || DEFAULT_DEMO_NOTE

  return [
    {
      id: "note-approved",
      title: "Approved note",
      source: "Text note",
      tokens: 126,
      confidence: 97,
      body: firstLine,
    },
    {
      id: "note-intent",
      title: "Intent coverage",
      source: "Text note",
      tokens: 104,
      confidence: 93,
      body: "The note is linked to company, product, and support-scope questions so identity answers stay grounded in approved knowledge.",
    },
    {
      id: "note-safety",
      title: "Answer boundary",
      source: "Text note",
      tokens: 74,
      confidence: 90,
      body: "The assistant can use this source directly, but unsupported follow-up questions still route to safe fallback or human handoff.",
    },
  ]
}

function buildUrlDemoChunks(value: string): DemoChunk[] {
  const source = getUrlSourceLabel(value)
  const topic = detectUrlTopic(value)

  if (topic === "supabase-auth-react") {
    return [
      {
        id: "supabase-auth-client",
        title: "Supabase Auth client setup",
        source,
        tokens: 176,
        confidence: 97,
        body: "The source explains using @supabase/supabase-js in a React app, creating a browser client with the project URL and anon key, and keeping the client available to auth UI.",
      },
      {
        id: "supabase-session-flow",
        title: "Sign-in and session flow",
        source,
        tokens: 158,
        confidence: 95,
        body: "It covers signing users in, reading the current session, subscribing to auth state changes, and rendering the app based on whether a user is logged in.",
      },
      {
        id: "supabase-security-boundary",
        title: "Security boundary",
        source,
        tokens: 118,
        confidence: 93,
        body: "The browser anon key can be used client-side when Row Level Security protects data. Service role keys and privileged actions should stay on the server.",
      },
    ]
  }

  if (topic === "stripe-payments") {
    return [
      {
        id: "stripe-checkout",
        title: "Stripe payment flow",
        source,
        tokens: 166,
        confidence: 96,
        body: "The source describes creating a checkout or payment session, redirecting the customer securely, and using Stripe-hosted payment collection for card details.",
      },
      {
        id: "stripe-webhooks",
        title: "Webhook confirmation",
        source,
        tokens: 132,
        confidence: 94,
        body: "Payment status should be confirmed through webhook events rather than only trusting the browser redirect after checkout.",
      },
      {
        id: "stripe-secrets",
        title: "Secret key handling",
        source,
        tokens: 96,
        confidence: 91,
        body: "Secret keys belong on the server. Public keys can initialize client-side payment elements, but privileged operations require backend execution.",
      },
    ]
  }

  if (topic === "shopify-orders") {
    return [
      {
        id: "shopify-order-status",
        title: "Order status lookup",
        source,
        tokens: 152,
        confidence: 95,
        body: "The source is related to customer orders, status updates, fulfillment state, and the details a support assistant can use to answer order questions.",
      },
      {
        id: "shopify-fulfillment",
        title: "Fulfillment context",
        source,
        tokens: 126,
        confidence: 93,
        body: "Shipping, tracking, and fulfillment fields should be returned clearly so the customer gets a concise update without internal operational noise.",
      },
      {
        id: "shopify-write-safety",
        title: "Write action safety",
        source,
        tokens: 88,
        confidence: 90,
        body: "Order edits, cancellations, and refunds should require confirmation or human approval before a write action is executed.",
      },
    ]
  }

  const genericTopic = inferReadableTopic(value)

  return [
    {
      id: "url-topic-summary",
      title: `${genericTopic} overview`,
      source,
      tokens: 148,
      confidence: 91,
      body: `The URL appears to describe ${genericTopic.toLowerCase()}. The demo keeps the page title, main headings, and customer-facing explanation as retrievable answer context.`,
    },
    {
      id: "url-topic-details",
      title: "Relevant details",
      source,
      tokens: 124,
      confidence: 88,
      body: `Key sections from the page are grouped so the assistant can answer questions about ${genericTopic.toLowerCase()} without pulling unrelated navigation or footer content.`,
    },
    {
      id: "url-topic-boundary",
      title: "Answer boundary",
      source,
      tokens: 84,
      confidence: 86,
      body: "If the customer asks for something not present in this source, the assistant should say it does not have verified information and offer human help.",
    },
  ]
}

function buildPreviewAnswer(question: string, chunks: DemoChunk[]) {
  const normalizedQuestion = question.toLowerCase()
  const primaryChunk = chunks[0]
  const supportChunk = chunks[1] ?? primaryChunk
  const fallbackChunk = chunks.find((chunk) => chunk.id.includes("fallback") || chunk.id.includes("safety"))

  if (!primaryChunk || !supportChunk) {
    return "I need a verified source before I can answer from company knowledge. Add a source first, then ask again."
  }

  if (normalizedQuestion.includes("missing") || normalizedQuestion.includes("not know") || normalizedQuestion.includes("unsure")) {
    return fallbackChunk
      ? `If the source does not verify the answer, I would say that I do not have confirmed information yet and offer to connect the customer with a human agent. Source basis: ${fallbackChunk.title}.`
      : "If the answer is not verified in the source, I would avoid guessing and offer a human handoff."
  }

  if (
    normalizedQuestion.includes("summary") ||
    normalizedQuestion.includes("say") ||
    normalizedQuestion.includes("about") ||
    normalizedQuestion.includes("source")
  ) {
    return `Based on the verified source: ${primaryChunk.body} ${supportChunk.body}`
  }

  if (normalizedQuestion.includes("setup") || normalizedQuestion.includes("install") || normalizedQuestion.includes("how")) {
    return `Here is the grounded answer from the indexed chunks: ${primaryChunk.body} ${supportChunk.body}`
  }

  return `I found relevant verified context: ${primaryChunk.body} I would keep the answer tied to this source and avoid unsupported claims.`
}

function getHostLabel(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return value.replace(/^https?:\/\//, "").split("/")[0] || "help source"
  }
}

function getUrlSourceLabel(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, "")
    const path = url.pathname
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join("/")

    return path ? `${host}/${path}` : host
  } catch {
    return getHostLabel(value)
  }
}

function detectUrlTopic(value: string) {
  const normalized = value.toLowerCase()

  if (normalized.includes("supabase") && normalized.includes("auth") && normalized.includes("react")) {
    return "supabase-auth-react"
  }

  if (normalized.includes("stripe") || normalized.includes("checkout") || normalized.includes("payment")) {
    return "stripe-payments"
  }

  if (normalized.includes("shopify") || normalized.includes("order") || normalized.includes("fulfillment")) {
    return "shopify-orders"
  }

  return "generic"
}

function inferReadableTopic(value: string) {
  try {
    const url = new URL(value)
    const segments = url.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .filter((segment) => !["docs", "documentation", "help", "guide", "guides", "learn"].includes(segment.toLowerCase()))

    const bestSegment = segments.at(-1) ?? segments.at(0)
    if (bestSegment) return humanizeUrlSegment(bestSegment)

    return humanizeUrlSegment(url.hostname.replace(/^www\./, "").split(".")[0] ?? "help article")
  } catch {
    const cleaned = value.replace(/^https?:\/\//, "").split(/[/?#]/)[0]
    return humanizeUrlSegment(cleaned || "help article")
  }
}

function humanizeUrlSegment(segment: string) {
  return segment
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim() || "Help Article"
}

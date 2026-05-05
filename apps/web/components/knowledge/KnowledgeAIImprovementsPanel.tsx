'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BotIcon,
  CheckCircle2Icon,
  FileTextIcon,
  LightbulbIcon,
  MessageSquareWarningIcon,
  RefreshCwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserRoundIcon,
} from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { toast } from '@workspace/ui/components/sonner'
import { cn } from '@workspace/ui/lib/utils'
import { trpc } from '@/lib/trpc'
import { LaunchErrorState, LaunchState } from '@/components/launch/LaunchState'
import type { KnowledgeBase } from '@/hooks/useKnowledgeBases'

export interface AiImprovementDraft {
  title: string
  content: string
}

type ImprovementItem = {
  id: string
  conversationId: string
  question: string
  answer: string
  answerType: string | null
  confidence: number | null
  sourcesCount: number
  noVerifiedAnswer: boolean
  lowConfidence: boolean
  humanHandoff: boolean
  handoffReason: string | null
  rating: 'helpful' | 'not_helpful' | null
  createdAt: string
  suggestedTitle: string
  suggestedNote: string
  conversationHref: string
  conversation: {
    channel: string
    status: string
    contactName: string | null
    contactValue: string | null
  }
}

function confidenceLabel(confidence: number | null) {
  if (confidence === null) return 'No score'
  return `${Math.round(confidence * 100)}%`
}

function confidenceTone(confidence: number | null) {
  if (confidence === null) return 'border-muted-foreground/25 text-muted-foreground'
  if (confidence < 0.45) return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300'
  if (confidence < 0.75) return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
}

function channelLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'warn' | 'danger'
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        </div>
        <div className={cn(
          'flex size-8 items-center justify-center rounded-xl border',
          tone === 'danger' && 'border-rose-500/20 bg-rose-500/10 text-rose-600',
          tone === 'warn' && 'border-amber-500/20 bg-amber-500/10 text-amber-600',
          tone === 'default' && 'bg-muted text-muted-foreground'
        )}>
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function ImprovementSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index} className="shadow-none">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ImprovementRow({
  item,
  selectedKb,
  ratingPending,
  onRate,
  onDraft,
}: {
  item: ImprovementItem
  selectedKb: KnowledgeBase | null
  ratingPending: boolean
  onRate: (messageId: string, rating: 'helpful' | 'not_helpful') => void
  onDraft: (draft: AiImprovementDraft) => void
}) {
  const customerLabel = item.conversation.contactName ?? item.conversation.contactValue ?? 'Customer'
  const age = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })

  return (
    <Card className="shadow-none transition-colors hover:border-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {item.noVerifiedAnswer && (
                <Badge variant="outline" className="border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                  Unanswered
                </Badge>
              )}
              {item.lowConfidence && (
                <Badge variant="outline" className={confidenceTone(item.confidence)}>
                  {confidenceLabel(item.confidence)} confidence
                </Badge>
              )}
              {item.humanHandoff && (
                <Badge variant="outline" className="border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  Handoff
                </Badge>
              )}
              {item.rating === 'not_helpful' && (
                <Badge variant="outline" className="border-rose-500/25 text-rose-600">
                  Rated not helpful
                </Badge>
              )}
              {item.rating === 'helpful' && (
                <Badge variant="outline" className="border-emerald-500/25 text-emerald-600">
                  Rated helpful
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold leading-6">{item.question}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <UserRoundIcon className="size-3" />
                {customerLabel}
              </span>
              <span>{channelLabel(item.conversation.channel)}</span>
              <span>{age}</span>
              {item.handoffReason && <span>Reason: {item.handoffReason}</span>}
            </div>
          </div>
          <Button size="sm" variant="outline" asChild className="h-8 w-full gap-1.5 sm:w-auto">
            <Link href={item.conversationHref}>
              Open conversation
              <ArrowUpRightIcon className="size-3.5" />
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">AI answer</p>
          <p className="line-clamp-4 text-xs leading-5 text-muted-foreground">{item.answer}</p>
        </div>

        <div className="rounded-xl border border-dashed bg-background p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <LightbulbIcon className="size-3.5 text-amber-500" />
                Suggested KB note
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Draft a text note from this failed question, edit the official answer, then save it as a normal KB source.
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 w-full gap-1.5 sm:w-auto"
              disabled={!selectedKb}
              onClick={() => onDraft({ title: item.suggestedTitle, content: item.suggestedNote })}
            >
              <FileTextIcon className="size-3.5" />
              Draft KB note
            </Button>
          </div>
          {!selectedKb && (
            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">
              Select a knowledge base on the left before drafting a note.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Sources used: {item.sourcesCount}. Answer type: {item.answerType ?? 'unknown'}.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={item.rating === 'helpful' ? 'default' : 'outline'}
              disabled={ratingPending}
              onClick={() => onRate(item.id, 'helpful')}
              className="h-8 gap-1.5"
            >
              <ThumbsUpIcon className="size-3.5" />
              Helpful
            </Button>
            <Button
              size="sm"
              variant={item.rating === 'not_helpful' ? 'destructive' : 'outline'}
              disabled={ratingPending}
              onClick={() => onRate(item.id, 'not_helpful')}
              className="h-8 gap-1.5"
            >
              <ThumbsDownIcon className="size-3.5" />
              Not helpful
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function KnowledgeAIImprovementsPanel({
  selectedKb,
  onDraftNote,
  onBack,
}: {
  selectedKb: KnowledgeBase | null
  onDraftNote: (draft: AiImprovementDraft) => void
  onBack?: () => void
}) {
  const utils = trpc.useUtils()
  const improvementsQuery = trpc.knowledge.getAiImprovements.useQuery(
    { days: 30, limit: 50 },
    { staleTime: 30_000 }
  )
  const rateAnswer = trpc.knowledge.rateAiAnswer.useMutation({
    onSuccess: async (_result, variables) => {
      toast.success(variables.rating === 'helpful' ? 'Marked helpful' : 'Marked not helpful')
      await utils.knowledge.getAiImprovements.invalidate()
    },
  })

  const data = improvementsQuery.data
  const items = (data?.items ?? []) as ImprovementItem[]

  return (
    <div className="flex h-full min-h-0 flex-col">
      {onBack && (
        <div className="flex shrink-0 items-center border-b px-3 py-2 lg:hidden">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1.5 px-2 text-xs">
            <ArrowLeftIcon className="size-3.5" />
            Knowledge bases
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 border-b bg-card/50 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">AI Improvements</h2>
            <Badge variant="outline" className="h-5 text-[10px]">Last {data?.windowDays ?? 30} days</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Minimal quality center: unanswered questions, low-confidence replies, handoff reasons, and draft notes for improving KB coverage.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void improvementsQuery.refetch()}
          disabled={improvementsQuery.isFetching}
          className="h-8 w-full gap-1.5 sm:w-auto"
        >
          <RefreshCwIcon className={cn('size-3.5', improvementsQuery.isFetching && 'animate-spin')} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {improvementsQuery.isError && (
        <div className="p-4">
          <LaunchErrorState
            error={improvementsQuery.error}
            title="AI improvements could not be loaded"
            onRetry={() => void improvementsQuery.refetch()}
            docsHref="/docs/ai/response-quality"
          />
        </div>
      )}

      {improvementsQuery.isLoading ? (
        <ImprovementSkeleton />
      ) : items.length === 0 ? (
        <div className="p-4">
          <LaunchState
            title="No AI improvement signals yet"
            description="Once customers ask questions that AI cannot answer confidently, they will appear here with conversation links and KB note drafts."
            icon={<CheckCircle2Icon className="size-4" />}
            docsHref="/docs/ai/response-quality"
            className="border-dashed"
          />
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Unanswered" value={data?.summary.unansweredCount ?? 0} icon={MessageSquareWarningIcon} tone="danger" />
              <StatCard label="Low confidence" value={data?.summary.lowConfidenceCount ?? 0} icon={AlertTriangleIcon} tone="warn" />
              <StatCard label="Handoffs" value={data?.summary.handoffCount ?? 0} icon={UserRoundIcon} tone="warn" />
              <StatCard label="Not helpful" value={data?.summary.notHelpfulCount ?? 0} icon={ThumbsDownIcon} tone="danger" />
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <LightbulbIcon className="size-4 text-amber-500" />
                    Top missing topics
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pt-0">
                  {(data?.topMissingTopics ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No repeated missing topics yet.</p>
                  ) : (
                    data!.topMissingTopics.map((topic) => (
                      <Badge key={topic.topic} variant="outline" className="capitalize">
                        {topic.topic} ({topic.count})
                      </Badge>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BotIcon className="size-4 text-primary" />
                    Handoff reasons
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {(data?.handoffReasons ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No handoff reasons captured yet.</p>
                  ) : (
                    data!.handoffReasons.map((reason) => (
                      <div key={reason.reason} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs">
                        <span>{reason.reason}</span>
                        <Badge variant="outline">{reason.count}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <ImprovementRow
                  key={item.id}
                  item={item}
                  selectedKb={selectedKb}
                  ratingPending={rateAnswer.isPending}
                  onRate={(messageId, rating) => rateAnswer.mutate({ messageId, rating })}
                  onDraft={onDraftNote}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

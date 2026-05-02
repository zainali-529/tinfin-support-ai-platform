'use client'

import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { NativeSelect, NativeSelectOption } from '@workspace/ui/components/native-select'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Separator } from '@workspace/ui/components/separator'
import { Switch } from '@workspace/ui/components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { cn } from '@workspace/ui/lib/utils'
import {
  AlertTriangleIcon,
  DatabaseZapIcon,
  FileWarningIcon,
  LayersIcon,
  Loader2Icon,
  PinIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  WandSparklesIcon,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

type SourceHealth = 'healthy' | 'needs_review' | 'stale' | 'duplicate' | 'deprecated'

type QualitySource = {
  sourceKey: string
  kbName: string
  sourceUrl: string | null
  sourceTitle: string | null
  sourceType: string
  isPinned: boolean
  qualityStatus: string
  qualityNotes: string | null
  chunkCount: number
  lastIndexedAt: string
  lastReviewedAt: string | null
  lastVerifiedAt: string | null
  ageDays: number
  health: SourceHealth
  healthReasons: string[]
  usageCount: number
  lastUsedAt: string | null
}

type MissingTopic = {
  topicKey: string
  intent: string
  exampleQuery: string
  count: number
  avgConfidence: number
  lastSeenAt: string
  responseTypes: string[]
}

type Trace = {
  id: string
  query: string
  detected_intent: string
  response_type: string
  response_preview: string | null
  confidence: number | null
  created_at: string
}

const SOURCE_TYPES = [
  'general',
  'company_profile',
  'text_note',
  'url',
  'file',
  'policy',
  'product_doc',
  'troubleshooting',
  'pricing',
  'faq',
] as const

const HEALTH_LABELS: Record<SourceHealth, { label: string; className: string }> = {
  healthy: { label: 'Healthy', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700' },
  needs_review: { label: 'Needs review', className: 'border-amber-500/25 bg-amber-500/10 text-amber-700' },
  stale: { label: 'Stale', className: 'border-orange-500/25 bg-orange-500/10 text-orange-700' },
  duplicate: { label: 'Duplicate', className: 'border-blue-500/25 bg-blue-500/10 text-blue-700' },
  deprecated: { label: 'Deprecated', className: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-700' },
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string
  value: string | number
  hint: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-xl border bg-muted/25">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function HealthBadge({ health }: { health: SourceHealth }) {
  const config = HEALTH_LABELS[health] ?? HEALTH_LABELS.healthy
  return <Badge variant="outline" className={cn('border', config.className)}>{config.label}</Badge>
}

function titleForSource(source: QualitySource) {
  return source.sourceTitle || source.sourceUrl || 'Untitled source'
}

function formatDateAgo(value: string | null | undefined) {
  if (!value) return 'Never'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

export function KnowledgeQualityCenterPage() {
  const [staleDays, setStaleDays] = useState(60)
  const [search, setSearch] = useState('')
  const [healthFilter, setHealthFilter] = useState<'all' | SourceHealth>('all')
  const [notice, setNotice] = useState<string | null>(null)

  const query = trpc.knowledgeQuality.getQualityCenter.useQuery(
    { staleDays },
    { staleTime: 20_000 }
  )
  const updateSource = trpc.knowledgeQuality.updateSource.useMutation({
    onSuccess: async (result) => {
      setNotice(`Source updated (${result.updatedChunks} chunks).`)
      await query.refetch()
    },
  })
  const deleteSource = trpc.knowledgeQuality.deleteSource.useMutation({
    onSuccess: async (result) => {
      setNotice(`Source deleted (${result.deletedChunks} chunks).`)
      await query.refetch()
    },
  })
  const createGuidance = trpc.knowledgeQuality.createGuidanceFromTrace.useMutation({
    onSuccess: () => setNotice('Guidance created from trace.'),
  })
  const addEval = trpc.knowledgeQuality.addTraceToEvalSuite.useMutation({
    onSuccess: () => setNotice('Trace added to eval suite.'),
  })

  const data = query.data
  const sources = useMemo(() => (data?.sources ?? []) as QualitySource[], [data?.sources])
  const missingTopics = useMemo(() => (data?.missingTopics ?? []) as MissingTopic[], [data?.missingTopics])
  const topUsedSources = useMemo(() => (data?.topUsedSources ?? []) as QualitySource[], [data?.topUsedSources])
  const traces = useMemo(() => (data?.recentLowConfidenceTraces ?? []) as Trace[], [data?.recentLowConfidenceTraces])

  const filteredSources = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sources.filter((source) => {
      const healthMatches = healthFilter === 'all' || source.health === healthFilter
      const searchMatches =
        !q ||
        titleForSource(source).toLowerCase().includes(q) ||
        source.kbName.toLowerCase().includes(q) ||
        source.sourceType.toLowerCase().includes(q)
      return healthMatches && searchMatches
    })
  }, [healthFilter, search, sources])

  const isBusy = updateSource.isPending || deleteSource.isPending || query.isFetching

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            <DatabaseZapIcon className="size-3.5" />
            Knowledge Quality Center
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Source Health & AI Coverage</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Find stale sources, duplicate content, missing answer topics, and which sources your AI actually uses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect value={String(staleDays)} onChange={(event) => setStaleDays(Number(event.target.value))}>
            <NativeSelectOption value="30">30 day stale window</NativeSelectOption>
            <NativeSelectOption value="60">60 day stale window</NativeSelectOption>
            <NativeSelectOption value="90">90 day stale window</NativeSelectOption>
            <NativeSelectOption value="180">180 day stale window</NativeSelectOption>
          </NativeSelect>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => query.refetch()}>
            {query.isFetching ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="flex items-center justify-between rounded-xl border bg-muted/25 px-4 py-3 text-sm">
          <span>{notice}</span>
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Sources" value={data?.summary.totalSources ?? 0} hint={`${data?.summary.totalChunks ?? 0} chunks indexed`} icon={LayersIcon} />
        <StatCard title="Needs attention" value={(data?.summary.needsReviewSources ?? 0) + (data?.summary.staleSources ?? 0) + (data?.summary.duplicateSources ?? 0)} hint="Review, stale, duplicate" icon={AlertTriangleIcon} />
        <StatCard title="Pinned" value={data?.summary.pinnedSources ?? 0} hint="Boosted in AI answers" icon={PinIcon} />
        <StatCard title="Missing topics" value={data?.summary.missingTopics ?? 0} hint={`${data?.summary.traceWindow ?? 0} traces scanned`} icon={FileWarningIcon} />
      </div>

      <Tabs defaultValue="health" className="gap-5">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="health">Source Health</TabsTrigger>
          <TabsTrigger value="missing">Missing Topics</TabsTrigger>
          <TabsTrigger value="usage">Source Usage</TabsTrigger>
          <TabsTrigger value="traces">Low Confidence</TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          <Card className="shadow-none">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Knowledge Sources</CardTitle>
                  <CardDescription>Update source type, pin important sources, verify freshness, or remove stale content.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-8 w-64 pl-8 text-sm" placeholder="Search sources..." value={search} onChange={(event) => setSearch(event.target.value)} />
                  </div>
                  <NativeSelect value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                    <NativeSelectOption value="all">All health</NativeSelectOption>
                    {Object.entries(HEALTH_LABELS).map(([key, config]) => (
                      <NativeSelectOption key={key} value={key}>{config.label}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Loading quality signals...
                </div>
              ) : filteredSources.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No sources match this filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSources.map((source) => (
                    <div key={source.sourceKey} className="rounded-xl border p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <HealthBadge health={source.health} />
                            <Badge variant="outline">{source.sourceType}</Badge>
                            {source.isPinned ? <Badge className="gap-1"><PinIcon className="size-3" />Pinned</Badge> : null}
                            <span className="text-xs text-muted-foreground">{source.kbName}</span>
                          </div>
                          <p className="mt-2 truncate text-sm font-medium">{titleForSource(source)}</p>
                          {source.sourceUrl ? <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{source.sourceUrl}</p> : null}
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{source.chunkCount} chunks</span>
                            <span>Indexed {formatDateAgo(source.lastIndexedAt)}</span>
                            <span>Reviewed {formatDateAgo(source.lastReviewedAt)}</span>
                            <span>Used {source.usageCount} times</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {source.healthReasons.map((reason) => (
                              <span key={reason} className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">{reason}</span>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 xl:w-[460px]">
                          <NativeSelect
                            value={source.sourceType}
                            disabled={isBusy}
                            onChange={(event) => updateSource.mutate({ sourceKey: source.sourceKey, sourceType: event.target.value as (typeof SOURCE_TYPES)[number] })}
                          >
                            {SOURCE_TYPES.map((type) => <NativeSelectOption key={type} value={type}>{type}</NativeSelectOption>)}
                          </NativeSelect>
                          <NativeSelect
                            value={source.qualityStatus}
                            disabled={isBusy}
                            onChange={(event) => updateSource.mutate({ sourceKey: source.sourceKey, qualityStatus: event.target.value as 'active' | 'needs_review' | 'verified' | 'deprecated' })}
                          >
                            <NativeSelectOption value="active">active</NativeSelectOption>
                            <NativeSelectOption value="needs_review">needs_review</NativeSelectOption>
                            <NativeSelectOption value="verified">verified</NativeSelectOption>
                            <NativeSelectOption value="deprecated">deprecated</NativeSelectOption>
                          </NativeSelect>
                          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                            <Switch
                              checked={source.isPinned}
                              disabled={isBusy}
                              onCheckedChange={(checked) => updateSource.mutate({
                                sourceKey: source.sourceKey,
                                isPinned: checked,
                                pinnedReason: checked ? 'quality_center' : null,
                              })}
                            />
                            <span className="text-sm">Pin source</span>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={isBusy} onClick={() => updateSource.mutate({ sourceKey: source.sourceKey, markVerified: true })}>
                              <ShieldCheckIcon className="size-3.5" />
                              Verify
                            </Button>
                            <Button variant="ghost" size="icon-sm" disabled={isBusy} onClick={() => deleteSource.mutate({ sourceKey: source.sourceKey })}>
                              <Trash2Icon className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="missing">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Missing Answer Topics</CardTitle>
              <CardDescription>Grouped from low-confidence traces and handoff-style answers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {missingTopics.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No missing topic pattern found in the current trace window.
                </div>
              ) : missingTopics.map((topic) => (
                <div key={topic.topicKey} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{topic.intent}</Badge>
                        <Badge variant="outline">{topic.count} hits</Badge>
                        <span className="text-xs text-muted-foreground">Last seen {formatDateAgo(topic.lastSeenAt)}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{topic.exampleQuery}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Avg confidence {Math.round(topic.avgConfidence * 100)}% · response types {topic.responseTypes.join(', ')}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Recommended: add source content, then add this query to eval suite.
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Top Used Sources</CardTitle>
                <CardDescription>Which sources are actually helping AI answers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topUsedSources.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No source usage yet. Ask the AI a few questions or run evals.
                  </div>
                ) : topUsedSources.map((source) => (
                  <div key={source.sourceKey} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{titleForSource(source)}</p>
                      <p className="text-xs text-muted-foreground">{source.kbName} · Last used {formatDateAgo(source.lastUsedAt)}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{source.usageCount} uses</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Health Mix</CardTitle>
                <CardDescription>Source status distribution.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(data?.healthCounts ?? {}).map(([health, count]) => (
                  <div key={health} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <HealthBadge health={health as SourceHealth} />
                    <span className="font-medium">{Number(count)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="traces">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Low Confidence Trace Actions</CardTitle>
              <CardDescription>Create guidance or regression tests directly from weak answers.</CardDescription>
            </CardHeader>
            <CardContent>
              {traces.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No low-confidence traces found.
                </div>
              ) : (
                <ScrollArea className="h-[560px] pr-3">
                  <div className="space-y-3">
                    {traces.map((trace) => (
                      <div key={trace.id} className="rounded-xl border p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge>{trace.detected_intent}</Badge>
                              <Badge variant="outline">{trace.response_type}</Badge>
                              <span className="text-xs text-muted-foreground">{Math.round((trace.confidence ?? 0) * 100)}% confidence</span>
                            </div>
                            <p className="mt-2 text-sm font-medium">{trace.query}</p>
                            {trace.response_preview ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{trace.response_preview}</p> : null}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={createGuidance.isPending}
                              onClick={() => createGuidance.mutate({
                                traceId: trace.id,
                                guidanceText: `For questions like "${trace.query}", answer with verified company knowledge. If the required facts are missing, ask one precise follow-up or route to a human instead of guessing.`,
                              })}
                            >
                              <WandSparklesIcon className="size-3.5" />
                              Guidance
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={addEval.isPending}
                              onClick={() => addEval.mutate({ traceId: trace.id })}
                            >
                              <SparklesIcon className="size-3.5" />
                              Add Eval
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Quality Center uses the last 500 AI traces and up to 5,000 indexed chunks. For production scale, move these aggregates into scheduled rollups.
      </p>
    </div>
  )
}

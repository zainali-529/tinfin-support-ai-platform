'use client'

import { useMemo, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAnalytics, type AnalyticsPeriod } from '@/hooks/useAnalytics'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Progress } from '@workspace/ui/components/progress'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'
import { LaunchErrorState } from '@/components/launch/LaunchState'
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  HeadphonesIcon,
  Loader2Icon,
  MessageSquareIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  StarIcon,
  UsersIcon,
  WorkflowIcon,
} from 'lucide-react'

const PERIOD_OPTIONS: Array<{ label: string; value: AnalyticsPeriod }> = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
]

const SLA_COLORS: Record<string, string> = {
  on_track: '#10b981',
  at_risk: '#f59e0b',
  breached: '#ef4444',
  met: '#14b8a6',
  unknown: '#94a3b8',
}

const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }
const GRID_STROKE = 'hsl(var(--border))'
const TOOLTIP_PROPS = {
  cursor: { fill: 'hsl(var(--muted) / 0.35)' },
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 14,
    boxShadow: 'none',
    color: 'hsl(var(--popover-foreground))',
    fontSize: 12,
  },
  labelStyle: { fontWeight: 700, marginBottom: 6 },
}

function formatShortDate(date: string) {
  try {
    return format(parseISO(date), 'MMM d')
  } catch {
    return date
  }
}

function formatCompact(value: number | null | undefined) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: value && Math.abs(value) >= 10000 ? 'compact' : 'standard',
  }).format(value ?? 0)
}

function formatPercent(value: number | null | undefined) {
  const next = Number(value ?? 0)
  return `${next.toFixed(Number.isInteger(next) ? 0 : 1)}%`
}

function formatRating(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? `${value.toFixed(1)}/5` : 'n/a'
}

function formatLatency(ms: number | null | undefined) {
  if (!ms) return 'n/a'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function safeRatio(part: number, total: number) {
  return total <= 0 ? 0 : Math.round((part / total) * 100)
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: AnalyticsPeriod
  onChange: (value: AnalyticsPeriod) => void
}) {
  return (
    <div className="inline-flex rounded-xl border bg-muted/30 p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            value === option.value
              ? 'bg-background text-foreground ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function EmptyChart({ message = 'No analytics data for this period yet.' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-52 items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function ChartSkeleton({ height = 'h-80' }: { height?: string }) {
  return <Skeleton className={cn('rounded-2xl', height)} />
}

function GraphPanel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn('overflow-hidden rounded-2xl border bg-card shadow-none', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b bg-muted/15 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border bg-background">
              <Icon className="size-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
            {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn('p-4', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

function InsightPill({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'neutral' | 'good' | 'warn' | 'danger'
}) {
  const toneClass = {
    neutral: 'border-border bg-background text-foreground',
    good: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200',
    warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
    danger: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200',
  }[tone]

  return (
    <div className={cn('rounded-2xl border px-4 py-3', toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">{label}</p>
        <Icon className="size-4 opacity-75" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs opacity-75">{detail}</p>
    </div>
  )
}

function CheckStatusIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle2Icon className="size-4 text-emerald-500" />
  if (status === 'fail') return <AlertTriangleIcon className="size-4 text-rose-500" />
  if (status === 'warn') return <AlertTriangleIcon className="size-4 text-amber-500" />
  return <ShieldCheckIcon className="size-4 text-sky-500" />
}

export function AnalyticsDashboard() {
  const {
    period,
    setPeriod,
    report,
    isLoading,
    isFetching,
    isError,
    error,
    refetchAll,
  } = useAnalytics()

  const timeline = useMemo(
    () => (report?.timeline ?? []).map((row) => {
      const messageTotal = row.aiMessages + row.agentMessages
      return {
        ...row,
        label: formatShortDate(row.date),
        resolutionRate: safeRatio(row.resolved, row.conversations),
        automationRate: safeRatio(row.aiMessages, messageTotal),
      }
    }),
    [report?.timeline]
  )

  const slaDonutData = useMemo(() => [
    { name: 'On track', value: report?.sla.overview.onTrack ?? 0, color: SLA_COLORS.on_track },
    { name: 'At risk', value: report?.sla.overview.atRisk ?? 0, color: SLA_COLORS.at_risk },
    { name: 'Breached', value: report?.sla.overview.breached ?? 0, color: SLA_COLORS.breached },
    { name: 'Met', value: report?.sla.overview.met ?? 0, color: SLA_COLORS.met },
  ], [report?.sla.overview.atRisk, report?.sla.overview.breached, report?.sla.overview.met, report?.sla.overview.onTrack])

  const channelResponseData = useMemo(
    () => (report?.sla.byChannel ?? []).slice(0, 6).map((channel) => ({
      channel: labelize(channel.channel),
      total: channel.total,
      breachRate: channel.breachRate,
      firstResponseMinutes: Math.round((channel.avgFirstResponseSeconds ?? 0) / 60),
      resolutionHours: Number(((channel.avgResolutionSeconds ?? 0) / 3600).toFixed(1)),
    })),
    [report?.sla.byChannel]
  )

  const csatByChannelData = useMemo(
    () => (report?.csat.byChannel ?? []).slice(0, 6).map((item) => ({
      channel: labelize(item.channel),
      count: item.count,
      avgRating: item.avgRating,
      positiveRate: item.positiveRate,
      negativeRate: item.negativeRate,
    })),
    [report?.csat.byChannel]
  )

  const csatTrendData = useMemo(
    () => timeline.map((row) => ({
      ...row,
      avgCsatRatingForChart: row.csatResponses > 0 ? row.avgCsatRating : null,
    })),
    [timeline]
  )

  const summary = report?.executiveSummary
  const csat = report?.csat
  const launch = report?.launch
  const hasTimeline = timeline.some((row) => row.conversations > 0 || row.messages > 0 || row.actions > 0 || row.csatResponses > 0)
    || (summary?.conversations.value ?? 0) > 0
  const tickInterval = 'preserveStartEnd' as const

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 pb-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <section className="rounded-2xl border bg-card p-4 shadow-none md:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-lg">Analytics Studio</Badge>
              <Badge variant="outline" className="rounded-lg">CSAT ready</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Performance and satisfaction</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A focused reporting view for demand, SLA pressure, customer satisfaction, AI/action reliability, and launch signals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PeriodSelector value={period} onChange={setPeriod} />
            <Button type="button" variant="outline" className="h-9" onClick={refetchAll}>
              {isFetching ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <RefreshCwIcon className="mr-2 size-4" />}
              Refresh
            </Button>
            {report?.generatedAt && (
              <span className="text-xs text-muted-foreground">
                Updated {format(parseISO(report.generatedAt), 'MMM d, h:mm a')}
              </span>
            )}
          </div>
        </div>
      </section>

      {isError && (
        <LaunchErrorState
          error={error}
          title="Analytics could not be loaded"
          onRetry={refetchAll}
          docsHref="/docs/admin/analytics-reporting"
        />
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InsightPill
          label="Conversation demand"
          value={formatCompact(summary?.conversations.value)}
          detail={`${formatPercent(summary?.resolutionRate.value)} resolved in window`}
          icon={MessageSquareIcon}
        />
        <InsightPill
          label="Customer satisfaction"
          value={formatRating(summary?.csat.avgRating)}
          detail={`${summary?.csat.responses ?? 0} responses - ${formatPercent(summary?.csat.positiveRate)} positive`}
          icon={StarIcon}
          tone={(summary?.csat.avgRating ?? 0) >= 4 ? 'good' : (summary?.csat.responses ?? 0) > 0 ? 'warn' : 'neutral'}
        />
        <InsightPill
          label="SLA pressure"
          value={formatPercent(summary?.slaBreachRate)}
          detail={`${report?.sla.overview.activeBreaches ?? 0} active breaches`}
          icon={Clock3Icon}
          tone={(summary?.slaBreachRate ?? 0) > 0 ? 'danger' : 'good'}
        />
        <InsightPill
          label="Action quality"
          value={formatPercent(summary?.actionSuccessRate)}
          detail={`P95 latency ${formatLatency(summary?.actionP95LatencyMs)}`}
          icon={WorkflowIcon}
          tone={(summary?.actionSuccessRate ?? 0) >= 95 ? 'good' : 'warn'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <GraphPanel
          title="Operations pulse"
          description="Conversation intake, resolutions, message volume, and SLA breach spikes over time."
          icon={ActivityIcon}
          action={<Badge variant="outline">{period}</Badge>}
          contentClassName="pt-5"
        >
          {isLoading ? (
            <ChartSkeleton height="h-[360px]" />
          ) : !hasTimeline ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={timeline} margin={{ top: 12, right: 18, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsConversationArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={tickInterval} tick={AXIS_TICK} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="left" type="monotone" dataKey="conversations" name="Conversations" stroke="#0ea5e9" fill="url(#analyticsConversationArea)" strokeWidth={2.5} />
                <Line yAxisId="left" type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Bar yAxisId="right" dataKey="messages" name="Messages" fill="#8b5cf6" radius={[8, 8, 0, 0]} maxBarSize={18} />
                <Bar yAxisId="left" dataKey="slaBreaches" name="SLA breaches" fill="#ef4444" radius={[8, 8, 0, 0]} maxBarSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>

        <GraphPanel title="CSAT trend" description="Customer ratings after resolved widget conversations." icon={StarIcon}>
          {isLoading ? (
            <ChartSkeleton height="h-[360px]" />
          ) : (csat?.overview.total ?? 0) === 0 ? (
            <EmptyChart message="No customer satisfaction responses yet. Resolved widget conversations will ask for feedback." />
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={csatTrendData} margin={{ top: 12, right: 16, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={tickInterval} tick={AXIS_TICK} />
                <YAxis yAxisId="count" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="rating" orientation="right" domain={[0, 5]} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(value, name) => [name === 'Avg rating' ? formatRating(typeof value === 'number' ? value : null) : value, name]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="count" dataKey="csatResponses" name="Responses" fill="#f59e0b" radius={[8, 8, 0, 0]} maxBarSize={22} />
                <Line
                  yAxisId="rating"
                  type="monotone"
                  dataKey="avgCsatRatingForChart"
                  name="Avg rating"
                  stroke="#10b981"
                  strokeWidth={2.8}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <GraphPanel title="CSAT breakdown" description="Ratings by channel, handling mode, and recent customer comments." icon={StarIcon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : (csat?.overview.total ?? 0) === 0 ? (
            <EmptyChart message="No CSAT breakdown yet." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={csatByChannelData} margin={{ top: 12, right: 14, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="channel" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                  <YAxis yAxisId="rating" domain={[0, 5]} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                  <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value) => `${value}%`} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(value, name) => [name === 'Avg rating' ? formatRating(Number(value)) : name === 'Positive %' ? `${value}%` : value, name]} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="rating" dataKey="avgRating" name="Avg rating" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Line yAxisId="rate" type="monotone" dataKey="positiveRate" name="Positive %" stroke="#0ea5e9" strokeWidth={2.5} />
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(csat?.byHandling ?? []).map((item) => (
                    <div key={item.handledBy} className="rounded-xl border bg-muted/15 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{labelize(item.handledBy)}</p>
                      <p className="mt-1 text-xl font-semibold">{formatRating(item.avgRating)}</p>
                      <p className="text-[11px] text-muted-foreground">{item.count} responses</p>
                    </div>
                  ))}
                </div>
                <ScrollArea className="h-[188px] pr-2">
                  <div className="space-y-2">
                    {(csat?.recentComments ?? []).length === 0 ? (
                      <p className="rounded-xl border border-dashed bg-muted/15 p-3 text-xs text-muted-foreground">No rating comments yet.</p>
                    ) : (
                      csat?.recentComments.map((comment) => (
                        <div key={`${comment.id}-${comment.createdAt}`} className="rounded-xl border bg-background/70 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">CSAT {comment.rating}/5</p>
                            <Badge variant="outline" className="h-5 text-[10px] capitalize">{comment.channel}</Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{comment.comment ?? 'No comment.'}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground capitalize">{comment.handledBy} - {comment.agentName ?? 'No assignee'}</p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </GraphPanel>

        <GraphPanel title="SLA and channel quality" description="Conversation volume, SLA distribution, and response speed by channel." icon={HeadphonesIcon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[210px_1fr]">
              <div className="relative h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={slaDonutData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={3}>
                      {slaDonutData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_PROPS} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold tracking-tight">{formatPercent(report?.sla.overview.breachRate)}</span>
                  <span className="text-xs text-muted-foreground">breach rate</span>
                </div>
              </div>
              {channelResponseData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={channelResponseData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="channel" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value) => `${value}%`} />
                    <Tooltip {...TOOLTIP_PROPS} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="total" name="Conversations" fill="#14b8a6" radius={[8, 8, 0, 0]} maxBarSize={22} />
                    <Bar yAxisId="left" dataKey="firstResponseMinutes" name="First response (m)" fill="#0ea5e9" radius={[8, 8, 0, 0]} maxBarSize={18} />
                    <Line yAxisId="right" type="monotone" dataKey="breachRate" name="Breach %" stroke="#ef4444" strokeWidth={2.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </GraphPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <GraphPanel title="Agent CSAT" description="Customer satisfaction by assigned teammate." icon={UsersIcon}>
          {isLoading ? (
            <ChartSkeleton height="h-72" />
          ) : (csat?.byAgent.length ?? 0) === 0 ? (
            <EmptyChart message="No agent CSAT yet." />
          ) : (
            <ScrollArea className="h-72 pr-2">
              <div className="space-y-2">
                {csat?.byAgent.map((agent) => (
                  <div key={agent.id} className="rounded-2xl border bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{agent.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{agent.count} responses - {formatPercent(agent.positiveRate)} positive</p>
                      </div>
                      <Badge variant={agent.avgRating >= 4 ? 'outline' : agent.avgRating <= 2 ? 'destructive' : 'secondary'}>
                        {formatRating(agent.avgRating)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </GraphPanel>

        <GraphPanel title="Launch readiness" description="Compact QA gates, kept visible but not dominating analytics." icon={ShieldCheckIcon}>
          {isLoading ? (
            <ChartSkeleton height="h-72" />
          ) : (
            <div className="grid gap-4">
              <div className="rounded-2xl border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Readiness</p>
                  <Badge variant={launch?.status === 'ready' ? 'outline' : launch?.status === 'watch' ? 'secondary' : 'destructive'}>
                    {launch?.status ?? 'watch'}
                  </Badge>
                </div>
                <p className="mt-4 text-4xl font-semibold tracking-tight">{launch?.score ?? 0}</p>
                <Progress value={launch?.score ?? 0} className="mt-3 h-2" />
              </div>
              <ScrollArea className="h-40 pr-2">
                <div className="space-y-2">
                  {(launch?.checks ?? []).slice(0, 5).map((check) => (
                    <div key={check.id} className="flex items-start gap-3 rounded-xl border bg-background/70 p-3">
                      <CheckStatusIcon status={check.status} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{check.title}</p>
                        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </GraphPanel>

        <GraphPanel title="Action and queue watch" description="Only the items that need attention right now." icon={WorkflowIcon}>
          {isLoading ? (
            <ChartSkeleton height="h-72" />
          ) : (
            <ScrollArea className="h-72 pr-2">
              <div className="space-y-3">
                {(report?.actions.recentFailures.length ?? 0) === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2Icon className="size-4" />
                      <p className="text-sm font-semibold">No recent action failures</p>
                    </div>
                    <p className="mt-1 text-xs opacity-80">Action logs look healthy for this period.</p>
                  </div>
                ) : (
                  report?.actions.recentFailures.slice(0, 4).map((failure) => (
                    <div key={`${failure.id}-${failure.createdAt}`} className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">{failure.actionName}</p>
                        <Badge variant="destructive">{failure.status}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs opacity-80">{failure.errorMessage ?? 'No error message captured.'}</p>
                    </div>
                  ))
                )}

                {(report?.sla.activeRiskQueue.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">SLA risk queue</p>
                    {report?.sla.activeRiskQueue.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-2xl border bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{item.contactName || item.contactEmail || 'Unknown visitor'}</p>
                            <p className="mt-1 text-xs text-muted-foreground capitalize">
                              {item.channel} - backlog {item.backlogMinutes ?? 0}m
                            </p>
                          </div>
                          <Badge variant={item.slaState === 'breached' ? 'destructive' : 'secondary'}>
                            {labelize(item.slaState)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </GraphPanel>
      </section>
    </div>
  )
}

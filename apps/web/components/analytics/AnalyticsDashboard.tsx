'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  GaugeIcon,
  ListChecksIcon,
  Loader2Icon,
  MessageSquareIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SirenIcon,
  TimerResetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UserRoundCheckIcon,
  WorkflowIcon,
  XCircleIcon,
} from 'lucide-react'

const PERIOD_OPTIONS: Array<{ label: string; value: AnalyticsPeriod }> = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
]

const STATUS_COLORS: Record<string, string> = {
  bot: '#22c55e',
  pending: '#f59e0b',
  open: '#38bdf8',
  resolved: '#64748b',
  unknown: '#94a3b8',
}

const SLA_COLORS: Record<string, string> = {
  on_track: '#22c55e',
  at_risk: '#f59e0b',
  breached: '#ef4444',
  met: '#14b8a6',
  unknown: '#94a3b8',
}

const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 14,
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

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('en', { notation: value && value >= 10000 ? 'compact' : 'standard' }).format(value ?? 0)
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return 'n/a'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function formatLatency(ms: number | null | undefined) {
  if (!ms) return 'n/a'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function trendClass(change: number | null | undefined, inverted = false) {
  if (change == null || change === 0) return 'text-muted-foreground'
  const positive = inverted ? change < 0 : change > 0
  return positive ? 'text-emerald-500' : 'text-rose-500'
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: AnalyticsPeriod
  onChange: (value: AnalyticsPeriod) => void
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
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

function EmptyChart({ message = 'No data for this period' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MetricTile({
  title,
  value,
  detail,
  icon: Icon,
  accent,
  change,
  invertedTrend = false,
  loading,
}: {
  title: string
  value: string
  detail: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  change?: number | null
  invertedTrend?: boolean
  loading?: boolean
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 ring-1 ring-border/40 transition-colors hover:bg-muted/20">
      <div className={cn('absolute inset-x-0 top-0 h-1', accent)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-24" />
          ) : (
            <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{value}</p>
          )}
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl bg-muted/70 transition-colors group-hover:bg-background">
          <Icon className="size-5 text-foreground" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {change != null && (
          <span className={cn('inline-flex items-center gap-1 font-bold', trendClass(change, invertedTrend))}>
            {change > 0 ? <TrendingUpIcon className="size-3" /> : change < 0 ? <TrendingDownIcon className="size-3" /> : null}
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
        <span className="text-muted-foreground">{detail}</span>
      </div>
    </div>
  )
}

function PremiumPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden border bg-card ring-1 ring-border/40', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base font-bold tracking-tight">{title}</CardTitle>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ReadinessBadge({ status }: { status: string }) {
  if (status === 'ready') {
    return <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Ready</Badge>
  }
  if (status === 'watch') {
    return <Badge className="border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100">Watch</Badge>
  }
  return <Badge className="border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-100">Blocked</Badge>
}

function CheckIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle2Icon className="size-4 text-emerald-500" />
  if (status === 'warn') return <AlertTriangleIcon className="size-4 text-amber-500" />
  if (status === 'fail') return <XCircleIcon className="size-4 text-rose-500" />
  return <ListChecksIcon className="size-4 text-sky-500" />
}

export function AnalyticsDashboard() {
  const { period, setPeriod, report, isLoading, isFetching, isError, error, refetchAll } = useAnalytics()

  const timeline = useMemo(
    () => (report?.timeline ?? []).map((row) => ({ ...row, label: formatShortDate(row.date) })),
    [report?.timeline]
  )
  const statusBreakdown = report?.statusBreakdown ?? []
  const assignees = report?.assignees ?? []
  const actions = report?.actions
  const sla = report?.sla
  const summary = report?.executiveSummary
  const launch = report?.launch
  const tickInterval = period === '90d' ? 13 : period === '30d' ? 5 : 0
  const hasTimeline = timeline.some((row) => row.conversations > 0 || row.actions > 0 || row.messages > 0)

  return (
    <div className="relative flex flex-col gap-6 pb-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <section className="rounded-2xl border bg-card p-5 ring-1 ring-border/40">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-md">
                Reporting
              </Badge>
              <Badge variant="outline" className="rounded-md">
                Launch Hardening
              </Badge>
            </div>
            <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
              Support reporting dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              SLA health, assignee workload, AI action reliability, and launch readiness in one operational view.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <PeriodSelector value={period} onChange={setPeriod} />
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={refetchAll}
              >
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

          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Launch Readiness</p>
                <div className="mt-2 flex items-center gap-2">
                  <ReadinessBadge status={launch?.status ?? 'watch'} />
                  <span className="text-xs text-muted-foreground">{launch?.checks.length ?? 0} checks</span>
                </div>
              </div>
              <ShieldCheckIcon className="size-7 text-emerald-500" />
            </div>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-5xl font-semibold tracking-tight">{launch?.score ?? 0}</span>
              <span className="mb-1.5 text-sm font-medium text-muted-foreground">/ 100</span>
            </div>
            <Progress value={launch?.score ?? 0} className="mt-4 h-2" />
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Manual checks remain visible so launch readiness stays reviewable.
            </p>
          </div>
        </div>
      </section>

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error?.message ?? 'Failed to load analytics.'}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          title="Conversations"
          value={formatNumber(summary?.conversations.value)}
          detail={`vs previous ${period}`}
          change={summary?.conversations.change}
          icon={MessageSquareIcon}
          accent="bg-cyan-400"
          loading={isLoading}
        />
        <MetricTile
          title="SLA Breach Rate"
          value={`${summary?.slaBreachRate ?? 0}%`}
          detail={`${sla?.overview.activeBreaches ?? 0} active breaches`}
          icon={SirenIcon}
          accent="bg-rose-400"
          invertedTrend
          loading={isLoading}
        />
        <MetricTile
          title="Action Success"
          value={`${summary?.actionSuccessRate ?? 0}%`}
          detail={`P95 ${formatLatency(summary?.actionP95LatencyMs)}`}
          icon={WorkflowIcon}
          accent="bg-emerald-400"
          loading={isLoading}
        />
        <MetricTile
          title="First Response"
          value={formatDuration(summary?.avgFirstResponseSeconds)}
          detail="average response speed"
          icon={TimerResetIcon}
          accent="bg-amber-400"
          loading={isLoading}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <PremiumPanel
          title="SLA Operations Timeline"
          description="Conversation volume, resolved work, and breach spikes in one launch view."
          action={<Badge variant="outline">{period}</Badge>}
        >
          {isLoading ? (
            <Skeleton className="h-80 rounded-2xl" />
          ) : !hasTimeline ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={timeline} margin={{ top: 12, right: 14, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="conversationFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={tickInterval} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Area type="monotone" dataKey="conversations" name="Conversations" stroke="#38bdf8" fill="url(#conversationFill)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" fill="url(#resolvedFill)" strokeWidth={2.5} />
                <Bar dataKey="slaBreaches" name="SLA breaches" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={18} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </PremiumPanel>

        <PremiumPanel title="SLA Health Mix" description="Current SLA posture by derived state.">
          {isLoading ? (
            <Skeleton className="h-80 rounded-2xl" />
          ) : (
            <div className="grid gap-5 sm:grid-cols-[180px_1fr] xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'On Track', value: sla?.overview.onTrack ?? 0, color: SLA_COLORS.on_track },
                      { name: 'At Risk', value: sla?.overview.atRisk ?? 0, color: SLA_COLORS.at_risk },
                      { name: 'Breached', value: sla?.overview.breached ?? 0, color: SLA_COLORS.breached },
                      { name: 'Met', value: sla?.overview.met ?? 0, color: SLA_COLORS.met },
                    ]}
                    dataKey="value"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {['on_track', 'at_risk', 'breached', 'met'].map((key) => (
                      <Cell key={key} fill={SLA_COLORS[key]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_PROPS} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {[
                  ['On track', sla?.overview.onTrack ?? 0, SLA_COLORS.on_track],
                  ['At risk', sla?.overview.atRisk ?? 0, SLA_COLORS.at_risk],
                  ['Breached', sla?.overview.breached ?? 0, SLA_COLORS.breached],
                  ['Met', sla?.overview.met ?? 0, SLA_COLORS.met],
                ].map(([label, value, color]) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border bg-background/60 px-3 py-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: String(color) }} />
                    <span className="flex-1 text-sm font-medium">{label}</span>
                    <span className="font-black tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PremiumPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <PremiumPanel
          title="AI Action Reliability"
          description="Success/fail/retry/latency signals for production confidence."
          action={<Badge variant="outline">{formatNumber(actions?.overview.total)} executions</Badge>}
        >
          {isLoading ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (actions?.overview.total ?? 0) === 0 ? (
            <EmptyChart message="No AI action executions in this period" />
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={timeline} margin={{ top: 12, right: 14, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={tickInterval} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="count" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="latency" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}s`} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(value, name) => [name === 'Avg latency' ? formatLatency(Number(value)) : value, name]} />
                <Bar yAxisId="count" dataKey="actionSuccess" name="Success" stackId="actions" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="count" dataKey="actionFailed" name="Failed" stackId="actions" fill="#ef4444" radius={[8, 8, 0, 0]} />
                <Line yAxisId="latency" type="monotone" dataKey="avgActionLatencyMs" name="Avg latency" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </PremiumPanel>

        <PremiumPanel title="Assignee Dashboard" description="Workload, SLA risk, and response ownership by teammate.">
          {isLoading ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : assignees.length === 0 ? (
            <EmptyChart message="No assignee data yet" />
          ) : (
            <div className="space-y-3">
              {assignees.slice(0, 6).map((assignee) => {
                const maxLoad = Math.max(...assignees.map((item) => item.loadScore), 1)
                return (
                  <div key={assignee.id} className="rounded-2xl border bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold">{assignee.name}</span>
                          {assignee.isOnline && <span className="size-2 rounded-full bg-emerald-500" />}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {assignee.email || assignee.role} - {assignee.agentMessages} replies
                        </p>
                      </div>
                      <Badge variant={assignee.breached > 0 ? 'destructive' : 'outline'}>
                        {assignee.activeAssigned} active
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-muted/40 p-2">
                        <p className="text-muted-foreground">SLA met</p>
                        <p className="font-black">{assignee.slaMetRate}%</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-2">
                        <p className="text-muted-foreground">First resp</p>
                        <p className="font-black">{formatDuration(assignee.avgFirstResponseSeconds)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-2">
                        <p className="text-muted-foreground">Breached</p>
                        <p className="font-black">{assignee.breached}</p>
                      </div>
                    </div>
                    <Progress value={(assignee.loadScore / maxLoad) * 100} className="mt-3 h-1.5" />
                  </div>
                )
              })}
            </div>
          )}
        </PremiumPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <PremiumPanel title="Launch QA Checklist" description="A live score plus manual launch gates.">
          {isLoading ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : (
            <ScrollArea className="h-[410px] pr-3">
              <div className="space-y-3">
                {(launch?.checks ?? []).map((check) => (
                  <div key={check.id} className="rounded-2xl border bg-background/70 p-3">
                    <div className="flex items-start gap-3">
                      <CheckIcon status={check.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold">{check.title}</p>
                          <Badge variant="outline" className="h-5 text-[10px]">{check.category}</Badge>
                          <Badge variant={check.severity === 'high' ? 'destructive' : 'secondary'} className="h-5 text-[10px]">
                            {check.severity}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
                        <p className="mt-2 text-xs font-medium text-foreground">{check.nextStep}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </PremiumPanel>

        <div className="grid gap-4">
          <PremiumPanel title="SLA By Channel" description="Channel-level breach visibility and response speed.">
            {isLoading ? (
              <Skeleton className="h-44 rounded-2xl" />
            ) : (sla?.byChannel.length ?? 0) === 0 ? (
              <EmptyChart />
            ) : (
              <div className="space-y-2">
                {sla?.byChannel.slice(0, 5).map((channel) => (
                  <div key={channel.channel} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 rounded-2xl border bg-background/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-bold capitalize">{channel.channel}</p>
                      <p className="text-xs text-muted-foreground">{channel.total} conv</p>
                    </div>
                    <div>
                      <Progress value={Math.min(channel.breachRate, 100)} className="h-2" />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Avg first response {formatDuration(channel.avgFirstResponseSeconds)}
                      </p>
                    </div>
                    <Badge variant={channel.breached > 0 ? 'destructive' : 'outline'}>{channel.breachRate}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </PremiumPanel>

          <PremiumPanel title="Queue Backlog" description="Where operational pressure is collecting right now.">
            {isLoading ? (
              <Skeleton className="h-36 rounded-2xl" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(sla?.queueBacklog ?? []).slice(0, 4).map((queue) => (
                  <div key={queue.state} className="rounded-2xl border bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{statusLabel(queue.state)}</p>
                      <Badge variant={queue.critical > 0 ? 'destructive' : 'outline'}>{queue.count}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Avg backlog {queue.avgBacklogMinutes}m - {queue.critical} critical
                    </p>
                  </div>
                ))}
              </div>
            )}
          </PremiumPanel>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <PremiumPanel title="Action Leaderboard" description="Per-action reliability, latency, retries, and failure rate.">
          {isLoading ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (actions?.byAction.length ?? 0) === 0 ? (
            <EmptyChart message="No action leaderboard yet" />
          ) : (
            <div className="space-y-2">
              {actions?.byAction.slice(0, 7).map((action) => (
                <div key={action.actionId} className="rounded-2xl border bg-background/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{action.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.total} runs - {action.retryCount} retries - P95 {formatLatency(action.p95LatencyMs)}
                      </p>
                    </div>
                    <Badge className={cn(
                      action.successRate >= 95 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' :
                      action.successRate >= 85 ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                      'bg-rose-100 text-rose-700 hover:bg-rose-100'
                    )}>
                      {action.successRate}%
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                    <Progress value={action.successRate} className="h-1.5" />
                    <span className="text-xs text-muted-foreground">{action.failed + action.timeout} fail</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PremiumPanel>

        <PremiumPanel title="Recent Action Failures" description="Launch blockers from external API actions.">
          {isLoading ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (actions?.recentFailures.length ?? 0) === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-center text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2Icon className="mb-3 size-8" />
              <p className="text-sm font-bold">No recent action failures</p>
              <p className="mt-1 text-xs opacity-80">Keep the action test suite running before launch.</p>
            </div>
          ) : (
            <ScrollArea className="h-72 pr-3">
              <div className="space-y-2">
                {actions?.recentFailures.map((failure) => (
                  <div key={`${failure.id}-${failure.createdAt}`} className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold">{failure.actionName}</p>
                      <Badge variant="destructive">{failure.status}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs opacity-80">{failure.errorMessage ?? 'No error message captured.'}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] opacity-80">
                      <span>Latency {formatLatency(failure.durationMs)}</span>
                      <span>Status {failure.statusCode ?? 'n/a'}</span>
                      <span>Retries {failure.retryCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </PremiumPanel>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 ring-1 ring-border/40">
          <div className="flex items-center gap-2 text-sm font-bold">
            <BotIcon className="size-4 text-emerald-500" />
            AI automation
          </div>
          <p className="mt-2 text-3xl font-black">{summary?.aiAutomationRate.value ?? 0}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatNumber(summary?.messages.ai)} AI messages vs {formatNumber(summary?.messages.agent)} agent messages</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 ring-1 ring-border/40">
          <div className="flex items-center gap-2 text-sm font-bold">
            <UserRoundCheckIcon className="size-4 text-cyan-500" />
            Resolution rate
          </div>
          <p className="mt-2 text-3xl font-black">{summary?.resolutionRate.value ?? 0}%</p>
          <p className={cn('mt-1 text-xs font-semibold', trendClass(summary?.resolutionRate.change))}>
            {summary?.resolutionRate.change != null ? `${summary.resolutionRate.change > 0 ? '+' : ''}${summary.resolutionRate.change}% vs previous` : 'No previous period baseline'}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 ring-1 ring-border/40">
          <div className="flex items-center gap-2 text-sm font-bold">
            <GaugeIcon className="size-4 text-amber-500" />
            Action retry rate
          </div>
          <p className="mt-2 text-3xl font-black">{actions?.overview.retryRate ?? 0}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{actions?.overview.retryCount ?? 0} retries captured in action logs</p>
        </div>
      </section>

      <Separator />
      <p className="text-center text-xs text-muted-foreground">
        Reporting data refreshes every 60 seconds. Run the launch load test and rollback review before production cutover.
      </p>
    </div>
  )
}

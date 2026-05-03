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
import {
  ActivityIcon,
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  Clock3Icon,
  GaugeIcon,
  HeadphonesIcon,
  Loader2Icon,
  MessageSquareIcon,
  RefreshCwIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WorkflowIcon,
  ZapIcon,
} from 'lucide-react'

const PERIOD_OPTIONS: Array<{ label: string; value: AnalyticsPeriod }> = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
]

const STATUS_COLORS: Record<string, string> = {
  bot: '#10b981',
  pending: '#f59e0b',
  open: '#0ea5e9',
  resolved: '#64748b',
  closed: '#64748b',
  unknown: '#94a3b8',
}

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

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return 'n/a'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
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
    contactGrowth,
    callAnalytics,
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

  const growthTimeline = useMemo(() => {
    const callByDate = new Map(callAnalytics.map((row) => [row.date, row]))
    const contactByDate = new Map(contactGrowth.map((row) => [row.date, row]))
    const dates = new Set<string>([
      ...contactGrowth.map((row) => row.date),
      ...callAnalytics.map((row) => row.date),
    ])

    return Array.from(dates)
      .sort()
      .map((date) => {
        const contact = contactByDate.get(date)
        const call = callByDate.get(date)
        return {
          date,
          label: formatShortDate(date),
          newContacts: contact?.new ?? 0,
          cumulativeContacts: contact?.cumulative ?? 0,
          calls: call?.count ?? 0,
          voiceMinutes: call?.minutes ?? 0,
        }
      })
  }, [callAnalytics, contactGrowth])

  const statusData = useMemo(
    () => (report?.statusBreakdown ?? []).map((item) => ({
      ...item,
      color: STATUS_COLORS[item.status] ?? STATUS_COLORS.unknown,
      label: labelize(item.status),
    })),
    [report?.statusBreakdown]
  )

  const slaDonutData = useMemo(() => [
    { name: 'On track', value: report?.sla.overview.onTrack ?? 0, color: SLA_COLORS.on_track },
    { name: 'At risk', value: report?.sla.overview.atRisk ?? 0, color: SLA_COLORS.at_risk },
    { name: 'Breached', value: report?.sla.overview.breached ?? 0, color: SLA_COLORS.breached },
    { name: 'Met', value: report?.sla.overview.met ?? 0, color: SLA_COLORS.met },
  ], [report?.sla.overview.atRisk, report?.sla.overview.breached, report?.sla.overview.met, report?.sla.overview.onTrack])

  const channelResponseData = useMemo(
    () => (report?.sla.byChannel ?? []).slice(0, 8).map((channel) => ({
      channel: labelize(channel.channel),
      total: channel.total,
      breachRate: channel.breachRate,
      firstResponseMinutes: Math.round((channel.avgFirstResponseSeconds ?? 0) / 60),
      resolutionHours: Number(((channel.avgResolutionSeconds ?? 0) / 3600).toFixed(1)),
    })),
    [report?.sla.byChannel]
  )

  const assigneeLoadData = useMemo(
    () => (report?.assignees ?? []).slice(0, 8).map((agent) => ({
      name: agent.name.length > 18 ? `${agent.name.slice(0, 18)}...` : agent.name,
      active: agent.activeAssigned,
      breached: agent.breached,
      replies: agent.agentMessages,
      loadScore: agent.loadScore,
    })),
    [report?.assignees]
  )

  const actionLeaderboardData = useMemo(
    () => (report?.actions.byAction ?? []).slice(0, 8).map((action) => ({
      name: action.displayName.length > 20 ? `${action.displayName.slice(0, 20)}...` : action.displayName,
      successRate: action.successRate,
      failures: action.failed + action.timeout,
      retryCount: action.retryCount,
      p95Seconds: Number(((action.p95LatencyMs ?? 0) / 1000).toFixed(1)),
    })),
    [report?.actions.byAction]
  )

  const queueBacklogData = useMemo(
    () => (report?.sla.queueBacklog ?? []).map((queue) => ({
      state: labelize(queue.state),
      count: queue.count,
      avgBacklogMinutes: queue.avgBacklogMinutes,
      critical: queue.critical,
      stale: queue.stale,
    })),
    [report?.sla.queueBacklog]
  )

  const summary = report?.executiveSummary
  const launch = report?.launch
  const hasTimeline = timeline.some((row) => row.conversations > 0 || row.messages > 0 || row.actions > 0)
  const tickInterval = period === '90d' ? 13 : period === '30d' ? 5 : 0

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 pb-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <section className="rounded-2xl border bg-card p-4 shadow-none md:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-lg">Analytics Studio</Badge>
              <Badge variant="outline" className="rounded-lg">Realtime reporting</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Performance analytics</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Track demand, SLA pressure, automation quality, channel health, action reliability, and team load with graph-first reporting.
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error?.message ?? 'Failed to load analytics.'}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InsightPill
          label="Conversation demand"
          value={formatCompact(summary?.conversations.value)}
          detail={`${formatPercent(summary?.resolutionRate.value)} resolved in window`}
          icon={MessageSquareIcon}
        />
        <InsightPill
          label="SLA pressure"
          value={formatPercent(summary?.slaBreachRate)}
          detail={`${report?.sla.overview.activeBreaches ?? 0} active breaches`}
          icon={Clock3Icon}
          tone={(summary?.slaBreachRate ?? 0) > 0 ? 'danger' : 'good'}
        />
        <InsightPill
          label="AI automation"
          value={formatPercent(summary?.aiAutomationRate.value)}
          detail={`${formatCompact(summary?.messages.ai)} AI replies tracked`}
          icon={BotIcon}
          tone="good"
        />
        <InsightPill
          label="Action quality"
          value={formatPercent(summary?.actionSuccessRate)}
          detail={`P95 latency ${formatLatency(summary?.actionP95LatencyMs)}`}
          icon={WorkflowIcon}
          tone={(summary?.actionSuccessRate ?? 0) >= 95 ? 'good' : 'warn'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <GraphPanel
          title="Operations pulse"
          description="Conversation intake, resolutions, message volume, and SLA breach spikes over time."
          icon={ActivityIcon}
          action={<Badge variant="outline">{period}</Badge>}
          contentClassName="pt-5"
        >
          {isLoading ? (
            <ChartSkeleton height="h-[380px]" />
          ) : !hasTimeline ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={timeline} margin={{ top: 12, right: 18, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsConversationArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="analyticsMessageArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={tickInterval} tick={AXIS_TICK} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="left" type="monotone" dataKey="conversations" name="Conversations" stroke="#0ea5e9" fill="url(#analyticsConversationArea)" strokeWidth={2.5} />
                <Area yAxisId="right" type="monotone" dataKey="messages" name="Messages" stroke="#8b5cf6" fill="url(#analyticsMessageArea)" strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Bar yAxisId="left" dataKey="slaBreaches" name="SLA breaches" fill="#ef4444" radius={[8, 8, 0, 0]} maxBarSize={18} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>

        <GraphPanel title="SLA posture" description="Live SLA state distribution for the selected period." icon={ShieldCheckIcon}>
          {isLoading ? (
            <ChartSkeleton height="h-[380px]" />
          ) : (
            <div className="grid gap-5">
              <div className="relative h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={slaDonutData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={98} paddingAngle={3}>
                      {slaDonutData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_PROPS} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold tracking-tight">{formatPercent(report?.sla.overview.breachRate)}</span>
                  <span className="text-xs text-muted-foreground">breach rate</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {slaDonutData.map((item) => (
                  <div key={item.name} className="rounded-xl border bg-background/70 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GraphPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <GraphPanel title="Conversation state flow" description="Stacked state mix by day: bot, pending, open, resolved." icon={RouteIcon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : !hasTimeline ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={310}>
              <AreaChart data={timeline} margin={{ top: 12, right: 16, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={tickInterval} tick={AXIS_TICK} />
                <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="bot" name="Bot" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
                <Area type="monotone" dataKey="pending" name="Pending" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.35} />
                <Area type="monotone" dataKey="open" name="Open" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.35} />
                <Area type="monotone" dataKey="resolved" name="Resolved" stackId="1" stroke="#64748b" fill="#64748b" fillOpacity={0.35} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>

        <GraphPanel title="Message mix and automation" description="User, AI, and agent messages with automation-rate trend." icon={SparklesIcon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : !hasTimeline ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={310}>
              <ComposedChart data={timeline} margin={{ top: 12, right: 16, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={tickInterval} tick={AXIS_TICK} />
                <YAxis yAxisId="count" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value) => `${value}%`} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="count" dataKey="userMessages" name="User" stackId="messages" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="count" dataKey="aiMessages" name="AI" stackId="messages" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="count" dataKey="agentMessages" name="Agent" stackId="messages" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                <Line yAxisId="rate" type="monotone" dataKey="automationRate" name="Automation %" stroke="#111827" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <GraphPanel title="Channel response quality" description="Breach rate, first response, and resolution speed by channel." icon={HeadphonesIcon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : channelResponseData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={channelResponseData} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="channel" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value) => `${value}%`} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="firstResponseMinutes" name="First response (m)" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="breachRate" name="Breach %" stroke="#ef4444" strokeWidth={2.5} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>

        <GraphPanel title="Contact and voice growth" description="New contacts, cumulative audience, call volume, and voice minutes." icon={UsersIcon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : growthTimeline.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={growthTimeline} margin={{ top: 12, right: 16, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="contactCumulativeArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={tickInterval} tick={AXIS_TICK} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="right" type="monotone" dataKey="cumulativeContacts" name="Total contacts" stroke="#14b8a6" fill="url(#contactCumulativeArea)" strokeWidth={2} />
                <Bar yAxisId="left" dataKey="newContacts" name="New contacts" fill="#0ea5e9" radius={[8, 8, 0, 0]} maxBarSize={18} />
                <Line yAxisId="left" type="monotone" dataKey="voiceMinutes" name="Voice minutes" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <GraphPanel title="AI action reliability" description="Daily action successes, failures, and latency trend." icon={WorkflowIcon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : (report?.actions.overview.total ?? 0) === 0 ? (
            <EmptyChart message="No AI action executions in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={330}>
              <ComposedChart data={timeline} margin={{ top: 12, right: 16, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={tickInterval} tick={AXIS_TICK} />
                <YAxis yAxisId="count" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="latency" orientation="right" tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value) => `${Number(value) / 1000}s`} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(value, name) => [name === 'Avg latency' ? formatLatency(Number(value)) : value, name]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="count" dataKey="actionSuccess" name="Success" stackId="actions" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="count" dataKey="actionFailed" name="Failed" stackId="actions" fill="#ef4444" radius={[8, 8, 0, 0]} />
                <Line yAxisId="latency" type="monotone" dataKey="avgActionLatencyMs" name="Avg latency" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>

        <GraphPanel title="Action leaderboard" description="Success rate, retries, and p95 latency by action." icon={ZapIcon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : actionLeaderboardData.length === 0 ? (
            <EmptyChart message="No action leaderboard yet." />
          ) : (
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={actionLeaderboardData} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value) => `${value}%`} />
                <YAxis dataKey="name" type="category" width={104} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(value, name) => [name === 'successRate' ? `${value}%` : value, labelize(String(name))]} />
                <Bar dataKey="successRate" name="Success rate" fill="#10b981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <GraphPanel title="Assignee load matrix" description="Active workload, breached conversations, and replies by assignee." icon={GaugeIcon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : assigneeLoadData.length === 0 ? (
            <EmptyChart message="No assignee workload data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={assigneeLoadData} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis dataKey="name" type="category" width={110} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="active" name="Active" stackId="load" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                <Bar dataKey="breached" name="Breached" stackId="load" fill="#ef4444" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>

        <GraphPanel title="Queue backlog pressure" description="Average backlog minutes and critical queue pockets." icon={Clock3Icon}>
          {isLoading ? (
            <ChartSkeleton />
          ) : queueBacklogData.length === 0 ? (
            <EmptyChart message="No active backlog in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={330}>
              <ComposedChart data={queueBacklogData} margin={{ top: 12, right: 16, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="state" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="minutes" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis yAxisId="count" orientation="right" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="minutes" dataKey="avgBacklogMinutes" name="Avg backlog (m)" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                <Line yAxisId="count" type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" strokeWidth={2.5} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </GraphPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <GraphPanel title="Status composition" description="Current conversation distribution for the selected period." icon={RouteIcon}>
          {isLoading ? (
            <ChartSkeleton height="h-72" />
          ) : statusData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[210px_1fr]">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} dataKey="count" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={3}>
                    {statusData.map((entry) => <Cell key={entry.status} fill={entry.color} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_PROPS} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {statusData.map((item) => (
                  <div key={item.status} className="flex items-center gap-3 rounded-xl border bg-background/70 px-3 py-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    <span className="font-semibold tabular-nums">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GraphPanel>

        <GraphPanel title="Active SLA risk queue" description="Highest-risk conversations that need operational attention." icon={AlertTriangleIcon}>
          {isLoading ? (
            <ChartSkeleton height="h-72" />
          ) : (report?.sla.activeRiskQueue.length ?? 0) === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-center text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2Icon className="mb-3 size-8" />
              <p className="text-sm font-semibold">No active SLA risks</p>
              <p className="mt-1 text-xs opacity-80">The live queue is healthy for this window.</p>
            </div>
          ) : (
            <ScrollArea className="h-72 pr-3">
              <div className="space-y-2">
                {report?.sla.activeRiskQueue.map((item) => (
                  <div key={item.id} className="rounded-2xl border bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.contactName || item.contactEmail || 'Unknown visitor'}</p>
                        <p className="mt-1 text-xs text-muted-foreground capitalize">
                          {item.channel} - {item.status} - backlog {item.backlogMinutes ?? 0}m
                        </p>
                      </div>
                      <Badge variant={item.slaState === 'breached' ? 'destructive' : 'secondary'}>
                        {labelize(item.slaState)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Target {item.slaTargetAt ? format(parseISO(item.slaTargetAt), 'MMM d, h:mm a') : 'not configured'}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </GraphPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <GraphPanel title="Launch readiness signals" description="Operational gates still visible, but no longer dominating the page." icon={ShieldCheckIcon}>
          {isLoading ? (
            <ChartSkeleton height="h-72" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[190px_1fr]">
              <div className="rounded-2xl border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Readiness</p>
                  <Badge variant={launch?.status === 'ready' ? 'outline' : launch?.status === 'watch' ? 'secondary' : 'destructive'}>
                    {launch?.status ?? 'watch'}
                  </Badge>
                </div>
                <p className="mt-5 text-5xl font-semibold tracking-tight">{launch?.score ?? 0}</p>
                <Progress value={launch?.score ?? 0} className="mt-4 h-2" />
                <p className="mt-3 text-xs text-muted-foreground">Score combines SLA, actions, and manual QA gates.</p>
              </div>
              <ScrollArea className="h-72 pr-3">
                <div className="space-y-2">
                  {(launch?.checks ?? []).map((check) => (
                    <div key={check.id} className="rounded-2xl border bg-background/70 p-3">
                      <div className="flex items-start gap-3">
                        <CheckStatusIcon status={check.status} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{check.title}</p>
                            <Badge variant="outline" className="h-5 text-[10px]">{check.category}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </GraphPanel>

        <GraphPanel title="Recent action failures" description="External API failures that can reduce AI trust." icon={WorkflowIcon}>
          {isLoading ? (
            <ChartSkeleton height="h-72" />
          ) : (report?.actions.recentFailures.length ?? 0) === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-center text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2Icon className="mb-3 size-8" />
              <p className="text-sm font-semibold">No recent action failures</p>
              <p className="mt-1 text-xs opacity-80">Action logs look clean for this selected period.</p>
            </div>
          ) : (
            <ScrollArea className="h-72 pr-3">
              <div className="space-y-2">
                {report?.actions.recentFailures.map((failure) => (
                  <div key={`${failure.id}-${failure.createdAt}`} className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-100">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{failure.actionName}</p>
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
        </GraphPanel>
      </section>
    </div>
  )
}

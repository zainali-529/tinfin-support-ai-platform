'use client'

/**
 * apps/web/components/analytics/AnalyticsDashboard.tsx
 *
 * Full analytics dashboard with:
 *  - Period selector
 *  - KPI overview cards with trend indicators
 *  - Conversation volume area chart
 *  - Status breakdown donut
 *  - Message volume stacked bar chart
 *  - AI vs Human handling donut
 *  - Contact growth line chart
 *  - Resolution rate trend line
 *  - Voice call bar chart
 */

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { useAnalytics, type AnalyticsPeriod } from '@/hooks/useAnalytics'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Separator } from '@workspace/ui/components/separator'
import { cn } from '@workspace/ui/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  MessageSquareIcon, UsersIcon, ZapIcon, PhoneCallIcon,
  TrendingUpIcon, TrendingDownIcon, MinusIcon, RefreshCwIcon,
  CheckCircleIcon, ClockIcon, BarChart2Icon, BotIcon,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, period: AnalyticsPeriod) {
  try {
    const d = parseISO(dateStr)
    return period === '90d' ? format(d, 'MMM d') : format(d, 'MMM d')
  } catch {
    return dateStr
  }
}

function formatShortDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), 'MMM d')
  } catch {
    return dateStr
  }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number
  change?: number | null
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  loading?: boolean
  color?: string
  suffix?: string
}

function KpiCard({ label, value, change, sub, icon: Icon, loading, color = 'text-primary', suffix }: KpiCardProps) {
  const isPositive = change != null && change > 0
  const isNegative = change != null && change < 0
  const isFlat = change != null && change === 0

  return (
    <div className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card px-5 py-4 transition-shadow hover:shadow-md ring-1 ring-foreground/5">
      {/* Subtle accent line */}
      <div className={cn('absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity', color.replace('text-', 'bg-'))} />

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className={cn('flex size-8 items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-primary/10', color.replace('text-', 'group-hover:text-'))}>
          <Icon className={cn('size-4', color)} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-9 w-28" />
      ) : (
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold tabular-nums tracking-tight leading-none">
            {value}
          </span>
          {suffix && <span className="text-sm text-muted-foreground mb-0.5">{suffix}</span>}
        </div>
      )}

      <div className="flex items-center gap-2">
        {change != null && !loading && (
          <span className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
            isNegative ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
            'bg-muted text-muted-foreground'
          )}>
            {isPositive ? <TrendingUpIcon className="size-2.5" /> :
             isNegative ? <TrendingDownIcon className="size-2.5" /> :
             <MinusIcon className="size-2.5" />}
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Shared tooltip style ─────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    fontSize: '12px',
    color: 'hsl(var(--popover-foreground))',
  },
  labelStyle: { fontWeight: 600, marginBottom: 4 },
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
  )
}

// ─── Period Selector ──────────────────────────────────────────────────────────

function PeriodSelector({
  value,
  onChange,
}: {
  value: AnalyticsPeriod
  onChange: (p: AnalyticsPeriod) => void
}) {
  const options: { label: string; value: AnalyticsPeriod }[] = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
  ]
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
            value === opt.value
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Empty Chart State ────────────────────────────────────────────────────────

function EmptyChart({ message = 'No data for this period' }: { message?: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── Status Color Map ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  bot: '#6366f1',
  pending: '#f59e0b',
  open: '#10b981',
  resolved: '#64748b',
}

const STATUS_LABELS: Record<string, string> = {
  bot: 'AI Handling',
  pending: 'Pending',
  open: 'Agent',
  resolved: 'Resolved',
}

// ─── Custom Donut Label ───────────────────────────────────────────────────────

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number
}) {
  if (cx == null || cy == null || midAngle == null || innerRadius == null || outerRadius == null || percent == null) {
    return null
  }
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const {
    period, setPeriod,
    overview,
    convTrend,
    statusBreakdown,
    messageVolume,
    contactGrowth,
    resolutionTrend,
    callAnalytics,
    handlingBreakdown,
    isLoading,
    refetchAll,
  } = useAnalytics()

  // Slim down X-axis labels for 90d to avoid crowding
  const tickInterval = period === '90d' ? 14 : period === '30d' ? 6 : 1

  const hasCallData = callAnalytics.some(d => d.count > 0)
  const hasConvData = convTrend.some(d => d.total > 0)
  const hasMsgData  = messageVolume.some(d => d.total > 0)
  const hasContactData = contactGrowth.some(d => d.new > 0)

  const totalStatusCount = statusBreakdown.reduce((s, d) => s + d.count, 0)

  // Pre-format dates for charts
  const convTrendFormatted = useMemo(
    () => convTrend.map(d => ({ ...d, label: formatShortDate(d.date) })),
    [convTrend]
  )
  const msgVolumeFormatted = useMemo(
    () => messageVolume.map(d => ({ ...d, label: formatShortDate(d.date) })),
    [messageVolume]
  )
  const contactGrowthFormatted = useMemo(
    () => contactGrowth.map(d => ({ ...d, label: formatShortDate(d.date) })),
    [contactGrowth]
  )
  const resolutionFormatted = useMemo(
    () => resolutionTrend.map(d => ({ ...d, label: formatShortDate(d.date) })),
    [resolutionTrend]
  )
  const callFormatted = useMemo(
    () => callAnalytics.map(d => ({ ...d, label: formatShortDate(d.date) })),
    [callAnalytics]
  )

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart2Icon className="size-6 text-primary" />
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversation trends, AI performance, and support insights.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PeriodSelector value={period} onChange={setPeriod} />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={refetchAll}
            title="Refresh"
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* ── KPI Overview Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-4">
        <KpiCard
          label="Conversations"
          value={overview?.conversations.value ?? 0}
          change={overview?.conversations.change ?? null}
          sub={`vs prev ${period}`}
          icon={MessageSquareIcon}
          loading={isLoading}
          color="text-primary"
        />
        <KpiCard
          label="Resolution Rate"
          value={`${overview?.resolutionRate.value ?? 0}%`}
          change={overview?.resolutionRate.change ?? null}
          sub="resolved or closed"
          icon={CheckCircleIcon}
          loading={isLoading}
          color="text-emerald-500"
        />
        <KpiCard
          label="AI Automation"
          value={`${overview?.aiAutomationRate.value ?? 0}%`}
          change={overview?.aiAutomationRate.change ?? null}
          sub="AI-handled messages"
          icon={BotIcon}
          loading={isLoading}
          color="text-violet-500"
        />
        <KpiCard
          label="Messages"
          value={overview?.messages.value ?? 0}
          change={overview?.messages.change ?? null}
          sub="total exchanged"
          icon={ZapIcon}
          loading={isLoading}
          color="text-amber-500"
        />
        <KpiCard
          label="New Contacts"
          value={overview?.newContacts.value ?? 0}
          change={overview?.newContacts.change ?? null}
          sub={`${overview?.totalContacts ?? 0} total`}
          icon={UsersIcon}
          loading={isLoading}
          color="text-blue-500"
        />
        <KpiCard
          label="Pending Now"
          value={overview?.pendingConversations ?? 0}
          sub="awaiting agent"
          icon={ClockIcon}
          loading={isLoading}
          color="text-amber-500"
        />
        <KpiCard
          label="Voice Calls"
          value={overview?.calls.value ?? 0}
          change={overview?.calls.change ?? null}
          sub={`${overview?.voiceMinutes ?? 0} min total`}
          icon={PhoneCallIcon}
          loading={isLoading}
          color="text-teal-500"
        />
        <KpiCard
          label="Voice Minutes"
          value={overview?.voiceMinutes ?? 0}
          sub="call duration"
          icon={PhoneCallIcon}
          loading={isLoading}
          color="text-teal-500"
          suffix="min"
        />
      </div>

      {/* ── Row 1: Conversation Trend + Status Breakdown ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Conversation Volume — Area Chart (2/3 width) */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-0 px-5 pt-5">
            <SectionHeader
              title="Conversation Volume"
              description="Daily conversations by outcome status"
            />
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {isLoading ? (
              <Skeleton className="h-52 w-full rounded-lg" />
            ) : !hasConvData ? (
              <div className="h-52"><EmptyChart /></div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={convTrendFormatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false} tickLine={false}
                    interval={tickInterval}
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} labelFormatter={(l) => `Date: ${l}`} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" fill="url(#gradTotal)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" fill="url(#gradResolved)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="pending" name="Pending" stroke="#f59e0b" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown — Donut (1/3 width) */}
        <Card>
          <CardHeader className="pb-0 px-5 pt-5">
            <SectionHeader
              title="Status Breakdown"
              description={`${totalStatusCount} conversations`}
            />
          </CardHeader>
          <CardContent className="flex flex-col items-center px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-48 w-48 rounded-full mx-auto" />
            ) : statusBreakdown.length === 0 ? (
              <div className="h-48 w-full"><EmptyChart /></div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={48} outerRadius={72}
                      dataKey="count"
                      nameKey="status"
                      paddingAngle={2}
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {statusBreakdown.map((entry, index) => (
                        <Cell key={index} fill={entry.color ?? STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(value, name) => [value, STATUS_LABELS[name as string] ?? name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
                  {statusBreakdown.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full shrink-0" style={{ background: entry.color ?? STATUS_COLORS[entry.status] }} />
                      <span className="text-[11px] text-muted-foreground">
                        {STATUS_LABELS[entry.status] ?? entry.status}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Message Volume + AI vs Human ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Message Volume — Stacked Bar (2/3) */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-0 px-5 pt-5">
            <SectionHeader
              title="Message Volume"
              description="Daily breakdown by sender role"
            />
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {isLoading ? (
              <Skeleton className="h-52 w-full rounded-lg" />
            ) : !hasMsgData ? (
              <div className="h-52"><EmptyChart /></div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={msgVolumeFormatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={period === '7d' ? 24 : 8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={tickInterval} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="user" name="Visitor" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="assistant" name="AI" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="agent" name="Agent" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* AI vs Human Handling — Donut (1/3) */}
        <Card>
          <CardHeader className="pb-0 px-5 pt-5">
            <SectionHeader
              title="AI vs Human"
              description="Conversation handling split"
            />
          </CardHeader>
          <CardContent className="flex flex-col items-center px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-48 w-48 rounded-full mx-auto" />
            ) : handlingBreakdown.every(d => d.value === 0) ? (
              <div className="h-48 w-full"><EmptyChart /></div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={handlingBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={48} outerRadius={72}
                      dataKey="value"
                      nameKey="label"
                      paddingAngle={2}
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {handlingBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 mt-2 w-full">
                  {handlingBreakdown.map((entry, i) => {
                    const total = handlingBreakdown.reduce((s, d) => s + d.value, 0)
                    const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <div className="size-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
                        <span className="text-[11px] text-muted-foreground flex-1">{entry.label}</span>
                        <span className="text-[11px] font-bold tabular-nums">{pct}%</span>
                        <span className="text-[10px] text-muted-foreground">({entry.value})</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Contact Growth + Resolution Rate ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Contact Growth — Line Chart */}
        <Card>
          <CardHeader className="pb-0 px-5 pt-5">
            <SectionHeader
              title="Contact Growth"
              description="New contacts acquired over time"
            />
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {isLoading ? (
              <Skeleton className="h-44 w-full rounded-lg" />
            ) : !hasContactData ? (
              <div className="h-44"><EmptyChart /></div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={contactGrowthFormatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCumulative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={tickInterval} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="cumulative" name="Total Contacts" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="new" name="New This Day" stroke="#6366f1" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Resolution Rate Trend — Line Chart */}
        <Card>
          <CardHeader className="pb-0 px-5 pt-5">
            <SectionHeader
              title="Resolution Rate"
              description="Daily % of conversations resolved"
            />
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {isLoading ? (
              <Skeleton className="h-44 w-full rounded-lg" />
            ) : resolutionTrend.every(d => d.total === 0) ? (
              <div className="h-44"><EmptyChart /></div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={resolutionFormatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={tickInterval} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Resolution Rate']} />
                  <Line type="monotone" dataKey="rate" name="Rate" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Voice Call Analytics ── */}
      {(hasCallData || isLoading) && (
        <Card>
          <CardHeader className="pb-0 px-5 pt-5">
            <SectionHeader
              title="Voice Call Analytics"
              description="Daily call volume and minutes"
            />
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {isLoading ? (
              <Skeleton className="h-44 w-full rounded-lg" />
            ) : !hasCallData ? (
              <div className="h-44"><EmptyChart message="No voice calls in this period" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={callFormatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={period === '7d' ? 24 : 8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={tickInterval} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="count" name="Calls" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="minutes" name="Minutes" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Footer note ── */}
      <p className="text-center text-[11px] text-muted-foreground/60 pb-2">
        Data reflects conversations and events in your active organization. Refreshes every 60 seconds.
      </p>

    </div>
  )
}
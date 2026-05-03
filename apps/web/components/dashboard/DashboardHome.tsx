'use client'

import Link from 'next/link'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { cn } from '@workspace/ui/lib/utils'
import {
  BarChart3Icon,
  BookOpenIcon,
  Clock3Icon,
  InboxIcon,
  RefreshCwIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react'
import { useActiveOrg } from '@/components/org/OrgContext'
import { DashboardActivityFeed } from './DashboardActivityFeed'
import { DashboardKpis } from './DashboardKpis'
import { DashboardOnboardingCard } from './DashboardOnboardingCard'
import { DashboardOperationsGrid } from './DashboardOperationsGrid'
import { DashboardRecentConversations } from './DashboardRecentConversations'
import { useDashboard } from '@/hooks/useDashboard'
import type { DashboardPeriod } from '@/hooks/useDashboard'

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: 'Today', value: 'today' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
]

const QUICK_ACTIONS = [
  { label: 'Open Inbox', href: '/inbox', icon: InboxIcon },
  { label: 'Analytics', href: '/analytics', icon: BarChart3Icon },
  { label: 'Knowledge', href: '/knowledge', icon: BookOpenIcon },
  { label: 'Channels', href: '/settings/channels', icon: Settings2Icon },
]

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatUpdatedAt(value: string): string {
  if (!value) return 'Not synced yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sync time unavailable'
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function DashboardHome() {
  const activeOrg = useActiveOrg()
  const {
    period,
    setPeriod,
    overview,
    recentConversations,
    activityFeed,
    onboarding,
    isLoading,
    isFetching,
    errorMessage,
    refetchAll,
  } = useDashboard()

  const riskCount = overview.summary.slaAtRiskConversations + overview.summary.slaBreachedConversations
  const healthLabel = riskCount > 0 ? `${riskCount} SLA items need attention` : 'Operations are steady'

  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden border bg-card shadow-none">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-6 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Synced {formatUpdatedAt(overview.updatedAt)}
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {greeting()}, {activeOrg.name}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    A command center for workload, channels, automation, and launch readiness. Keep an eye on what needs action before customers feel the delay.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl border bg-muted/30 p-1">
                    {PERIOD_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPeriod(option.value)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                          period === option.value
                            ? 'bg-background text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={refetchAll}>
                    <RefreshCwIcon className={cn('size-3.5', isFetching && 'animate-spin')} />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheckIcon className="size-4 text-emerald-500" />
                    Health
                  </div>
                  <p className="mt-2 text-lg font-semibold tracking-tight">{healthLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">SLA and queue pressure summary.</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <SparklesIcon className="size-4 text-primary" />
                    Automation
                  </div>
                  <p className="mt-2 text-lg font-semibold tracking-tight">{overview.summary.aiHandledRate}% AI assist</p>
                  <p className="mt-1 text-xs text-muted-foreground">{overview.summary.activeAiActions} active actions configured.</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock3Icon className="size-4 text-amber-500" />
                    Queue
                  </div>
                  <p className="mt-2 text-lg font-semibold tracking-tight">{overview.queue.totalActive} active threads</p>
                  <p className="mt-1 text-xs text-muted-foreground">{overview.queue.unassigned} need ownership.</p>
                </div>
              </div>
            </div>

            <div className="border-t bg-muted/20 p-5 lg:border-l lg:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick actions</p>
              <div className="mt-4 grid gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <Button key={action.href} variant="outline" className="h-11 justify-start gap-2 bg-background" asChild>
                    <Link href={action.href}>
                      <action.icon className="size-4" />
                      {action.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <Card className="border-destructive/30 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-destructive">Dashboard data unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
            </div>
            <Button size="sm" onClick={refetchAll}>Try again</Button>
          </CardContent>
        </Card>
      )}

      <DashboardKpis overview={overview} isLoading={isLoading} />

      <DashboardOperationsGrid overview={overview} onboarding={onboarding} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <DashboardRecentConversations conversations={recentConversations} isLoading={isLoading} />
        </div>
        <div className="xl:col-span-2">
          <DashboardActivityFeed items={activityFeed} isLoading={isLoading} />
        </div>
      </div>

      <DashboardOnboardingCard onboarding={onboarding} isLoading={isLoading} />
    </div>
  )
}

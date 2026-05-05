'use client'

import Link from 'next/link'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import {
  BarChart3Icon,
  BookOpenIcon,
  InboxIcon,
  RefreshCwIcon,
  Settings2Icon,
} from 'lucide-react'
import { useActiveOrg } from '@/components/org/OrgContext'
import { DashboardActivityFeed } from './DashboardActivityFeed'
import { DashboardKpis } from './DashboardKpis'
import { DashboardOnboardingCard } from './DashboardOnboardingCard'
import { DashboardOperationsGrid } from './DashboardOperationsGrid'
import { DashboardRecentConversations } from './DashboardRecentConversations'
import { useDashboard } from '@/hooks/useDashboard'
import type { DashboardPeriod } from '@/hooks/useDashboard'
import { LaunchErrorState } from '@/components/launch/LaunchState'

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

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Synced {formatUpdatedAt(overview.updatedAt)}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting()}, {activeOrg.name}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Monitor workload, channels, automation, and launch readiness from one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <div className="hidden items-center gap-2 lg:flex">
            {QUICK_ACTIONS.map((action) => (
              <Button key={action.href} variant="outline" size="sm" className="gap-1.5 bg-background" asChild>
                <Link href={action.href}>
                  <action.icon className="size-3.5" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </section>

      {errorMessage && (
        <LaunchErrorState
          error={errorMessage}
          title="Dashboard data unavailable"
          onRetry={refetchAll}
          docsHref="/docs/troubleshooting/common-issues"
        />
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

      <DashboardOnboardingCard
        onboarding={onboarding}
        isLoading={isLoading}
        isVerifying={isFetching}
        onVerify={refetchAll}
      />
    </div>
  )
}

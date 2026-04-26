'use client'

import Link from 'next/link'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
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
import { DashboardRecentConversations } from './DashboardRecentConversations'
import { useDashboard } from '@/hooks/useDashboard'
import type { DashboardPeriod } from '@/hooks/useDashboard'

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
]

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {activeOrg.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor support operations, team activity, and channel readiness.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  period === option.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={refetchAll}
          >
            <RefreshCwIcon
              className={cn('size-3.5', isFetching && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link href="/inbox">
            <InboxIcon className="size-4" />
            Open Inbox
          </Link>
        </Button>
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link href="/analytics">
            <BarChart3Icon className="size-4" />
            Full Analytics
          </Link>
        </Button>
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link href="/knowledge">
            <BookOpenIcon className="size-4" />
            Manage Knowledge
          </Link>
        </Button>
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link href="/settings/channels">
            <Settings2Icon className="size-4" />
            Channel Settings
          </Link>
        </Button>
      </div>

      {errorMessage && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">
              Dashboard data unavailable
            </CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={refetchAll}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      <DashboardKpis overview={overview} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardRecentConversations
          conversations={recentConversations}
          isLoading={isLoading}
        />
        <DashboardActivityFeed items={activityFeed} isLoading={isLoading} />
      </div>

      <DashboardOnboardingCard onboarding={onboarding} isLoading={isLoading} />
    </div>
  )
}

'use client'

import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  MessageSquareIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { DashboardOverview } from '@/hooks/useDashboard'

interface DashboardKpisProps {
  overview: DashboardOverview
  isLoading: boolean
}

interface KpiItem {
  key: string
  label: string
  value: string
  helper: string
  trend?: number | null
  icon: ComponentType<{ className?: string }>
  tone: 'default' | 'success' | 'warning' | 'danger'
}

function trendLabel(value: number | null | undefined): string | null {
  if (value == null) return null
  if (value > 0) return `+${value}%`
  if (value < 0) return `${value}%`
  return '0%'
}

function TrendBadge({ value }: { value: number | null | undefined }) {
  const label = trendLabel(value)
  if (!label) return null
  const isDown = (value ?? 0) < 0
  const Icon = isDown ? TrendingDownIcon : TrendingUpIcon

  return (
    <Badge variant="outline" className={cn('h-5 gap-1 px-1.5 text-[9px]', isDown ? 'text-red-600' : 'text-emerald-600')}>
      <Icon className="size-2.5" />
      {label}
    </Badge>
  )
}

export function DashboardKpis({ overview, isLoading }: DashboardKpisProps) {
  const items: KpiItem[] = [
    {
      key: 'active',
      label: 'Active Workload',
      value: String(overview.queue.totalActive || overview.summary.openConversations),
      helper: `${overview.summary.unassignedConversations} unassigned, ${overview.summary.pendingConversations} waiting`,
      icon: MessageSquareIcon,
      tone: overview.summary.unassignedConversations > 0 ? 'warning' : 'default',
    },
    {
      key: 'resolution',
      label: 'Resolved This Period',
      value: String(overview.summary.resolvedInPeriod),
      helper: `${overview.summary.resolutionRate}% resolution rate`,
      trend: overview.trends.resolvedChangePct,
      icon: CheckCircleIcon,
      tone: 'success',
    },
    {
      key: 'contacts',
      label: 'Customer Growth',
      value: String(overview.summary.totalContacts),
      helper: `${overview.summary.newContactsInPeriod} new contacts this period`,
      trend: overview.trends.newContactsChangePct,
      icon: UsersIcon,
      tone: 'default',
    },
    {
      key: 'risk',
      label: 'SLA Risk',
      value: String(overview.summary.slaAtRiskConversations + overview.summary.slaBreachedConversations),
      helper: `${overview.summary.slaBreachedConversations} breached targets`,
      icon: AlertCircleIcon,
      tone: overview.summary.slaBreachedConversations > 0 ? 'danger' : overview.summary.slaAtRiskConversations > 0 ? 'warning' : 'success',
    },
    {
      key: 'ai',
      label: 'AI Assist Rate',
      value: `${overview.summary.aiHandledRate}%`,
      helper: `${overview.summary.aiMessagesInPeriod} AI vs ${overview.summary.agentMessagesInPeriod} agent replies`,
      trend: overview.trends.aiHandledRateChangePct,
      icon: ZapIcon,
      tone: 'default',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.key} className="overflow-hidden shadow-none">
          <CardContent className="relative p-3 pr-10">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    'absolute right-3 top-3 rounded-lg border p-1.5',
                    item.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30',
                    item.tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30',
                    item.tone === 'danger' && 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30',
                    item.tone === 'default' && 'bg-muted/40 text-muted-foreground'
                  )}
                >
                  <item.icon className="size-3.5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-[10px] font-semibold uppercase leading-3 tracking-[0.14em] text-muted-foreground">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">{item.value}</p>
                    <TrendBadge value={item.trend} />
                  </div>
                  <p className="truncate text-[11px] leading-4 text-muted-foreground">{item.helper}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

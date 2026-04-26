'use client'

import { Badge } from '@workspace/ui/components/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import {
  CheckCircleIcon,
  ClockIcon,
  MessageSquareIcon,
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
}

function trendLabel(value: number | null | undefined): string | null {
  if (value == null) return null
  if (value > 0) return `+${value}%`
  if (value < 0) return `${value}%`
  return '0%'
}

export function DashboardKpis({ overview, isLoading }: DashboardKpisProps) {
  const items: KpiItem[] = [
    {
      key: 'open',
      label: 'Open Conversations',
      value: String(overview.summary.openConversations),
      helper: `${overview.summary.pendingConversations} pending now`,
      icon: MessageSquareIcon,
    },
    {
      key: 'contacts',
      label: 'Total Contacts',
      value: String(overview.summary.totalContacts),
      helper: `${overview.summary.newContactsInPeriod} new this period`,
      trend: overview.trends.newContactsChangePct,
      icon: UsersIcon,
    },
    {
      key: 'resolved',
      label: 'Resolved',
      value: String(overview.summary.resolvedInPeriod),
      helper: `${overview.summary.resolutionRate}% resolution rate`,
      trend: overview.trends.resolvedChangePct,
      icon: CheckCircleIcon,
    },
    {
      key: 'ai',
      label: 'AI Handled',
      value: `${overview.summary.aiHandledRate}%`,
      helper: `${overview.summary.aiMessagesInPeriod} AI vs ${overview.summary.agentMessagesInPeriod} agent`,
      trend: overview.trends.aiHandledRateChangePct,
      icon: ZapIcon,
    },
    {
      key: 'pending',
      label: 'Pending Queue',
      value: String(overview.summary.pendingConversations),
      helper: 'Waiting for agent action',
      icon: ClockIcon,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const trend = trendLabel(item.trend)

        return (
          <Card key={item.key}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </CardTitle>
                <item.icon className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-28" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-semibold tracking-tight tabular-nums">
                      {item.value}
                    </p>
                    {trend && (
                      <Badge variant="outline" className="text-[10px]">
                        <TrendingUpIcon className="mr-1 size-3" />
                        {trend}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.helper}</p>
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

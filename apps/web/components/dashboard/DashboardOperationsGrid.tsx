'use client'

import Link from 'next/link'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Progress } from '@workspace/ui/components/progress'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  HeadphonesIcon,
  MailIcon,
  MessageSquareIcon,
  PhoneCallIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react'
import type { DashboardOnboarding, DashboardOverview } from '@/hooks/useDashboard'

interface DashboardOperationsGridProps {
  overview: DashboardOverview
  onboarding: DashboardOnboarding
  isLoading: boolean
}

function safePercent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

function MiniBar({ value, tone = 'default' }: { value: number; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          tone === 'success' && 'bg-emerald-500',
          tone === 'warning' && 'bg-amber-500',
          tone === 'danger' && 'bg-red-500',
          tone === 'default' && 'bg-primary'
        )}
        style={{ width: `${Math.max(3, Math.min(100, value))}%` }}
      />
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

export function DashboardOperationsGrid({ overview, onboarding, isLoading }: DashboardOperationsGridProps) {
  const queueTotal = Math.max(overview.queue.totalActive, 1)
  const channelTotal = Math.max(
    overview.channels.chat + overview.channels.email + overview.channels.whatsapp + overview.channels.voice,
    1
  )
  const slaRiskTotal = overview.queue.slaAtRisk + overview.queue.slaBreached

  const queueItems = [
    { label: 'AI handling', value: overview.queue.bot, tone: 'default' as const },
    { label: 'Waiting', value: overview.queue.pending, tone: 'warning' as const },
    { label: 'In progress', value: overview.queue.open, tone: 'success' as const },
  ]

  const channelItems = [
    { label: 'Chat', value: overview.channels.chat, icon: MessageSquareIcon, connected: true },
    { label: 'Email', value: overview.channels.email, icon: MailIcon, connected: onboarding.channels.emailConnected },
    { label: 'WhatsApp', value: overview.channels.whatsapp, icon: HeadphonesIcon, connected: onboarding.channels.whatsappConnected },
    { label: 'Voice', value: overview.channels.voice, icon: PhoneCallIcon, connected: overview.summary.callsInPeriod > 0 || overview.summary.activeCalls > 0 },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
      <Card className="shadow-none xl:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Queue Health</CardTitle>
              <CardDescription className="text-xs">Live support load, routing, and ownership.</CardDescription>
            </div>
            <Badge variant={overview.queue.unassigned > 0 ? 'outline' : 'secondary'} className="text-[10px]">
              {overview.queue.unassigned} unassigned
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SectionSkeleton />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Active</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{overview.queue.totalActive}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Assigned</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{overview.queue.assigned}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Waiting</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{overview.queue.pending}</p>
                </div>
              </div>

              <div className="space-y-3">
                {queueItems.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">{item.value}</span>
                    </div>
                    <MiniBar value={safePercent(item.value, queueTotal)} tone={item.tone} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangleIcon className="size-4 text-amber-500" />
            SLA Watch
          </CardTitle>
          <CardDescription className="text-xs">Threads approaching or missing response targets.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SectionSkeleton />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">At risk</span>
                  <span className="text-2xl font-semibold tabular-nums">{overview.queue.slaAtRisk}</span>
                </div>
                <MiniBar value={safePercent(overview.queue.slaAtRisk, Math.max(slaRiskTotal, 1))} tone="warning" />
              </div>
              <div className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Breached</span>
                  <span className="text-2xl font-semibold tabular-nums">{overview.queue.slaBreached}</span>
                </div>
                <MiniBar value={safePercent(overview.queue.slaBreached, Math.max(slaRiskTotal, 1))} tone="danger" />
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Resolution rate</span>
                <strong>{overview.summary.resolutionRate}%</strong>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RouteIcon className="size-4 text-primary" />
            Channel Mix
          </CardTitle>
          <CardDescription className="text-xs">Where active support work is coming from.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SectionSkeleton />
          ) : (
            <div className="space-y-3">
              {channelItems.map(({ label, value, icon: Icon, connected }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className="size-3.5 text-muted-foreground" />
                      {label}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {value}
                      <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-muted-foreground/35')} />
                    </span>
                  </div>
                  <MiniBar value={safePercent(value, channelTotal)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none xl:col-span-4">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">AI, Knowledge, and Automation Readiness</CardTitle>
              <CardDescription className="text-xs">Operational quality signals before customers feel friction.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/ai-actions">Review Actions</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><BotIcon className="size-4 text-primary" /> AI handled</div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{overview.summary.aiHandledRate}%</p>
                <Progress value={overview.summary.aiHandledRate} className="mt-3 h-1.5" />
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><SparklesIcon className="size-4 text-primary" /> Active actions</div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{overview.summary.activeAiActions}</p>
                <p className="mt-1 text-xs text-muted-foreground">{overview.summary.aiActionExecutionsInPeriod} executions this period</p>
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheckIcon className="size-4 text-emerald-500" /> Action success</div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{overview.summary.aiActionSuccessRate}%</p>
                <Progress value={overview.summary.aiActionSuccessRate} className="mt-3 h-1.5" />
              </div>
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><CheckCircle2Icon className="size-4 text-emerald-500" /> Knowledge bases</div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{overview.summary.knowledgeBaseCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">{onboarding.completionPercent}% setup complete</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

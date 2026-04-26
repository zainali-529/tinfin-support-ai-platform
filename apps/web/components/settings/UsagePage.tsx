'use client'

/**
 * apps/web/components/settings/UsagePage.tsx
 *
 * Live usage dashboard showing:
 *   - Current plan + period
 *   - Progress bars for each metric
 *   - Refresh button for live updates
 *   - CTA to upgrade when approaching limits
 */

import { trpc } from '@/lib/trpc'
import { usePlan } from '@/hooks/usePlan'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Separator } from '@workspace/ui/components/separator'
import { PlanBadge, PlanLimitAlert, UsageBar } from '../billing/PlanGuard'
import { cn } from '@workspace/ui/lib/utils'
import {
  MessageSquareIcon, PhoneCallIcon, UsersIcon, BookOpenIcon,
  DatabaseIcon, BuildingIcon, RefreshCwIcon, ZapIcon, CalendarIcon,
  ArrowRightIcon,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

function UsageSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function UsagePage() {
  const { planId, planName, periodStart, currentPeriodEnd, isLoading, usage, limits, canUse } = usePlan()
  const utils = trpc.useUtils()

  function handleRefresh() {
    void utils.usage.getUsage.invalidate()
  }

  const periodLabel = currentPeriodEnd
    ? `${periodStart ? format(new Date(periodStart), 'MMM d') : ''} – ${format(new Date(currentPeriodEnd), 'MMM d, yyyy')}`
    : periodStart
    ? `${format(new Date(periodStart), 'MMMM yyyy')}`
    : 'Current month'

  const isFreePlan = planId === 'free'

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ZapIcon className="size-6 text-primary" />
            Usage
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your resource consumption for the current billing period.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleRefresh} className="gap-1.5 shrink-0">
          <RefreshCwIcon className="size-3.5" />
          Refresh
        </Button>
      </div>

      {/* Period + Plan banner */}
      <div className="flex items-center gap-3 rounded-xl border bg-muted/20 px-5 py-4">
        <CalendarIcon className="size-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Billing period</p>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <PlanBadge planId={planId} />
          {currentPeriodEnd && (
            <span className="text-xs text-muted-foreground">
              Renews {formatDistanceToNow(new Date(currentPeriodEnd), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Usage metrics — 2 cols */}
        <div className="xl:col-span-2 space-y-4">

          {/* Conversations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conversations</CardTitle>
              <CardDescription className="text-xs">
                Total chat and email conversations started this billing period.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <div className="space-y-3">
                  <UsageBar
                    label="Conversations this period"
                    current={usage?.conversations ?? 0}
                    limit={limits?.conversations ?? 50}
                    icon={<MessageSquareIcon className="size-4" />}
                  />
                  <PlanLimitAlert
                    feature="Conversations"
                    current={usage?.conversations ?? 0}
                    limit={limits?.conversations ?? 50}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Voice */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Voice Minutes</CardTitle>
              <CardDescription className="text-xs">
                Total voice call duration this billing period.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                limits?.voiceMinutes === 0 ? (
                  <div className="flex items-center justify-between gap-4 py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <PhoneCallIcon className="size-4" />
                      <span>Voice calls</span>
                    </div>
                    <Badge variant="outline" className="text-xs">Not available on {planName} plan</Badge>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <UsageBar
                      label="Voice minutes this period"
                      current={usage?.voiceMinutes ?? 0}
                      limit={limits?.voiceMinutes ?? 0}
                      unit="min"
                      icon={<PhoneCallIcon className="size-4" />}
                    />
                    <PlanLimitAlert
                      feature="Voice Minutes"
                      current={usage?.voiceMinutes ?? 0}
                      limit={limits?.voiceMinutes ?? 0}
                      unit="min"
                    />
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Team + KB */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resources</CardTitle>
              <CardDescription className="text-xs">
                Team members and knowledge base usage.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-5">
              {isLoading ? <UsageSkeleton /> : (
                <>
                  <UsageBar
                    label="Team members"
                    current={usage?.teamMembers ?? 0}
                    limit={limits?.teamMembers ?? 1}
                    icon={<UsersIcon className="size-4" />}
                  />
                  <PlanLimitAlert
                    feature="Team Members"
                    current={usage?.teamMembers ?? 0}
                    limit={limits?.teamMembers ?? 1}
                  />
                  <UsageBar
                    label="Knowledge bases"
                    current={usage?.knowledgeBases ?? 0}
                    limit={limits?.knowledgeBases ?? 1}
                    icon={<BookOpenIcon className="size-4" />}
                  />
                  <PlanLimitAlert
                    feature="Knowledge Bases"
                    current={usage?.knowledgeBases ?? 0}
                    limit={limits?.knowledgeBases ?? 1}
                  />
                  <UsageBar
                    label="KB chunks (indexed pages)"
                    current={usage?.kbChunks ?? 0}
                    limit={limits?.kbChunks ?? 100}
                    icon={<DatabaseIcon className="size-4" />}
                  />
                  <PlanLimitAlert
                    feature="KB Chunks"
                    current={usage?.kbChunks ?? 0}
                    limit={limits?.kbChunks ?? 100}
                  />
                  <UsageBar
                    label="Organizations"
                    current={usage?.organizations ?? 0}
                    limit={limits?.organizations ?? 1}
                    icon={<BuildingIcon className="size-4" />}
                  />
                  <PlanLimitAlert
                    feature="Organizations"
                    current={usage?.organizations ?? 0}
                    limit={limits?.organizations ?? 1}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Plan summary */}
          <Card className={cn(
            'border',
            planId === 'scale' ? 'border-violet-200 dark:border-violet-800' :
            planId === 'pro' ? 'border-primary/20' : ''
          )}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Your Plan
                <PlanBadge planId={planId} />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              {[
                { label: 'Chats/month', value: limits?.conversations === -1 ? 'Unlimited' : limits?.conversations?.toLocaleString() ?? '50' },
                { label: 'Voice min/month', value: limits?.voiceMinutes === 0 ? 'None' : `${limits?.voiceMinutes ?? 0}` },
                { label: 'Email channel', value: canUse('emailChannel') ? 'Included' : 'Preview only' },
                { label: 'WhatsApp channel', value: canUse('whatsappChannel') ? 'Included' : 'Preview only' },
                { label: 'Team members', value: `${limits?.teamMembers ?? 1}` },
                { label: 'Knowledge bases', value: `${limits?.knowledgeBases ?? 1}` },
                { label: 'KB chunks', value: limits?.kbChunks?.toLocaleString() ?? '100' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
              {isFreePlan && (
                <Button size="sm" className="w-full mt-3 gap-1.5" asChild>
                  <Link href="/billing">
                    Upgrade Plan <ArrowRightIcon className="size-3" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Upgrade prompt for free/pro users */}
          {isFreePlan && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-semibold">Unlock more with Pro</p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  {['Email channel', 'WhatsApp channel', '5 team members', '1,000 chats/month', '100 voice minutes', 'Widget customization', 'Analytics'].map(f => (
                    <li key={f} className="flex items-center gap-1.5">
                      <span className="size-4 flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px]">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button size="sm" className="w-full gap-1.5" asChild>
                  <Link href="/billing">Upgrade to Pro — $29/mo</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {planId === 'pro' && (
            <Card className="border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">Scale for more</p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  {['20 team members', 'Unlimited chats', '500 voice minutes', '3 organizations', 'Priority support'].map(f => (
                    <li key={f} className="flex items-center gap-1.5">
                      <span className="size-4 flex items-center justify-center rounded-full bg-violet-100 text-violet-600 text-[10px]">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button size="sm" className="w-full bg-violet-600 hover:bg-violet-700 text-white border-0 gap-1.5" asChild>
                  <Link href="/billing">Upgrade to Scale — $79/mo</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

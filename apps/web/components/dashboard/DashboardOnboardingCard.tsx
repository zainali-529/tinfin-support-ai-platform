'use client'

import Link from 'next/link'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Progress } from '@workspace/ui/components/progress'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { cn } from '@workspace/ui/lib/utils'
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ClipboardCheckIcon,
  ExternalLinkIcon,
  LockIcon,
  RefreshCwIcon,
  RocketIcon,
} from 'lucide-react'
import type { DashboardOnboarding, DashboardOnboardingStep } from '@/hooks/useDashboard'

interface DashboardOnboardingCardProps {
  onboarding: DashboardOnboarding
  isLoading: boolean
  isVerifying?: boolean
  onVerify?: () => void
}

const STATUS_META: Record<DashboardOnboardingStep['status'], {
  label: string
  icon: typeof CheckCircle2Icon
  className: string
}> = {
  complete: {
    label: 'Done',
    icon: CheckCircle2Icon,
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  ready: {
    label: 'Ready',
    icon: RocketIcon,
    className: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  todo: {
    label: 'To do',
    icon: CircleDashedIcon,
    className: 'border-border bg-muted/30 text-muted-foreground',
  },
  locked: {
    label: 'Locked',
    icon: LockIcon,
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
}

function statusMeta(step: DashboardOnboardingStep) {
  return STATUS_META[step.status] ?? STATUS_META.todo
}

function StepStatusBadge({ step }: { step: DashboardOnboardingStep }) {
  const meta = statusMeta(step)
  const Icon = meta.icon

  return (
    <Badge variant="outline" className={cn('h-6 gap-1.5 px-2.5 text-[11px]', meta.className)}>
      <Icon className="size-3.5" />
      {meta.label}
    </Badge>
  )
}

function SkeletonChecklist() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y rounded-xl border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 p-4">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardOnboardingCard({
  onboarding,
  isLoading,
  isVerifying = false,
  onVerify,
}: DashboardOnboardingCardProps) {
  const nextStep = onboarding.nextStep
  const availableCount = onboarding.steps.filter((step) => !step.locked).length
  const lockedCount = onboarding.steps.filter((step) => step.locked).length

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b bg-muted/10 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <ClipboardCheckIcon className="size-3.5" />
              Launch readiness
            </div>
            <CardTitle className="text-xl tracking-tight">Product onboarding checklist</CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
              Follow the setup path, verify each signal, and keep docs one click away while preparing this workspace for launch.
            </CardDescription>
          </div>

          {!isLoading && nextStep ? (
            <div className="min-w-[240px] rounded-xl border bg-background p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Next best action</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{nextStep.title}</p>
              <Button size="sm" className="mt-3 w-full justify-between" asChild>
                <Link href={nextStep.href}>
                  {nextStep.ctaLabel || 'Continue'}
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-5">
            <SkeletonChecklist />
          </div>
        ) : (
          <>
            <div className="grid gap-4 border-b p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {onboarding.completedSteps}/{onboarding.totalSteps} available launch steps complete
                  </span>
                  <span className="font-semibold tabular-nums">{onboarding.completionPercent}%</span>
                </div>
                <Progress value={onboarding.completionPercent} />
                <p className="text-xs text-muted-foreground">
                  {availableCount} available steps. {lockedCount} locked by plan or permission.
                </p>
              </div>

              <Button variant="outline" size="sm" onClick={onVerify} disabled={!onVerify || isVerifying} className="justify-self-start lg:justify-self-end">
                <RefreshCwIcon className={cn('size-3.5', isVerifying && 'animate-spin')} />
                Verify all
              </Button>
            </div>

            <div className="divide-y">
              {onboarding.steps.map((step, index) => (
                <div key={step.key} className="grid gap-4 px-5 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[36px_minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex size-9 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {step.category}
                      </span>
                      <StepStatusBadge step={step} />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                    <p className="text-xs leading-5 text-muted-foreground/90">{step.statusDetail}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button size="sm" variant={step.completed ? 'outline' : 'default'} asChild>
                      <Link href={step.href}>{step.ctaLabel || (step.completed ? 'Open' : 'Start')}</Link>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={step.docsHref}>
                        <BookOpenIcon className="size-3.5" />
                        Docs
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={onVerify} disabled={!onVerify || isVerifying}>
                      <RefreshCwIcon className={cn('size-3.5', isVerifying && 'animate-spin')} />
                      {step.verifyLabel || 'Verify'}
                    </Button>
                    {step.locked ? (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href="/billing">
                          Upgrade
                          <ExternalLinkIcon className="size-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

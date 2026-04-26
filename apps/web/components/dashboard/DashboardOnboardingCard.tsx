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
import { CheckCircleIcon, LockIcon } from 'lucide-react'
import type { DashboardOnboarding } from '@/hooks/useDashboard'

interface DashboardOnboardingCardProps {
  onboarding: DashboardOnboarding
  isLoading: boolean
}

export function DashboardOnboardingCard({
  onboarding,
  isLoading,
}: DashboardOnboardingCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Setup Progress</CardTitle>
        <CardDescription className="text-xs">
          Complete setup steps to unlock the full support workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {onboarding.completedSteps}/{onboarding.totalSteps} steps completed
                </span>
                <span className="font-semibold">
                  {onboarding.completionPercent}%
                </span>
              </div>
              <Progress value={onboarding.completionPercent} />
            </div>

            <div className="space-y-2">
              {onboarding.steps.map((step) => (
                <div
                  key={step.key}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {step.completed ? (
                      <Badge className="gap-1 text-[10px]">
                        <CheckCircleIcon className="size-3" />
                        Done
                      </Badge>
                    ) : step.locked ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <LockIcon className="size-3" />
                        Locked
                      </Badge>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={step.href}>Open</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {onboarding.nextStep && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">
                  Next best step
                </p>
                <p className="mt-1 text-sm font-medium">{onboarding.nextStep.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {onboarding.nextStep.description}
                </p>
                <Button size="sm" className="mt-3" asChild>
                  <Link href={onboarding.nextStep.href}>Continue</Link>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

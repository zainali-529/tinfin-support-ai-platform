'use client'

/**
 * apps/web/components/billing/PlanGuard.tsx
 *
 * Reusable components for subscription gating throughout the UI.
 *
 * Components:
 *   PlanBadge       — small pill showing current plan (Free / Pro / Scale)
 *   UpgradePrompt   — full card shown when a feature isn't available
 *   UsageBar        — progress bar for a single limit metric
 *   PlanLimitAlert  — inline alert when approaching/hitting a limit
 */

import Link from 'next/link'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Progress } from '@workspace/ui/components/progress'
import { cn } from '@workspace/ui/lib/utils'
import { ZapIcon, LockIcon, ArrowRightIcon, AlertTriangleIcon } from 'lucide-react'
import type { FeatureKey, LimitKey } from '@/hooks/usePlan'

// ─── PlanBadge ────────────────────────────────────────────────────────────────

export function PlanBadge({ planId, size = 'sm' }: { planId: string; size?: 'xs' | 'sm' }) {
  const colors: Record<string, string> = {
    free:  'bg-muted text-muted-foreground',
    pro:   'bg-primary/10 text-primary border-primary/20',
    scale: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200',
  }
  const sizeClass = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'

  return (
    <span className={cn(
      'inline-flex items-center font-bold uppercase tracking-wide rounded-full border',
      colors[planId] ?? colors.free,
      sizeClass
    )}>
      {planId === 'scale' && '✦ '}
      {planId.charAt(0).toUpperCase() + planId.slice(1)}
    </span>
  )
}

// ─── UpgradePrompt ────────────────────────────────────────────────────────────

interface UpgradePromptProps {
  feature: string
  requiredPlan?: 'pro' | 'scale'
  description?: string
  compact?: boolean
}

export function UpgradePrompt({
  feature,
  requiredPlan = 'pro',
  description,
  compact = false,
}: UpgradePromptProps) {
  const planColors = {
    pro:   'border-primary/20 bg-primary/5',
    scale: 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20',
  }

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        planColors[requiredPlan]
      )}>
        <LockIcon className={cn('size-4 shrink-0', requiredPlan === 'scale' ? 'text-violet-600' : 'text-primary')} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {feature} requires{' '}
            <span className="capitalize font-bold">{requiredPlan}</span>
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 gap-1" asChild>
          <Link href="/billing">
            Upgrade <ArrowRightIcon className="size-3" />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={cn(
      'flex flex-col items-center gap-4 rounded-2xl border p-8 text-center',
      planColors[requiredPlan]
    )}>
      <div className={cn(
        'flex size-14 items-center justify-center rounded-2xl',
        requiredPlan === 'scale' ? 'bg-violet-100 dark:bg-violet-900/30' : 'bg-primary/10'
      )}>
        <ZapIcon className={cn('size-7', requiredPlan === 'scale' ? 'text-violet-600' : 'text-primary')} />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h3 className="text-base font-bold">{feature}</h3>
        <p className="text-sm text-muted-foreground">
          {description ?? `This feature is available on the ${requiredPlan === 'scale' ? 'Scale' : 'Pro'} plan and above.`}
        </p>
      </div>
      <Button asChild className={cn('gap-2', requiredPlan === 'scale' ? 'bg-violet-600 hover:bg-violet-700 text-white border-0' : '')}>
        <Link href="/billing">
          Upgrade to {requiredPlan === 'scale' ? 'Scale' : 'Pro'}
          <ArrowRightIcon className="size-4" />
        </Link>
      </Button>
    </div>
  )
}

// ─── UsageBar ─────────────────────────────────────────────────────────────────

interface UsageBarProps {
  label: string
  current: number
  limit: number      // -1 = unlimited
  unit?: string
  icon?: React.ReactNode
}

export function UsageBar({ label, current, limit, unit = '', icon }: UsageBarProps) {
  const isUnlimited = limit === -1
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100))
  const isWarning = !isUnlimited && pct >= 80
  const isDanger  = !isUnlimited && pct >= 100

  const barColor = isDanger
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-primary'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={cn(
          'text-sm font-semibold tabular-nums',
          isDanger ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-foreground'
        )}>
          {current.toLocaleString()}
          {isUnlimited ? ' / ∞' : ` / ${limit.toLocaleString()}`}
          {unit && <span className="text-muted-foreground font-normal text-xs ml-1">{unit}</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="h-1.5 w-full rounded-full bg-muted/50" />
      )}
    </div>
  )
}

// ─── PlanLimitAlert ───────────────────────────────────────────────────────────

interface PlanLimitAlertProps {
  feature: string
  current: number
  limit: number
  unit?: string
}

export function PlanLimitAlert({ feature, current, limit, unit }: PlanLimitAlertProps) {
  if (limit === -1) return null

  const pct = Math.round((current / limit) * 100)
  if (pct < 80) return null

  const isAtLimit = pct >= 100

  return (
    <Alert className={cn(
      isAtLimit
        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
        : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
    )}>
      <AlertTriangleIcon className={cn('size-4', isAtLimit ? 'text-red-600' : 'text-amber-600')} />
      <AlertDescription className={cn(
        'text-xs flex items-center justify-between gap-4',
        isAtLimit ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'
      )}>
        <span>
          {isAtLimit
            ? `${feature} limit reached (${current}/${limit}${unit ? ' ' + unit : ''}).`
            : `${feature} at ${pct}% of your plan limit (${current}/${limit}${unit ? ' ' + unit : ''}).`
          }
          {' '}
        </span>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] shrink-0" asChild>
          <Link href="/billing">Upgrade</Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
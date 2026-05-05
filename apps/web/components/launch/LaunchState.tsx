'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangleIcon, BookOpenIcon, InboxIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { cn } from '@workspace/ui/lib/utils'
import { normalizeLaunchError, type LaunchErrorInfo } from '@/lib/launch-errors'

type LaunchStateTone = 'default' | 'warning' | 'danger'

function toneClasses(tone: LaunchStateTone) {
  if (tone === 'danger') {
    return {
      card: 'border-destructive/30 bg-destructive/5',
      icon: 'bg-destructive/10 text-destructive',
      title: 'text-destructive',
    }
  }
  if (tone === 'warning') {
    return {
      card: 'border-amber-500/30 bg-amber-500/10',
      icon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      title: 'text-amber-800 dark:text-amber-200',
    }
  }
  return {
    card: 'border-border bg-card',
    icon: 'bg-muted text-muted-foreground',
    title: 'text-foreground',
  }
}

export function LaunchState({
  title,
  description,
  icon,
  tone = 'default',
  action,
  onRetry,
  retryLabel = 'Retry',
  docsHref,
  docsLabel = 'Open docs',
  className,
}: {
  title: string
  description: string
  icon?: ReactNode
  tone?: LaunchStateTone
  action?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  docsHref?: string
  docsLabel?: string
  className?: string
}) {
  const classes = toneClasses(tone)

  return (
    <Card className={cn('shadow-none', classes.card, className)}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', classes.icon)}>
            {icon ?? <InboxIcon className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className={cn('text-sm font-semibold', classes.title)}>{title}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
          {docsHref && (
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link href={docsHref}>
                <BookOpenIcon className="size-3.5" />
                {docsLabel}
              </Link>
            </Button>
          )}
          {onRetry && (
            <Button size="sm" onClick={onRetry} className="gap-1.5">
              <RefreshCwIcon className="size-3.5" />
              {retryLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function LaunchErrorState({
  error,
  title,
  description,
  docsHref,
  onRetry,
  retryLabel,
  className,
}: {
  error?: unknown
  title?: string
  description?: string
  docsHref?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  const info: LaunchErrorInfo = normalizeLaunchError(error, description)

  return (
    <LaunchState
      title={title ?? info.title}
      description={description ?? info.message}
      docsHref={docsHref ?? info.docsHref}
      onRetry={onRetry}
      retryLabel={retryLabel}
      tone={info.kind === 'unknown' ? 'warning' : 'danger'}
      icon={<AlertTriangleIcon className="size-4" />}
      className={className}
    />
  )
}

export function LaunchInlineError({
  error,
  onRetry,
  docsHref,
  className,
}: {
  error: unknown
  onRetry?: () => void
  docsHref?: string
  className?: string
}) {
  const info = normalizeLaunchError(error)

  return (
    <div className={cn('rounded-xl border border-destructive/30 bg-destructive/5 p-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-destructive">{info.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{info.message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(docsHref ?? info.docsHref) && (
            <Button size="sm" variant="outline" asChild className="h-7 px-2 text-xs">
              <Link href={docsHref ?? info.docsHref!}>Docs</Link>
            </Button>
          )}
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="h-7 px-2 text-xs">
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function LaunchLoadingState({
  title = 'Loading',
  description = 'Fetching the latest workspace data...',
  className,
}: {
  title?: string
  description?: string
  className?: string
}) {
  return (
    <LaunchState
      title={title}
      description={description}
      icon={<Loader2Icon className="size-4 animate-spin" />}
      className={className}
    />
  )
}

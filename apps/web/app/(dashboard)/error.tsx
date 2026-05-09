'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangleIcon, GaugeIcon, RefreshCwIcon } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        surface: 'dashboard_route_error',
      },
      extra: {
        digest: error.digest,
      },
    })
  }, [error])

  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[2rem] border bg-card p-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-background">
          <AlertTriangleIcon className="size-6 text-amber-500" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Workspace issue
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          This dashboard view could not load.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The error has been captured with your workspace context. Retry the view, or return to the dashboard overview.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button className="rounded-full" onClick={reset}>
            <RefreshCwIcon className="mr-2 size-4" />
            Retry
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/dashboard">
              <GaugeIcon className="mr-2 size-4" />
              Dashboard
            </Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="mt-5 rounded-full border bg-background px-3 py-1 font-mono text-xs text-muted-foreground">
            Error reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  )
}

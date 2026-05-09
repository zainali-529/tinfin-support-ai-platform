'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangleIcon, HomeIcon, RefreshCwIcon } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Header } from '@/components/marketing/header'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        surface: 'marketing_route_error',
      },
      extra: {
        digest: error.digest,
      },
    })
  }, [error])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />
        <div className="relative mx-auto flex min-h-[68vh] max-w-4xl flex-col items-center justify-center px-6 py-28 text-center">
          <div className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl border bg-card">
            <AlertTriangleIcon className="size-6 text-amber-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Temporary issue
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            The page could not load cleanly.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            We captured this issue for review. Try refreshing once, or return home if the page keeps failing.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="rounded-full" onClick={reset}>
              <RefreshCwIcon className="mr-2 size-4" />
              Try again
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/">
                <HomeIcon className="mr-2 size-4" />
                Go home
              </Link>
            </Button>
          </div>
          {error.digest ? (
            <p className="mt-6 rounded-full border bg-background px-3 py-1 font-mono text-xs text-muted-foreground">
              Error reference: {error.digest}
            </p>
          ) : null}
        </div>
      </section>
      <MarketingFooter />
    </main>
  )
}

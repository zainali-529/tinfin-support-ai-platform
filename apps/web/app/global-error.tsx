"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

import { Button } from "@workspace/ui/components/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { surface: "next_global_error" },
      extra: { digest: error.digest },
    })
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
          <div className="max-w-md rounded-[2rem] border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Unexpected error</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Something broke.</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              We captured the error for review. Try again once, and contact support if it keeps happening.
            </p>
            <Button className="mt-6 rounded-full px-6" onClick={reset}>
              Try again
            </Button>
          </div>
        </main>
      </body>
    </html>
  )
}

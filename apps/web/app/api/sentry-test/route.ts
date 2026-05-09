import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const configuredToken = process.env.SENTRY_TEST_TOKEN?.trim()
  if (!configuredToken) {
    return NextResponse.json(
      { ok: false, message: 'Sentry smoke test endpoint is disabled.' },
      { status: 404 }
    )
  }

  const providedToken = request.headers.get('x-sentry-test-token')?.trim()
  if (providedToken !== configuredToken) {
    return NextResponse.json(
      { ok: false, message: 'Invalid Sentry smoke test token.' },
      { status: 403 }
    )
  }

  const runId = crypto.randomUUID()
  const dsnSource = process.env.WEB_SENTRY_DSN
    ? 'WEB_SENTRY_DSN'
    : process.env.NEXT_PUBLIC_SENTRY_DSN
      ? 'NEXT_PUBLIC_SENTRY_DSN'
      : process.env.SENTRY_DSN
        ? 'SENTRY_DSN'
        : null
  const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development'
  const release = process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_APP_VERSION ?? null

  const eventId = Sentry.captureException(new Error(`Tinfiz web Sentry smoke test ${runId}`), {
    tags: {
      surface: 'next_route',
      smoke_test: 'true',
      smoke_run_id: runId,
      dsn_source: dsnSource ?? 'missing',
    },
    extra: {
      runId,
      dsnConfigured: Boolean(dsnSource),
      environment,
      release,
    },
    fingerprint: ['tinfiz-web-smoke-test', runId],
  })

  const flushed = await Sentry.flush(5000)

  return NextResponse.json({
    ok: true,
    eventId,
    runId,
    flushed,
    sentryEnabled: Sentry.isEnabled(),
    dsnConfigured: Boolean(dsnSource),
    dsnSource,
    environment,
    release,
  })
}

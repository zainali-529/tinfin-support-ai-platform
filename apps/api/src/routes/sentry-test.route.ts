import { Router } from 'express'
import * as Sentry from '@sentry/node'
import crypto from 'crypto'

export const sentryTestRoute: Router = Router()

sentryTestRoute.post('/', async (req, res) => {
  const configuredToken = process.env.SENTRY_TEST_TOKEN?.trim()
  if (!configuredToken) {
    return res.status(404).json({
      ok: false,
      message: 'Sentry smoke test endpoint is disabled.',
    })
  }

  const providedToken = req.header('x-sentry-test-token')?.trim()
  if (providedToken !== configuredToken) {
    return res.status(403).json({
      ok: false,
      message: 'Invalid Sentry smoke test token.',
    })
  }

  const runId = crypto.randomUUID()
  const dsnSource = process.env.API_SENTRY_DSN
    ? 'API_SENTRY_DSN'
    : process.env.SENTRY_DSN
      ? 'SENTRY_DSN'
      : null
  const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development'
  const release = process.env.SENTRY_RELEASE ?? process.env.API_VERSION ?? null

  const eventId = Sentry.captureException(new Error(`Tinfiz API Sentry smoke test ${runId}`), {
    tags: {
      surface: 'api_route',
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
    fingerprint: ['tinfiz-api-smoke-test', runId],
  })

  const flushed = await Sentry.flush(5000)

  return res.json({
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
})

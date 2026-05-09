import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import type { ErrorEvent } from '@sentry/node'

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|password|secret|token|api[-_]?key|service[-_]?key|access[-_]?token|refresh[-_]?token/i

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[Filtered]' : redactValue(nestedValue),
    ])
  )
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.headers = redactValue(event.request.headers) as typeof event.request.headers
    event.request.cookies = redactValue(event.request.cookies) as typeof event.request.cookies
    event.request.data = redactValue(event.request.data) as typeof event.request.data
    event.request.query_string = redactValue(
      event.request.query_string
    ) as typeof event.request.query_string
  }

  event.extra = redactValue(event.extra) as typeof event.extra
  event.contexts = redactValue(event.contexts) as typeof event.contexts

  return event
}

const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development'
const dsn = process.env.API_SENTRY_DSN ?? process.env.SENTRY_DSN

Sentry.init({
  dsn,
  enabled: process.env.SENTRY_ENABLED !== 'false' && Boolean(dsn),
  environment,
  release: process.env.SENTRY_RELEASE ?? process.env.API_VERSION,
  sendDefaultPii: false,
  attachStacktrace: true,
  tracesSampleRate: parseSampleRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
    environment === 'production' ? 0.1 : 1
  ),
  profilesSampleRate: parseSampleRate(process.env.SENTRY_PROFILES_SAMPLE_RATE, 0),
  integrations: [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
    Sentry.postgresJsIntegration(),
    Sentry.redisIntegration(),
    Sentry.openAIIntegration(),
    nodeProfilingIntegration(),
  ],
  beforeSend: scrubEvent,
})

export { Sentry }

import * as Sentry from "@sentry/nextjs"

import { parseSentrySampleRate, scrubSentryEvent } from "./sentry.shared"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development"
const release = process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.SENTRY_RELEASE
const traceTargets = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_API_URL,
].filter(Boolean) as string[]

Sentry.init({
  dsn,
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false" && Boolean(dsn),
  environment,
  release,
  sendDefaultPii: false,
  attachStacktrace: true,
  tracesSampleRate: parseSentrySampleRate(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    environment === "production" ? 0.05 : 1,
  ),
  tracePropagationTargets: traceTargets.length > 0 ? traceTargets : undefined,
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "AbortError",
  ],
  beforeSend: scrubSentryEvent,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

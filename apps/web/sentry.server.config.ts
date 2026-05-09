import * as Sentry from "@sentry/nextjs"

import { parseSentrySampleRate, scrubSentryEvent } from "./sentry.shared"

const dsn = process.env.WEB_SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN
const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development"
const release = process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_APP_VERSION

Sentry.init({
  dsn,
  enabled: process.env.SENTRY_ENABLED !== "false" && Boolean(dsn),
  environment,
  release,
  sendDefaultPii: false,
  attachStacktrace: true,
  tracesSampleRate: parseSentrySampleRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
    environment === "production" ? 0.1 : 1,
  ),
  profilesSampleRate: parseSentrySampleRate(process.env.SENTRY_PROFILES_SAMPLE_RATE, 0),
  beforeSend: scrubSentryEvent,
})

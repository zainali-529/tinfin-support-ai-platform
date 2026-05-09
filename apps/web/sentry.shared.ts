import type { ErrorEvent } from "@sentry/nextjs"

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|secret|token|api[-_]?key|service[-_]?key|access[-_]?token|refresh[-_]?token)/i

export function parseSentrySampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

function redactObject(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== "object") return value
  if (depth > 4) return "[Truncated]"

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactObject(item, depth + 1))
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[Filtered]" : redactObject(nestedValue, depth + 1),
    ]),
  )
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request?.headers) {
    event.request.headers = redactObject(event.request.headers) as Record<string, string>
  }

  if (event.request?.cookies) {
    event.request.cookies = "[Filtered]" as unknown as Record<string, string>
  }

  if (event.request?.data) {
    event.request.data = redactObject(event.request.data)
  }

  if (event.extra) {
    event.extra = redactObject(event.extra) as Record<string, unknown>
  }

  if (event.contexts) {
    event.contexts = redactObject(event.contexts) as ErrorEvent["contexts"]
  }

  return event
}

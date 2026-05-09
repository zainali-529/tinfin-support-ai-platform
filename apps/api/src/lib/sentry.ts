import crypto from 'crypto'
import type { Express, NextFunction, Request, Response } from 'express'
import * as Sentry from '@sentry/node'

type SentryActorContext = {
  userId?: string | null
  email?: string | null
  orgId?: string | null
  role?: string | null
  plan?: string | null
}

type CaptureContext = Record<string, unknown>

function cleanContext(context: CaptureContext): CaptureContext {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined && value !== null)
  )
}

export function sentryRequestMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId =
    typeof req.headers['x-request-id'] === 'string'
      ? req.headers['x-request-id']
      : crypto.randomUUID()

  res.setHeader('x-request-id', requestId)

  Sentry.setTag('request.id', requestId)
  Sentry.setContext('http_request', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
  })

  next()
}

export function setSentryActorContext(context: SentryActorContext) {
  if (context.userId || context.email) {
    Sentry.setUser({
      id: context.userId ?? undefined,
      email: context.email ?? undefined,
    })
  }

  if (context.orgId) Sentry.setTag('org.id', context.orgId)
  if (context.role) Sentry.setTag('org.role', context.role)
  if (context.plan) Sentry.setTag('org.plan', context.plan)

  if (context.orgId || context.role || context.plan) {
    Sentry.setContext('organization', cleanContext({
      id: context.orgId,
      role: context.role,
      plan: context.plan,
    }))
  }
}

export function captureApiException(error: unknown, context: CaptureContext = {}) {
  Sentry.withScope((scope) => {
    scope.setTag('surface', String(context.surface ?? 'api'))
    scope.setContext('api', cleanContext(context))
    Sentry.captureException(error)
  })
}

export function captureWebSocketException(error: unknown, context: CaptureContext = {}) {
  Sentry.withScope((scope) => {
    scope.setTag('surface', 'websocket')
    if (typeof context.orgId === 'string') scope.setTag('org.id', context.orgId)
    if (typeof context.conversationId === 'string') {
      scope.setTag('conversation.id', context.conversationId)
    }
    scope.setContext('websocket', cleanContext(context))
    Sentry.captureException(error)
  })
}

export function setupSentryErrorHandler(app: Express) {
  Sentry.setupExpressErrorHandler(app)
}

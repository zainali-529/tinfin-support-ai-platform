# Sentry Monitoring Setup Guide

This guide explains how Tinfiz captures production errors across the web app, API, and WebSocket server.

## What Was Added

- Web error tracking with `@sentry/nextjs`.
- API error tracking with `@sentry/node`.
- WebSocket exception capture for visitor messages, AI/RAG failures, action approvals, socket parsing, and connection setup failures.
- User and organization context in Sentry.
- Release version support for web and API.
- Source map upload support for Next.js and the API build.
- Smoke test endpoints for safe verification.
- Event scrubbing so secrets, cookies, tokens, and API keys are filtered before events leave the app.

## Recommended Sentry Projects

Create two Sentry projects:

- `tinfiz-web` for the Next.js dashboard and marketing app.
- `tinfiz-api` for the Express API and WebSocket server.

You can use one Sentry organization for both projects.

## Environment Variables

Add these values in production and staging.

```env
# Shared
SENTRY_ENABLED=true
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=tinfiz@2026.05.09-1
SENTRY_TEST_TOKEN=use-a-long-random-token

# Web browser + Next server
NEXT_PUBLIC_SENTRY_DSN=https://public-key@o000000.ingest.sentry.io/000000
WEB_SENTRY_DSN=https://web-server-key@o000000.ingest.sentry.io/000000
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_APP_VERSION=tinfiz@2026.05.09-1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05

# API
API_SENTRY_DSN=https://api-key@o000000.ingest.sentry.io/000000
API_VERSION=tinfiz-api@2026.05.09-1
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0

# Source maps
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxx
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=tinfiz-web-or-tinfiz-api
SENTRY_UPLOAD_SOURCE_MAPS=true
SENTRY_DEBUG_BUILD=false
SENTRY_TUNNEL_ROUTE=/monitoring
```

### Local Development

For local development, Sentry is optional.

```env
SENTRY_ENABLED=false
NEXT_PUBLIC_SENTRY_ENABLED=false
```

If you want to test locally, set both to `true` and use a local/test Sentry project.

## Where The Code Lives

### Web

- `apps/web/sentry.server.config.ts` initializes Sentry for Next.js server runtime.
- `apps/web/sentry.edge.config.ts` initializes Sentry for Edge runtime.
- `apps/web/instrumentation-client.ts` initializes browser-side Sentry.
- `apps/web/instrumentation.ts` registers server/edge instrumentation and captures Next request errors.
- `apps/web/app/global-error.tsx` captures React global render errors.
- `apps/web/components/monitoring/SentryDashboardContext.tsx` sets user and active organization context.
- `apps/web/app/api/sentry-test/route.ts` is the protected web smoke test endpoint.

### API

- `apps/api/src/instrument.ts` initializes Sentry before the API imports route handlers.
- `apps/api/src/lib/sentry.ts` contains shared request, actor, API, and WebSocket capture helpers.
- `apps/api/src/routes/sentry-test.route.ts` is the protected API smoke test endpoint.
- `apps/api/src/ws/wsServer.ts` captures WebSocket and AI/RAG/action exceptions.
- `apps/api/scripts/upload-sentry-sourcemaps.mjs` uploads API source maps after build.

## Source Maps

### Web Source Maps

Next.js source maps are handled through `withSentryConfig` in:

- `apps/web/next.config.mjs`

For production builds, make sure these env vars exist during the build step:

```env
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=...
SENTRY_PROJECT=tinfiz-web
SENTRY_RELEASE=tinfiz@2026.05.09-1
SENTRY_UPLOAD_SOURCE_MAPS=true
```

Then run:

```powershell
pnpm --filter web build
```

### API Source Maps

API TypeScript now builds with `sourceMap` and `inlineSources` enabled.

Run:

```powershell
pnpm --filter @workspace/api build
$env:SENTRY_PROJECT="tinfiz-api"
pnpm --filter @workspace/api sentry:sourcemaps
```

Or use:

```powershell
$env:SENTRY_PROJECT="tinfiz-api"
pnpm --filter @workspace/api build:sentry
```

## Smoke Testing

Set `SENTRY_TEST_TOKEN` first. Use a random long value.

### Test Web Sentry

Local:

```powershell
$token="your-sentry-test-token"
Invoke-RestMethod -Method Post "http://localhost:3000/api/sentry-test" -Headers @{ "x-sentry-test-token" = $token }
```

Production:

```powershell
$token="your-sentry-test-token"
Invoke-RestMethod -Method Post "https://your-app-domain.com/api/sentry-test" -Headers @{ "x-sentry-test-token" = $token }
```

Expected response:

```json
{
  "ok": true,
  "eventId": "...",
  "runId": "...",
  "flushed": true,
  "sentryEnabled": true,
  "dsnConfigured": true
}
```

Search the exact event in Sentry with the returned `runId`:

```text
smoke_run_id:YOUR_RUN_ID
```

### Test API Sentry

Local:

```powershell
$token="your-sentry-test-token"
Invoke-RestMethod -Method Post "http://localhost:3001/api/sentry-test" -Headers @{ "x-sentry-test-token" = $token }
```

Production:

```powershell
$token="your-sentry-test-token"
Invoke-RestMethod -Method Post "https://your-api-domain.com/api/sentry-test" -Headers @{ "x-sentry-test-token" = $token }
```

## WebSocket Testing

Use a staging workspace and test these flows:

1. Open widget and send a new message.
2. Trigger an AI answer.
3. Trigger an AI action request.
4. Approve and reject an action from the inbox.
5. Temporarily break an action endpoint URL in staging and confirm Sentry captures the failure.
6. Temporarily use an invalid AI provider key in staging and confirm the RAG/AI failure is captured.

Sentry event should include:

- `surface=websocket`
- `phase`
- `org.id`
- `conversation.id` when available
- WebSocket context with visitor/agent metadata where available

## User And Organization Context

Dashboard sessions set:

- Sentry user id and email.
- `org.id` tag.
- `org.plan` tag.
- `org.role` tag.
- `organization` context with org name and permissions.

API tRPC requests set:

- User id and email.
- Active organization id.
- User role.

This makes debugging much faster because an issue can be filtered by workspace, user, plan, role, release, and surface.

## Privacy And Redaction

Sentry is configured with:

```ts
sendDefaultPii: false
```

Events are also scrubbed before sending. These keys are filtered recursively:

- `authorization`
- `cookie`
- `password`
- `secret`
- `token`
- `apiKey`
- `serviceKey`
- `accessToken`
- `refreshToken`

Do not manually attach raw request bodies, customer conversation transcripts, Supabase service keys, Stripe secrets, WhatsApp tokens, Vapi keys, or AI provider keys to Sentry `extra` fields.

## Production Workflow

### Before Deploy

1. Set Sentry env vars in hosting provider.
2. Set `SENTRY_RELEASE` and `NEXT_PUBLIC_APP_VERSION` to the same release name.
3. Build web with source map upload enabled.
4. Build API and upload API source maps.
5. Deploy web, API, and WebSocket server with the same release name.
6. Run web and API smoke tests.

### When A User Reports An Issue

1. Search Sentry by user email or org id.
2. Check release version.
3. Check surface tag: `web`, `react_query`, `trpc`, `api`, or `websocket`.
4. Check phase/context for the failing module.
5. Reproduce on staging if needed.
6. Fix and deploy a new release.
7. Resolve the Sentry issue only after the fix is verified.

## Alert Rules To Create

Create these alert rules inside Sentry:

- P0: More than 5 API/WebSocket errors in 5 minutes.
- P0: Any payment, billing, or subscription error in production.
- P0: Any action approval/action execution error in production.
- P1: More than 10 web client errors in 30 minutes.
- P1: AI/RAG provider failures above normal threshold.
- P2: Repeated browser errors from the same release.

## Official References

- Next.js Sentry docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Node Sentry docs: https://docs.sentry.io/platforms/javascript/guides/node/
- Next.js source maps: https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/

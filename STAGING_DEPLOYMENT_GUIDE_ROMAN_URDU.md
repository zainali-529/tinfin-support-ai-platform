# Tinfiz Staging Deployment Guide

Ye guide Tinfiz monorepo ko staging par deploy karne ke liye hai. Current repo mein teen deployable surfaces hain:

- `apps/web`: Next.js dashboard + marketing + docs.
- `apps/api`: Express API + tRPC + webhooks + standalone WebSocket server.
- `apps/widget`: Vite IIFE widget bundle jo customer websites par script tag se load hota hai.

## Important Architecture Decision

Web aur widget Vercel par clean deploy ho sakte hain.

Current API as-is Vercel ke liye ideal nahi hai, because:

- API `app.listen(PORT)` use karti hai.
- API same process mein `createWsServer(WS_PORT)` se standalone WebSocket server start karti hai.
- Vercel Functions persistent WebSocket server ki tarah act nahi karte.

Recommended staging architecture:

- Web: Vercel.
- Widget CDN: Vercel static deployment.
- API + WebSocket: Railway, Render, Fly.io, Zeabur, VPS, ya koi persistent Node host.

Vercel-only future path:

- API ko Vercel Function style mein refactor karna hoga.
- WebSocket ko Ably/Pusher/Supabase Realtime/Redis-backed external realtime service par shift karna hoga, ya separate persistent realtime service rakhni hogi.

## Recommended Staging Domains

Use separate staging subdomains:

```txt
Web app:       https://staging.tinfiz.com
API:           https://api-staging.tinfiz.com
WebSocket:     wss://ws-staging.tinfiz.com
Widget CDN:    https://cdn-staging.tinfiz.com/widget.js
```

If API and WebSocket are on same persistent host with separate exposed ports, keep:

```txt
NEXT_PUBLIC_API_URL=https://api-staging.tinfiz.com
NEXT_PUBLIC_WS_URL=wss://ws-staging.tinfiz.com
VITE_API_URL=https://api-staging.tinfiz.com
VITE_API_WS_URL=wss://ws-staging.tinfiz.com
```

## Before Deployment

Run these from repo root:

```bash
pnpm install --frozen-lockfile
pnpm env:check:staging
pnpm --filter @workspace/api check-types
pnpm --filter web typecheck
pnpm --filter @workspace/widget check-types
pnpm --filter @workspace/widget build
```

Run DB migrations against staging DB:

```bash
pnpm --filter @workspace/db db:migrate
```

Important:

- Staging should use a separate Supabase project.
- Staging should use Stripe test mode.
- Staging should use Sentry environment `staging`.
- Do not use production customer data for staging testing.
- Do not commit `.env`, `.env.staging`, `.env.production`, or service keys.

## Project 1: Web App on Vercel

Create a Vercel project:

```txt
Project name: tinfiz-web-staging
Root directory: apps/web
Framework preset: Next.js
Install command: pnpm install --frozen-lockfile
Build command: pnpm build
Output directory: leave default
Node version: 20+
```

Recommended Vercel environment scope:

- Use a separate Vercel project for staging.
- In that staging project, set variables under Production scope, but values should be staging values.
- This keeps staging stable on `staging.tinfiz.com` without mixing with real production.

### Web Required Environment Variables

Add these in Vercel project settings:

```txt
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=staging

NEXT_PUBLIC_APP_URL=https://staging.tinfiz.com
WEB_URL=https://staging.tinfiz.com
NEXT_PUBLIC_API_URL=https://api-staging.tinfiz.com
NEXT_PUBLIC_WS_URL=wss://ws-staging.tinfiz.com

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

NEXT_PUBLIC_SENTRY_ENABLED=true
NEXT_PUBLIC_SENTRY_DSN=...
WEB_SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging
SENTRY_ENVIRONMENT=staging
NEXT_PUBLIC_APP_VERSION=tinfiz-web-staging@YYYY.MM.DD-N
SENTRY_RELEASE=tinfiz-web-staging@YYYY.MM.DD-N
SENTRY_TRACES_SAMPLE_RATE=0.05
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.05
SENTRY_TUNNEL_ROUTE=/monitoring
```

If uploading web source maps:

```txt
SENTRY_UPLOAD_SOURCE_MAPS=true
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=tinfiz
SENTRY_PROJECT=tinfiz-web
```

Do not add these to web unless server-side web routes need them:

```txt
SUPABASE_SERVICE_KEY
STRIPE_SECRET_KEY
OPENAI_API_KEY
VAPI_PRIVATE_KEY
ACTION_SECRET_ENCRYPTION_KEY
```

If Vercel build needs server routes that reference private envs, add only what is required, but never expose private values with `NEXT_PUBLIC_`.

### Web Custom Domain

In Vercel:

```txt
Project Settings -> Domains -> Add staging.tinfiz.com
```

Add DNS record as Vercel instructs.

After DNS works:

```bash
curl https://staging.tinfiz.com
```

## Project 2: Widget CDN on Vercel

The widget is a Vite library build. It now outputs:

```txt
apps/widget/dist/widget.js
```

Create a second Vercel project:

```txt
Project name: tinfiz-widget-staging
Root directory: apps/widget
Framework preset: Vite
Install command: pnpm install --frozen-lockfile
Build command: pnpm build
Output directory: dist
Node version: 20+
```

### Widget Required Environment Variables

These values are compiled into the widget bundle during build:

```txt
VITE_API_URL=https://api-staging.tinfiz.com
VITE_API_WS_URL=wss://ws-staging.tinfiz.com
```

Important:

- After changing `VITE_API_URL` or `VITE_API_WS_URL`, redeploy widget.
- Widget should never contain secret keys.
- Widget should only use public API/WS URLs.

### Widget CDN Domain

In Vercel:

```txt
Project Settings -> Domains -> Add cdn-staging.tinfiz.com
```

Test:

```bash
curl -I https://cdn-staging.tinfiz.com/widget.js
```

Expected:

```txt
HTTP 200
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400
```

### Staging Embed Snippet

Use this on a test website:

```html
<script
  src="https://cdn-staging.tinfiz.com/widget.js"
  data-organization-id="YOUR_STAGING_ORG_ID"
  async
></script>
```

Test:

- Widget launcher appears.
- Widget config loads.
- Sending message creates conversation in staging inbox.
- WebSocket request connects to `wss://ws-staging.tinfiz.com`.

## Project 3: API + WebSocket on Persistent Node Host

Recommended staging host:

- Railway
- Render
- Fly.io
- Zeabur
- VPS with PM2/Docker

Reason:

- Current API starts an Express HTTP server.
- Current API starts a standalone `ws` server on `WS_PORT`.
- This needs a long-running Node process.

### API Build and Start Commands

Use repo root as deploy root if the platform supports monorepos:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @workspace/api build
pnpm --filter @workspace/api start:cloud
```

Build command:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api build
```

Start command:

```bash
pnpm --filter @workspace/api start:cloud
```

The `start:cloud` script avoids local `--env-file` usage and reads envs from the hosting platform.

### API Required Environment Variables

Add these to the API/WS hosting provider:

```txt
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=staging

PORT=3001
WS_PORT=3003

WEB_URL=https://staging.tinfiz.com
WEB_APP_URL=https://staging.tinfiz.com
APP_URL=https://staging.tinfiz.com
NEXT_PUBLIC_APP_URL=https://staging.tinfiz.com

NEXT_PUBLIC_API_URL=https://api-staging.tinfiz.com
NEXT_PUBLIC_WS_URL=wss://ws-staging.tinfiz.com
API_BASE_URL=https://api-staging.tinfiz.com

DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

OPENAI_API_KEY=...
AGENT_COPILOT_MODEL=...
ANALYTICS_TIME_ZONE=Asia/Karachi

ENCRYPTION_KEY=...
ACTION_SECRET_ENCRYPTION_KEY=...
AI_ACTION_OUTBOUND_ALLOWLIST=api-staging.tinfiz.com,localhost,127.0.0.1

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_SCALE=price_...
STRIPE_TRIAL_DAYS=...
STRIPE_PLAN_COUPON_ID=...

VAPI_PRIVATE_KEY=...
VAPI_PUBLIC_KEY=...
VAPI_WEBHOOK_SECRET=...
DEEPGRAM_API_KEY=...

NOTIFICATION_EMAIL_ENABLED=false
NOTIFICATION_RESEND_API_KEY=...
NOTIFICATION_EMAIL_FROM=...
NOTIFICATION_EMAIL_FROM_NAME=Tinfiz
NOTIFICATION_EMAIL_REPLY_TO=...
NOTIFICATION_EMAIL_INCLUDE_NEW_CONVERSATIONS=false

DEMO_REQUEST_WEBHOOK_URL=...
DEMO_REQUEST_WEBHOOK_SECRET=...
CONTACT_REQUEST_WEBHOOK_URL=...
CONTACT_REQUEST_WEBHOOK_SECRET=...

ISSUE_REPORT_WEBHOOK_URL=...
ISSUE_REPORT_WEBHOOK_SECRET=...
ISSUE_REPORT_EMAIL_TO=...
ISSUE_REPORT_EMAIL_FROM=...
ISSUE_REPORT_EMAIL_FROM_NAME=Tinfiz
ISSUE_REPORT_EMAIL_REPLY_TO=...
ISSUE_REPORT_RESEND_API_KEY=...

SENTRY_ENABLED=true
SENTRY_ENVIRONMENT=staging
API_SENTRY_DSN=...
API_VERSION=tinfiz-api-staging@YYYY.MM.DD-N
SENTRY_RELEASE=tinfiz-api-staging@YYYY.MM.DD-N
SENTRY_TEST_TOKEN=...
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0

REDIS_URL=rediss://...
```

### One-Port Hosting Warning

Some hosts expose only one public port per service.

Current app uses:

```txt
PORT     -> HTTP API
WS_PORT  -> WebSocket server
```

If your host exposes only one port, you have three options:

1. Use a host/service plan that supports multiple exposed ports.
2. Deploy API and WS as two services.
3. Refactor WebSocket server to attach to the same HTTP server before production.

For staging, option 2 is usually the fastest if your host does not support multiple ports.

## If You Still Want API on Vercel

Vercel can run Express as a Vercel Function, but current API is not yet shaped for that.

Needed changes before API-on-Vercel:

- Export Express app instead of relying on long-running `app.listen`.
- Remove or disable `createWsServer(WS_PORT)` from Vercel function runtime.
- Move realtime to:
  - Ably
  - Pusher
  - Supabase Realtime
  - separate persistent WS service
  - Redis pub/sub plus another realtime gateway

Do not deploy current `apps/api/src/index.ts` to Vercel expecting WebSocket to work as-is.

## Supabase Staging Setup

Create separate Supabase project:

```txt
Project: tinfiz-staging
Region: choose closest to expected users
Database password: strong random value
```

Then:

1. Copy `NEXT_PUBLIC_SUPABASE_URL`.
2. Copy `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Copy `SUPABASE_SERVICE_KEY`.
4. Copy pooled `DATABASE_URL`.
5. Run migrations:

```bash
pnpm --filter @workspace/db db:migrate
```

Auth redirect URLs:

```txt
https://staging.tinfiz.com
https://staging.tinfiz.com/auth/callback
http://localhost:3000
http://localhost:3000/auth/callback
```

Keep localhost only in staging/dev, not production.

## Stripe Staging Setup

Use Stripe test mode.

Create products/prices:

```txt
Starter: $9/month
Pro:     $29/month
Scale:   $79/month
```

Set env:

```txt
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_SCALE=price_...
```

Create webhook endpoint:

```txt
https://api-staging.tinfiz.com/api/stripe-webhook
```

Events:

```txt
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

Copy webhook secret:

```txt
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Vapi Staging Setup

Set Vapi envs in API host:

```txt
VAPI_PRIVATE_KEY=...
VAPI_PUBLIC_KEY=...
VAPI_WEBHOOK_SECRET=...
```

Webhook URL:

```txt
https://api-staging.tinfiz.com/api/vapi-webhook
```

Test:

- Create assistant from dashboard.
- Open widget voice tab.
- Start test call.
- Confirm call appears in Calls page.
- Confirm transcript/logs appear.

## Email and WhatsApp Staging

Email inbound webhook:

```txt
https://api-staging.tinfiz.com/api/email-inbound
```

WhatsApp webhook:

```txt
https://api-staging.tinfiz.com/api/whatsapp-webhook
```

Use test/sandbox accounts first.

Do not connect real customer WhatsApp number until production validation is complete.

## Sentry Staging

Use environment:

```txt
staging
```

Recommended projects:

```txt
tinfiz-web
tinfiz-api
```

Smoke test API:

```bash
curl -X POST https://api-staging.tinfiz.com/api/sentry-test \
  -H "x-sentry-test-token: YOUR_SENTRY_TEST_TOKEN"
```

Smoke test web if web route is enabled:

```bash
curl -X POST https://staging.tinfiz.com/api/sentry-test \
  -H "x-sentry-test-token: YOUR_SENTRY_TEST_TOKEN"
```

Expected:

- API issue appears in `tinfiz-api`.
- Web issue appears in `tinfiz-web`.
- Event has environment `staging`.
- Release matches `SENTRY_RELEASE`.

## Post-Deploy Smoke Test

Run in this order.

### 1. API Health

```bash
curl https://api-staging.tinfiz.com/health
```

Expected:

```json
{"status":"ok"}
```

### 2. Widget CDN

```bash
curl -I https://cdn-staging.tinfiz.com/widget.js
```

Expected:

```txt
HTTP 200
```

### 3. Web Login

Open:

```txt
https://staging.tinfiz.com
```

Check:

- Signup/login works.
- Organization switch works.
- Dashboard loads under 3 seconds with normal staging data.
- No giant blocked tRPC batch request.

### 4. Widget Conversation

Use snippet:

```html
<script
  src="https://cdn-staging.tinfiz.com/widget.js"
  data-organization-id="YOUR_STAGING_ORG_ID"
  async
></script>
```

Check:

- Widget loads.
- Widget config API returns 200.
- WebSocket connects.
- Message from widget appears in inbox quickly.
- Agent reply appears in widget quickly.
- AI answer sources show in agent dashboard.

### 5. Realtime Inbox

Open two browser sessions:

- Session A: agent account 1.
- Session B: agent account 2.

Test:

- New conversation appears live.
- Assignment updates live.
- Timeline updates live.
- Notes update live.
- SLA timers continue without refresh.

### 6. Billing

Use Stripe test card:

```txt
4242 4242 4242 4242
```

Check:

- Checkout opens.
- Trial/discount display matches UI.
- Subscription webhook updates org plan.
- Add-ons update usage limits.

### 7. Notifications

Check:

- In-app notification bell updates.
- Browser permission works.
- Assigned conversation notification appears.
- SLA warning/breach notification appears.
- Issue report sends metadata.

### 8. AI Actions

Check:

- Safe read action test panel works.
- Required parameter helper works.
- Execution logs show status, request, response, latency.
- Write/risky action requires approval.
- Domain allowlist blocks non-allowed domains.

## Performance Smoke Test

Use seeded staging org.

Open DevTools Network and check:

- No huge single tRPC batch should hold all dashboard queries.
- `dashboard.getHomeOverview` should be separate.
- `usage.getUsage` should be separate.
- `notifications.getUnreadCount` should be separate.
- Dashboard first meaningful content should appear quickly.

Target:

```txt
Dashboard shell: under 1 second after auth/session ready
KPIs: under 2-3 seconds on seeded staging data
Recent/activity panels: independently loaded
Widget message to inbox: near realtime
```

If `dashboard.getHomeOverview` is still slow:

1. Check database indexes migration `0015_dashboard_performance_indexes`.
2. Run query in Supabase SQL editor with `EXPLAIN ANALYZE`.
3. Check whether seeded data volume is unrealistic.
4. Check API host database region distance.
5. Check Supabase pooler mode and connection latency.

## Deployment Order

Recommended order:

1. Create staging Supabase project.
2. Add staging envs locally in `.env.staging`.
3. Run:

```bash
pnpm env:check:staging
```

4. Run DB migrations:

```bash
pnpm --filter @workspace/db db:migrate
```

5. Deploy API + WS persistent host.
6. Verify `/health`.
7. Deploy widget CDN.
8. Verify `/widget.js`.
9. Deploy web on Vercel.
10. Add custom domains.
11. Configure Stripe/Vapi/email/WhatsApp webhooks.
12. Run smoke test.
13. Seed optional demo data only after core flows pass.

## Rollback Plan

Web:

- Use Vercel previous deployment rollback.

Widget:

- Use Vercel previous deployment rollback.
- Because `widget.js` has short CDN max-age, clients should pick rollback relatively quickly.

API:

- Redeploy previous commit on API host.
- Do not manually reverse DB migrations unless a rollback migration exists.

Database:

- Avoid destructive migrations before staging is stable.
- For production, create explicit rollback SQL for risky migrations.

## Common Problems

### Dashboard takes 20 seconds

Likely causes:

- Slow tRPC batch is holding multiple calls.
- Missing dashboard performance indexes.
- Supabase project and API host are in distant regions.
- Notification SLA scan or usage aggregation is too heavy.

Current fix already done:

- Dashboard heavy calls are unbatched.
- Usage aggregates run in SQL.
- Notification SLA scan is background/throttled.
- Dashboard aggregate indexes are added.

### Widget loads but messages do not send

Check:

```txt
VITE_API_URL
VITE_API_WS_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_WS_URL
```

Also check browser Network:

- `widget-config` API returns 200.
- WebSocket connects to `wss://...`.

### Widget script returns 404

Check:

```txt
https://cdn-staging.tinfiz.com/widget.js
```

The widget build must output:

```txt
apps/widget/dist/widget.js
```

### Stripe checkout works but plan does not update

Check:

- Stripe webhook URL.
- `STRIPE_WEBHOOK_SECRET`.
- API logs for `/api/stripe-webhook`.
- Supabase `subscriptions` row.

### Sentry shows no events

Check:

- `SENTRY_ENABLED=true`
- `SENTRY_ENVIRONMENT=staging`
- correct DSN per project.
- smoke test token matches.
- API/web route deployed.

## Official References

- Vercel monorepos: https://vercel.com/docs/monorepos
- Vercel Vite deployments: https://examples.vercel.com/docs/frameworks/frontend/vite
- Vercel Express guide: https://examples.vercel.com/docs/frameworks/backend/express
- Vercel WebSocket limitation: https://vercel.com/docs/limits#websockets


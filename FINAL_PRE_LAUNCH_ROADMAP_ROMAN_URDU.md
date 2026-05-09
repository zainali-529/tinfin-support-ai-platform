# Tinfiz Final Pre-Launch Roadmap

_Last updated: May 9, 2026_

Ye document Tinfiz ke current project state ko dekh kar banaya gaya hai. Iska goal simple hai: launch se pehle exactly kya verify karna hai, deployment ka safe flow kya hoga, bugs kaise find/track karne hain, aur abhi kaun si cheezen missing ya risky hain.

## Short Verdict

Tinfiz feature-wise launch ke kaafi qareeb hai. Dashboard, widget, docs, marketing pages, pricing, demo/contact/security/privacy/terms, billing guards, AI, Knowledge Base, inbox operations, notifications, analytics, CSAT, actions, and responsive improvements kaafi strong ho chuke hain.

Lekin direct public launch se pehle ye kaam lazmi hain:

- Staging environment par full end-to-end QA.
- Production env variables aur webhook URLs verify.
- Error tracking/monitoring add karna.
- Backups aur rollback plan ready karna.
- Real-time/WebSocket production test.
- Billing/Stripe test-to-live switch carefully verify.
- AI/RAG and AI Actions ko production data ke saath smoke test.
- Marketing forms, docs screenshots, SEO basics, sitemap/robots add/check.

Meri recommendation: pehle **private beta / soft launch** karo. 5-10 real users ya friendly businesses ke saath 3-7 din run karo. Agar errors stable rahein, phir public launch.

## Current Project Coverage

### Dashboard Product

Already strong areas:

- Unified Inbox.
- Realtime conversations and assignment updates.
- Saved views.
- Notes and timeline.
- Team assignment.
- SLA/backlog semantics.
- Notifications.
- Knowledge Base with source health.
- AI Improvements page.
- Channel-aware AI behavior.
- Agent Copilot.
- AI Actions v1 with templates, logs, tests, approvals, secrets, allowlist.
- Contacts/customer profile timeline.
- Calls and voice assistant.
- Widget customization.
- Widget installation docs/snippets.
- Analytics, CSAT, action quality, channel quality.
- Billing plans, add-ons, discounts/trials, server-side guards.

### Marketing And Trust Pages

Already built:

- Home page.
- Pricing page.
- Demo page.
- Contact page.
- Security page.
- Privacy page.
- Terms page.
- Docs center.

These are enough for first launch. Feature-specific marketing pages can come later after traffic/revenue.

### Backend And Infra Surfaces

Current stack observed:

- Next.js web app.
- Separate API app with Express/TRPC.
- WebSocket server.
- Supabase database/auth/storage.
- Drizzle migrations.
- Redis package available.
- Stripe billing/webhooks.
- OpenAI/RAG.
- Vapi voice.
- WhatsApp webhook.
- Email inbound route.
- Resend/notification email support.

## Important Gaps Before Public Launch

### 1. Error Tracking Is Missing

Codebase scan mein dedicated Sentry/PostHog/LogRocket/Datadog/OpenTelemetry integration nazar nahi aayi.

Launch ke liye ye important hai kyun ke agar user ko error aaye to humein ye pata hona chahiye:

- Kaun sa user tha?
- Kaun si organization thi?
- Kaun sa page tha?
- Kaun sa browser/device tha?
- Kaun sa API request fail hua?
- Stack trace kya thi?
- Release/version kaunsi thi?

Recommended:

- Web app ke liye Sentry.
- API ke liye Sentry ya Pino logs + external log drain.
- WebSocket server errors bhi capture hon.
- Release version env variable set ho, e.g. `NEXT_PUBLIC_APP_VERSION` and `API_VERSION`.

Minimum launch requirement:

- Error capture web + API.
- Source maps production mein upload.
- User/org context attach.
- Critical error alert email/Slack/Discord.

### 2. Uptime Monitoring Missing

API mein `/health` route hai. Isko use karo.

Setup:

- Uptime monitor for web URL.
- Uptime monitor for API `/health`.
- WebSocket connectivity check.
- Stripe webhook endpoint health manually test.
- Vapi/WhatsApp/email webhook endpoints reachable.

Tools:

- Better Stack.
- UptimeRobot.
- Pingdom.
- Railway/Render/Fly/AWS health checks, depending hosting.

Minimum:

- Web down alert.
- API down alert.
- DB connection failure alert.
- Webhook 5xx alert.

### 3. Sitemap, Robots, Not Found, Error Pages

Scan mein `sitemap`, `robots`, `not-found`, `error.tsx`, `global-error` files clearly nazar nahi aaye.

Marketing launch ke liye recommended:

- `sitemap.ts`.
- `robots.ts`.
- `not-found.tsx`.
- `error.tsx` for marketing/dashboard boundary.
- `global-error.tsx` optional.

Why:

- SEO crawler ko pages milte hain.
- Broken route professional lagti hai.
- Unexpected UI crash par friendly fallback show hota hai.

Priority:

- Sitemap/robots: P0 for public marketing launch.
- Not found/error pages: P0 for polish and reliability.

### 4. Production Redis Decision

Project mein Redis support available hai, lekin agar `REDIS_URL` missing ho to local fallback warning aati hai.

Launch options:

#### Single Server Launch

Theek hai agar:

- API single instance par hai.
- WebSocket single instance par hai.
- Traffic low hai.
- Sticky sessions ka issue nahi.

Risk:

- Multiple instances scale karte hi realtime events split ho sakte hain.
- Background queues/pub-sub unreliable ho sakti hain.

#### Managed Redis Launch

Recommended agar:

- API multiple instances par deploy karni hai.
- Realtime events fast and synced chahiye.
- Notifications/queues future mein scale karni hain.

Recommended:

- Production mein `REDIS_URL` set karo.
- Upstash/Redis Cloud/managed Redis use karo.
- Redis unavailable ho to graceful degradation and health warning ho.

My recommendation:

- Agar first launch single API server par hai, Redis optional hai.
- Agar public launch/paid users start kar rahe ho, managed Redis set kar do. Ye future issues se bachata hai.

### 5. Production Logs Need Structure

API mein Pino dependency hai aur multiple console logs bhi hain. Launch ke liye logs readable aur searchable hone chahiye.

Recommended log fields:

- `requestId`
- `orgId`
- `userId`
- `conversationId`
- `route`
- `statusCode`
- `durationMs`
- `provider`
- `errorCode`
- `release`

Minimum:

- API errors central place par collect hon.
- Webhook failures searchable hon.
- AI/action failures searchable hon.
- Realtime disconnects searchable hon.

### 6. Demo/Contact Form Webhooks

Demo and contact pages ab webhook env par depend kar sakte hain.

Production mein required:

- `DEMO_REQUEST_WEBHOOK_URL`
- `DEMO_REQUEST_WEBHOOK_SECRET`
- `CONTACT_REQUEST_WEBHOOK_URL`
- `CONTACT_REQUEST_WEBHOOK_SECRET`

If webhook set nahi hoga, production mein form fail karega. Isliye launch se pehle test submission zaroor karo.

## Required Production Env Checklist

### Core Web/API

- `NEXT_PUBLIC_APP_URL`
- `WEB_APP_URL` or `APP_URL`
- `WEB_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `API_BASE_URL`
- `PORT`
- `WS_PORT`
- `NODE_ENV=production`

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `DATABASE_URL`

### AI

- `OPENAI_API_KEY`
- `AGENT_COPILOT_MODEL` if custom model needed

### Stripe

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_SCALE`
- `STRIPE_ENABLE_CUSTOMER_PROMO_CODES`

### Notifications Email

- `NOTIFICATION_EMAIL_ENABLED`
- `NOTIFICATION_RESEND_API_KEY` or `RESEND_API_KEY`
- `NOTIFICATION_EMAIL_FROM`
- `NOTIFICATION_EMAIL_FROM_NAME`
- `NOTIFICATION_EMAIL_REPLY_TO`
- `NOTIFICATION_EMAIL_INCLUDE_NEW_CONVERSATIONS`

### Channels

- `MAILGUN_WEBHOOK_SIGNING_KEY`
- `WHATSAPP_APP_SECRET`
- `VAPI_PUBLIC_KEY`
- `VAPI_PRIVATE_KEY`
- `VAPI_WEBHOOK_SECRET`
- `DEEPGRAM_API_KEY` if voice preview depends on it

### Redis

- `REDIS_URL`

### Marketing Forms

- `DEMO_REQUEST_WEBHOOK_URL`
- `DEMO_REQUEST_WEBHOOK_SECRET`
- `CONTACT_REQUEST_WEBHOOK_URL`
- `CONTACT_REQUEST_WEBHOOK_SECRET`

### QA/Load/Screenshot Demo Optional

- `SCREENSHOT_DEMO_ORG_ID`
- `SCREENSHOT_DEMO_SEED_ID`
- `SCREENSHOT_DEMO_DAYS`
- `SCREENSHOT_DEMO_SCALE`
- `SCREENSHOT_DEMO_RESET`
- `TINFIZ_LOAD_AUTH_TOKEN`
- `SUPABASE_ACCESS_TOKEN`
- `LOAD_PERIOD`
- `LOAD_REQUESTS`
- `LOAD_CONCURRENCY`

## Deployment Flow

### Step 1 - Staging Environment

Production se pehle staging lazmi hai.

Staging setup:

- Separate Supabase project.
- Separate Stripe test mode keys.
- Separate Vapi/WhatsApp/email sandbox ya test setup.
- Separate Redis.
- Separate web/API URLs.
- Separate widget CDN/build URL.

Staging commands:

```bash
pnpm install
pnpm --filter @workspace/db db:migrate
pnpm lint
pnpm typecheck
pnpm build
```

If build passes, deploy staging web + API.

### Step 2 - Database Migration

Production DB migration se pehle:

- Supabase backup lo.
- Migration files committed hon.
- Staging par migration run ho chuki ho.
- Fresh DB migration bhi test ho.
- Existing DB migration bhi test ho.

Command:

```bash
pnpm --filter @workspace/db db:migrate
```

Important:

- Migration manually SQL editor mein paste na karo.
- Production migration ka exact timestamp/log save karo.
- Agar migration fail ho to rollback plan ready ho.

### Step 3 - API Deploy

API deploy ke baad verify:

```bash
curl https://api.yourdomain.com/health
```

Expected:

```json
{ "status": "ok" }
```

Then verify:

- `/trpc` reachable.
- `/api/widget-config` reachable.
- WebSocket URL reachable.
- Stripe webhook endpoint configured.
- Vapi webhook endpoint configured.
- WhatsApp webhook endpoint configured.
- Email inbound webhook configured.

### Step 4 - Web Deploy

Web deploy ke baad verify:

- Home page.
- Pricing page.
- Demo page.
- Contact page.
- Docs.
- Login.
- Signup.
- Dashboard.
- Widget page.
- Inbox.

### Step 5 - Widget Deploy

Widget ka production build/CDN URL verify:

- Script loads.
- Correct org ID works.
- Widget opens/closes.
- New conversation creates.
- WebSocket connects.
- Messages appear in inbox quickly.
- Theme/customization works.
- CSAT appears after resolve.

### Step 6 - Webhook Configuration

Stripe:

- Checkout session completed.
- Subscription updated.
- Subscription deleted.
- Payment failed.
- Add-on purchase completed.

Vapi:

- Assistant call start.
- Transcript updates.
- End-of-call report.
- Call linked to contact/conversation.

WhatsApp:

- Webhook verify.
- Incoming text.
- Incoming media.
- Duplicate message handling.
- Token expired handling.

Email:

- Inbound message creates conversation.
- Reply sends correctly.
- Signature validation works.
- Duplicate inbound is skipped.

Demo/contact:

- Demo form sends to webhook.
- Contact form sends to webhook.
- Webhook failure shows friendly error.

## Pre-Launch QA Plan

### 1. Authentication QA

Test cases:

- Signup with new user.
- Login.
- Logout.
- Auth callback.
- Password/session expiry behavior.
- No org selected state.
- Invite accept flow.
- Team member login.
- Org switch hard reload/state refresh.

Pass criteria:

- User never gets stuck on blank screen.
- Role and org state updates correctly.
- Invalid invite/token has friendly error.

### 2. Organization QA

Test cases:

- Create new organization.
- Switch between two organizations.
- Verify badges/counts change after switch.
- Invite team member.
- Admin vs agent permissions.
- Remove/restrict team member if implemented.

Pass criteria:

- No data leaks between orgs.
- Server-side permission guard blocks restricted access.

### 3. Billing QA

Use Stripe test mode first.

Test cases:

- Free plan.
- Starter plan.
- Pro plan.
- Scale plan.
- Discount/trial applied.
- Add-on custom quantity.
- Failed payment.
- Subscription canceled/deleted.
- Plan restricted state.
- Usage limit reached.
- Contact deletion does not reduce usage.

Pass criteria:

- Frontend labels match server-side guards.
- Starter cannot use email/WhatsApp/voice.
- Free/Starter AI Actions preview behavior consistent.
- Pro/Scale Copilot access works.
- Add-ons increase limits accurately.

### 4. Widget QA

Browsers:

- Chrome.
- Safari.
- Firefox.
- Edge.
- Mobile Chrome.
- Mobile Safari.

Test cases:

- Install script on a simple HTML page.
- Correct org ID.
- Wrong org ID.
- Widget open/close.
- Bottom left/bottom right placement.
- Light/dark/custom theme.
- Width/height/expanded size.
- New visitor local storage.
- Deleted contact behavior.
- New conversation.
- Message attachments.
- AI reply formatting.
- Human takeover.
- Release to AI.
- CSAT after resolved conversation.

Pass criteria:

- No 2-4 second unnecessary UI lag.
- Widget and inbox realtime sync.
- No broken layout on mobile/tablet.
- No exposed internal source details to widget user unless intentionally enabled.

### 5. Inbox QA

Test cases:

- New conversation appears instantly.
- Existing conversation updates instantly.
- Assignment updates across two logged-in agents.
- Status update realtime.
- Notes create/edit/delete realtime.
- Timeline realtime.
- Saved views.
- SLA at-risk/breached badges.
- Waiting/backlog timers update without refresh.
- AI trust panel.
- Agent Copilot.
- Right/left panels collapse.
- No selected conversation empty state centered.

Pass criteria:

- No forced refresh needed for operational state.
- Multiple agents see same current state.
- API refetch storms do not happen on typing.

### 6. Knowledge Base And RAG QA

Test sources:

- Company overview note.
- Pricing/support policy note.
- One URL source.
- One document source.
- Duplicate source.
- Low-quality/noisy source.
- Delete source.
- Re-index source.

Questions:

- “Tell me about your company.”
- “Who are you?”
- “What can you do for me?”
- “What is your pricing?”
- “What channels do you support?”
- “What is Supabase?” when not in KB.
- “Can I talk to a human?”
- Channel-specific answers in chat/email/WhatsApp/voice.

Pass criteria:

- AI behaves like an assistant representing the current organization.
- AI does not act like it is the company itself when user asks “what can you do”.
- AI does not answer unrelated facts from outside KB unless allowed by product behavior.
- No verified answer handling is professional.
- Missing answer creates improvement signal.
- Formatting is clean in widget and inbox.

### 7. AI Actions QA

Test with mock actions first.

Read action:

- Missing required parameter.
- Valid parameter.
- Invalid parameter.
- Provider timeout.
- Domain not allowed.
- Secret missing.

Write action:

- Approval required.
- Approval queue item created.
- Admin approves.
- Action executes.
- Failure log readable.
- Retry safe action.

Pass criteria:

- AI asks for missing required parameter instead of guessing.
- AI uses recent conversation context when parameter already exists.
- Risky write action does not run without approval.
- Logs show request preview, response, status, latency, failure reason.

### 8. Channels QA

Email:

- Connect account.
- Inbound email creates contact/conversation.
- Reply from inbox.
- Threading.
- Attachment if supported.
- Provider signature invalid.

WhatsApp:

- Webhook verify.
- Inbound message.
- Outbound reply.
- Media message.
- Token expired.
- Duplicate inbound.

Voice:

- Vapi key configured.
- Assistant selected.
- Call starts.
- Transcript appears.
- End call report.
- Voice minutes usage increments.
- Missing Vapi key friendly error.

Pass criteria:

- Channel disconnected states are friendly.
- Plan blocks channels correctly.
- Webhook errors logged and visible.

### 9. Notifications QA

Test cases:

- New conversation notification.
- Assigned-to-me notification.
- SLA at-risk notification.
- SLA breached notification.
- AI handoff request.
- Action approval request.
- Browser permission denied.
- Browser permission allowed.
- Email notification enabled.
- Email notification disabled.

Pass criteria:

- Notification bell updates realtime.
- Browser notification optional and non-blocking.
- Email notification uses correct from/reply-to.

### 10. Analytics And CSAT QA

Test cases:

- Conversations by date.
- CSAT submitted after resolved conversation.
- CSAT by channel.
- CSAT by agent.
- AI vs human CSAT.
- SLA pressure.
- Channel quality.
- Action quality.
- Empty state.
- 7D/30D/90D filters.

Pass criteria:

- Today’s date appears correctly.
- Graphs are not empty when data exists.
- Empty state is clear when no data exists.
- Time zone is correct via `ANALYTICS_TIME_ZONE`.

### 11. Marketing And Docs QA

Pages:

- `/`
- `/pricing`
- `/demo`
- `/contact`
- `/security`
- `/privacy`
- `/terms`
- `/docs`

Check:

- Light mode.
- Dark mode.
- Mobile.
- Tablet.
- Desktop.
- Header menu.
- Footer links.
- Forms.
- CTA links.
- Docs search.
- Screenshot theme switching.
- Broken links.

Pass criteria:

- No Lorem Ipsum.
- No “launch” internal planning copy visible to public.
- Product name is Tinfiz everywhere.
- No Roman Urdu/Hinglish in public product UI unless intentionally part of docs/internal notes.

### 12. Performance QA

Run:

- Lighthouse for marketing home.
- Lighthouse for pricing/demo/contact.
- Dashboard basic performance check.
- Widget load size check.
- API load test for analytics/reporting.

Existing script:

```bash
pnpm --filter @workspace/api load:reporting
```

Pass criteria:

- Home LCP acceptable.
- Widget script does not heavily slow customer website.
- Inbox typing does not cause unnecessary API flood.
- Analytics queries respond under acceptable time.

## Bug Finding Strategy

### Manual QA Matrix

Create one spreadsheet with columns:

- Area.
- Test case.
- Plan.
- Role.
- Browser.
- Device.
- Expected result.
- Actual result.
- Status.
- Severity.
- Screenshot/video.
- Issue link.

Severity:

- P0: blocks login, payment, data security, message delivery, major data loss.
- P1: core feature broken but workaround exists.
- P2: UI/UX issue, copy issue, edge case.
- P3: polish.

### Test Accounts

Create:

- Free admin.
- Starter admin.
- Pro admin.
- Scale admin.
- Agent user.
- Restricted team member.
- Second organization admin.

### Test Data

Use screenshot seed only for docs/marketing screenshots.

Before real launch:

- Clean demo seed data from production.
- Never mix fake customer data with real production orgs.
- Keep one internal “Tinfiz Demo” org for demos only.

## How To Track User-Specific Issues After Launch

### Minimum Data To Capture

Every support issue should include:

- User email.
- Organization ID.
- Organization name.
- Current page URL.
- Browser/device.
- Time of issue.
- Conversation ID if inbox/widget issue.
- Contact ID if contact issue.
- Action log ID if AI Action issue.
- Call ID if voice issue.
- Stripe customer/subscription ID if billing issue.
- Screenshot/video.

### Product-Level Debug IDs

Recommended to expose/copy:

- Conversation ID in inbox overflow menu.
- Contact ID in contact profile.
- Action log ID in action logs.
- Call ID in call details.
- Organization ID in settings.

This makes support much faster.

### Error Tracking Context

When adding Sentry/monitoring, attach:

- `user.id`
- `user.email`
- `org.id`
- `org.plan`
- `route`
- `conversationId`
- `release`

### User-Facing “Report Issue” Button

Recommended next feature:

- Add “Report issue” inside user menu.
- Automatically include current page, org ID, user ID, browser, and timestamp.
- Let user add message and screenshot manually.
- Send to contact webhook or internal issue tracker.

This is very useful after launch.

## Production Smoke Test Checklist

Run after every deploy.

### Web

- Open home page.
- Open pricing.
- Open docs.
- Login.
- Open dashboard.
- Switch org.

### API

- `/health` returns ok.
- TRPC call works.
- Authenticated route works.

### WebSocket

- Dashboard connects.
- Widget connects.
- New message appears in inbox realtime.

### Billing

- Free plan visible.
- Checkout opens.
- Stripe webhook receives event.

### AI

- Add text note.
- Ask widget a KB question.
- Ask unrelated question.
- Ask action-related question.

### Channels

- Email/WhatsApp/voice setup page loads.
- Disconnected state friendly.

### Forms

- Demo form sends.
- Contact form sends.

## Rollback Plan

Before launch:

- Keep previous deployment available.
- DB backup before migrations.
- Know how to disable risky features via env/plan flags.
- Keep AI Actions disabled/preview if issue appears.
- Keep channel webhooks reversible.

Rollback levels:

### Level 1 - Web Rollback

If marketing/dashboard UI breaks:

- Revert web deployment.
- API and DB untouched.

### Level 2 - API Rollback

If API breaks:

- Revert API deployment.
- Keep DB compatible.
- Avoid destructive migrations without reversible plan.

### Level 3 - Feature Disable

If feature breaks:

- Disable AI Actions execution.
- Disable email notifications.
- Disable WhatsApp webhook processing temporarily.
- Disable Vapi webhook processing temporarily.

### Level 4 - DB Restore

Only if data corruption/data loss:

- Stop writes.
- Restore latest backup.
- Announce maintenance.

## Suggested Immediate Next Work

Before public launch, I recommend these in order:

### 1. Add Sentry Or Equivalent Monitoring

Priority: P0

Build:

- Web error tracking.
- API error tracking.
- WebSocket error capture.
- User/org context.
- Release version.
- Source maps.

Why:

Without this, user issues will be hard to debug.

### 2. Add Sitemap, Robots, Not Found, Error Pages

Priority: P0

Build:

- `sitemap.ts`
- `robots.ts`
- `not-found.tsx`
- marketing `error.tsx`
- dashboard error boundary if missing.

Why:

Public marketing launch needs SEO and graceful failures.

### 3. Production Env Validation Script

Priority: P0

Build:

- Script that checks required env vars.
- Separate modes: staging, production.
- Warn optional envs.
- Fail missing critical envs.

Why:

Launch issues often come from missing env values.

### 4. Release Health Page/Internal Admin Checklist

Priority: P1

Build:

- Internal page only admin can access.
- Shows API health, WS health, Stripe config, AI key status, Redis status, webhook URLs presence, notification email config.

Why:

You can verify production readiness quickly.

### 5. User Issue Reporting Flow

Priority: P1

Build:

- “Report issue” button.
- Include org/user/page metadata.
- Send to webhook/email.

Why:

After launch users will report issues vaguely. Metadata saves time.

### 6. Add Basic Product Analytics For Marketing

Priority: P1

Build:

- Page views.
- Signup clicks.
- Demo form starts/submits.
- Pricing CTA clicks.
- Docs searches.

Tools:

- PostHog, Plausible, or simple server events.

Why:

You need to know where users drop before signup.

### 7. Final Docs Screenshot Pass

Priority: P1

Do:

- Add dark/light screenshots.
- Ensure filenames match docs.
- Remove placeholders from most important docs.
- Keep low-priority placeholders acceptable if clearly planned.

## Launch Decision Matrix

### Ready For Private Beta If

- Build/lint/typecheck pass.
- Staging migration passes.
- Login/signup/org works.
- Widget/inbox realtime works.
- AI answers from KB.
- Billing test mode works.
- Demo/contact forms work.
- No P0/P1 bugs open.

### Ready For Public Launch If

- Private beta runs without P0 bugs.
- Error tracking active.
- Uptime monitoring active.
- Stripe live mode verified.
- Webhooks verified.
- Backups and rollback plan ready.
- Privacy/terms/security reviewed.
- Marketing pages no placeholder/dummy visible.
- Docs enough for self-serve setup.

### Not Ready If

- No production monitoring.
- No DB backup.
- Realtime is unreliable.
- Billing guards inconsistent.
- AI answers ungrounded or unsafe.
- Widget script fails on real external site.
- Webhooks not reachable from providers.

## Final Recommendation

Mera honest recommendation:

Tinfiz ko ab **soft launch / private beta** ke liye ready samjha ja sakta hai after staging QA. Public paid launch se pehle monitoring, env validation, sitemap/robots/error pages, and production smoke tests zaroor complete karo.

Best next coding task:

1. Sentry/error tracking integration.
2. Sitemap/robots/not-found/error pages.
3. Production env validation script.
4. Internal health/checklist page.
5. User issue reporting flow.

In 5 cheezon ke baad project launch confidence bohat zyada strong ho jayega.

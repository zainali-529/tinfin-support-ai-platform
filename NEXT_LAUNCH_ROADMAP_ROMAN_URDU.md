# Next Launch Roadmap - Product, AI, Dashboard, Docs

Date: 2026-05-03  
Project: Tinfiz / SaaS Support Platform  
Mode: Launch ke liye practical roadmap, scratch se analysis

---

## Short Answer

Haan, marketing pages abhi simple, clean aur decent rakhna bilkul theek hai. Launch ke liye sab se important cheez ye hai ke dashboard, inbox, AI, widget, channels, billing, docs aur reliability strong ho. Marketing pages ko abhi over-animated ya flashy banane ki zaroorat nahi. Product agar strong hai to simple landing page bhi convert kar sakta hai.

Recommended approach:

- Marketing page abhi "clear promise + screenshots + pricing + docs + demo CTA" tak rakho.
- Dashboard aur product workflows ko launch se pehle polish karo.
- Docs ko seriously lo, kyun ke non-technical customers ke liye docs marketing se bhi zyada important honge.
- Facebook/Instagram channels ko launch se pehle add karna zaroori nahi, jab tak target audience e-commerce/social sellers na ho.
- AI ko grounded, measurable, debuggable aur channel-aware banana next biggest product value hai.

---

## Current Product Snapshot

Repo analysis ke hisaab se project MVP se kaafi aagay ja chuka hai. Current major areas:

- Dashboard: KPI, recent conversations, activity feed, operations overview.
- Unified inbox: chat, email, WhatsApp support, assignment, SLA/backlog, queue states, realtime improvements.
- Widget: advanced customization, light/dark settings, launcher placement, help items, suggestions, voice/call page, install wizard.
- Knowledge base: KB create/delete, URL/file/text ingestion, source delete, vector RAG, grounded answers.
- AI responses: RAG-based answer generation, handoff flow, language matching, out-of-scope guard.
- AI Actions v1: endpoint-based actions, secrets encryption, outbound allowlist, approvals/logs, templates/UI polish.
- Email channel: settings, inbound/outbound email messages, conversation mapping.
- WhatsApp channel: Meta Graph API setup, webhook token, messages, reply support.
- Voice assistant: Vapi assistant setup, calls, transcripts, call logs, widget calling UI.
- Contacts: contact CRUD, channel-wise conversations, contact conversation navigation fixes.
- Team/admin: organization switching, team invites, permissions, sidebar gating.
- Billing/usage: plan guards, usage page, billing cards, plan-based feature visibility.
- Analytics: premium graph-heavy analytics, demo seed/cleanup scripts.
- Widget installation: script embed plus platform detection/verification for Shopify, WordPress, Webflow, Wix, Squarespace, GTM, Segment, Next.js, React/custom.

This means launch focus ab "feature banana" se zyada "operational maturity, trust, docs, polish, and reliability" hona chahiye.

---

## Intercom / Fin Benchmark Summary

Official Intercom docs ke current benchmark se ye clear hai ke Intercom ka moat sirf live chat nahi hai. Unka strong system ye layers combine karta hai:

- Fin AI Agent: train, test, deploy, analyze loop.
- Fin Guidance: natural-language rules for brand voice, policies, escalation, source preference.
- Data Connectors: API-based live data lookup/action layer.
- Fin Tasks / Procedures: multi-step business processes with connectors, conditions, tools, and controlled execution.
- Omnichannel: Messenger, email, phone, WhatsApp, Facebook Messenger, Instagram, SMS, Slack, Discord.
- Inbox operations: team inboxes, views, routing, macros, workflows, SLAs, tickets.
- Reports: templates, custom reports, Fin performance, CSAT, SLA, teammate/team metrics.
- Outbound: chat/post messages, banners, email, product tours, tooltips, checklists, surveys, SMS, campaigns.
- Installation: JavaScript snippet, SPA support, WordPress, GTM, Shopify, Segment, mobile SDKs.

Important competitor insight:

Intercom jahan strong hai wahan usually 3 cheezain saath hoti hain:

- AI capability.
- Admin control.
- Reporting/feedback loop.

Tinfiz ko bhi har feature mein ye pattern follow karna chahiye: "AI works, admin controls it, analytics prove it."

---

## Launch Philosophy

Launch se pehle objective ye nahi hona chahiye ke har Intercom feature clone ho. Objective ye hona chahiye:

- Customer ko install karna easy lage.
- Customer support ka real workflow handle ho.
- AI hallucinate na kare.
- Human agent ko inbox mein clarity mile.
- Billing/limits confusing na hon.
- Errors visible aur recoverable hon.
- Docs customer ko unblock karein.

Launch promise tight rakho:

"AI-first customer support workspace with widget, inbox, knowledge base, AI replies, AI actions, email, WhatsApp, voice, analytics and team workflows."

Jo cheez promise karo woh stable honi chahiye. Jo unstable hai usay "preview", "beta", ya "coming next" mein rakho.

---

## Marketing Pages Guidance

### Kya abhi simple marketing pages enough hain?

Haan. Abhi simple enough hain, but simple ka matlab weak nahi. Simple marketing page ka kaam ye hona chahiye:

- Product kya karta hai 5 seconds mein clear ho.
- Primary value visible ho: AI support, unified inbox, widget, knowledge base, channels, actions.
- Product screenshots ya short GIFs hon.
- Pricing clear ho.
- Docs/install CTA ho.
- Demo/start trial CTA ho.

### Abhi over-focus nahi karna chahiye

Avoid:

- Heavy scroll animations.
- Too many abstract sections.
- Generic AI gradient hero.
- Feature claims jo product mein stable nahi.
- Long copy without screenshots.

### Minimum marketing routes for launch

P0:

- `/` home page.
- `/pricing`.
- `/docs`.
- `/docs/widget-install`.
- `/privacy`.
- `/terms`.
- `/contact` ya `/demo`.

P1:

- `/customers` ya case-study placeholder.
- `/changelog`.
- `/security`.
- `/compare/intercom` only jab product stable ho jaye.

### Marketing page layout recommendation

Home page:

- Hero: clear one-liner.
- Product screenshot: dashboard/inbox/widget.
- 4 core pillars: AI Agent, Unified Inbox, Knowledge Base, Actions/Automation.
- Channels: Web chat, Email, WhatsApp, Voice.
- Workflow: Install widget -> Add knowledge -> AI answers -> Human takes over -> Analytics improve.
- Pricing preview.
- Docs/demo CTA.

Keep it professional, not overdesigned.

---

## Should We Add Facebook and Instagram Before Launch?

### Recommendation

Default recommendation: not before launch.

Add Facebook Messenger and Instagram DM before launch only if your first customers are:

- E-commerce stores.
- Instagram shops.
- Social media heavy brands.
- Agencies handling DMs for clients.
- Businesses where support volume mostly comes from Meta channels.

Otherwise, launch with:

- Website widget.
- Email.
- WhatsApp.
- Voice.

Ye already strong channel coverage hai.

### Why not now?

Facebook/Instagram channels sirf UI label nahi hain. Production level mein chahiye:

- Meta app setup.
- OAuth/connect flow.
- Page/account selection.
- Webhook verification.
- Message receive/send.
- Attachment support.
- Rate limits.
- 24-hour reply window/platform policies.
- Conversation/contact matching.
- Failure/reconnect handling.
- Plan guards and channel settings.

Aapke schema/types mein future channel labels already available hain, lekin full routers/services missing hain. Is liye isay P2 channel expansion mein rakhna better hai unless ICP demands it.

### Best channel roadmap

P0 launch:

- Widget chat.
- Email.
- WhatsApp.
- Voice.

P1 after launch:

- Slack notifications/inbox alerts, not full Slack support.
- SMS only if customers ask.

P2:

- Instagram DM.
- Facebook Messenger.
- Shopify customer/order context.

---

## P0 Launch-Critical Work

Ye items launch se pehle highest priority hain. Inka direct impact trust, conversion, support quality aur retention par hoga.

### 1. Docs Center

Current project mein docs routes missing hain. Ye launch ke liye zaroori hai.

Build routes:

- `/docs`
- `/docs/getting-started`
- `/docs/widget-installation`
- `/docs/widget-customization`
- `/docs/knowledge-base`
- `/docs/unified-inbox`
- `/docs/email-channel`
- `/docs/whatsapp-channel`
- `/docs/voice-assistant`
- `/docs/ai-actions`
- `/docs/team-and-permissions`
- `/docs/billing-and-limits`
- `/docs/troubleshooting`
- `/docs/security`

Docs content should include:

- Step-by-step setup.
- Screenshots.
- Common errors.
- "How to test" sections.
- Plan requirements.
- Expected behavior.
- Troubleshooting commands.

Docs UI should include:

- Sidebar navigation.
- Search.
- Copy code button.
- Previous/next links.
- Last updated date.
- Callouts for plan requirements.

Why important:

Non-technical users marketing page se zyada docs se convert honge. Agar setup easy samajh aa gaya to support burden bhi kam hoga.

### 2. Product Onboarding Checklist

Dashboard par ek proper launch checklist honi chahiye.

Checklist:

- Create organization.
- Add widget profile.
- Install widget.
- Add first knowledge source.
- Test AI answer.
- Connect email.
- Connect WhatsApp.
- Invite team member.
- Configure SLA.
- Create first AI action.
- Send test conversation.

Each item should have:

- Status.
- CTA.
- Docs link.
- Test/verify action.

Current dashboard onboarding card ko aur operational banana chahiye.

### 3. Notification System

Agents ko pata chalna chahiye ke kya unke naam assign hua, SLA breach hua, ya human takeover required hai.

Build:

- In-app notifications table.
- Sidebar/topbar notification bell.
- Assigned-to-me notification.
- SLA at-risk/breached notification.
- New conversation notification.
- AI handoff request notification.
- Action approval request notification.

P0 notification channels:

- In-app.
- Browser notification optional.

P1:

- Email notification.
- Slack notification.

Why:

Inbox tab open na ho to bhi agent ko workload pata chale.

### 4. Inbox Saved Views

Intercom style operational workflow ke liye saved views bohat important hain.

Views:

- My open conversations.
- Unassigned.
- SLA at risk.
- SLA breached.
- Waiting for customer.
- Human takeover.
- Email only.
- WhatsApp only.
- AI handled.
- Actions failed.

Admin custom views P1 mein ja sakti hain, lekin P0 mein system views enough hain.

### 5. Internal Notes and Conversation Timeline

Customer support mein agents ko internal collaboration chahiye hoti hai.

Build:

- Internal notes in conversation.
- Notes not visible to customer.
- Timeline events:
  - Assigned to agent.
  - Status changed.
  - SLA changed/met/breached.
  - AI took over/released.
  - Action executed.
  - Contact updated.
  - Channel event received.

Why:

Human agents ko context milta hai aur debugging easy hoti hai.

### 6. AI Trust and Grounding UI

Backend grounded hai, but dashboard mein AI trust visible hona chahiye.

Build:

- AI answer sources visible in agent panel.
- Confidence badge.
- "No verified answer" count.
- Low-confidence conversations view.
- "Improve KB" CTA from failed answer.
- Agent can mark answer as helpful/not helpful.

Important:

Widget user ko internal source details na dikhani hon to optional. Agent dashboard mein zaroor dikhani chahiye.

### 7. Knowledge Base Source Health

Current KB works, but launch ke liye source health chahiye.

Build:

- Source list with status: indexed, failed, stale.
- Last indexed time.
- Chunk count.
- Re-index button.
- Delete source already added, keep it.
- URL recrawl.
- Sitemap ingestion P1.
- Duplicate source warning.
- Low quality source warning.

Why:

AI quality mostly KB quality par depend karegi.

### 8. Billing and Plan Accuracy QA

Billing already improved hai, but launch se pehle strict QA chahiye.

Check:

- Free plan preview labels consistent.
- Starter plan email/WhatsApp correctly unavailable.
- AI Actions preview behavior consistent.
- Upgrade prompts readable.
- Usage limits correctly show.
- Server-side guards match frontend UI.
- Org switch reload states stable.

Rule:

Frontend guard helpful hota hai, but server-side guard final authority hona chahiye.

### 9. Widget Production Polish

Widget is product ka front door hai.

P0 polish:

- Install verification reliable.
- Left/right placement correct.
- Mobile responsive.
- Expanded mode smooth.
- Dark/light theme stable.
- Help items accessible.
- Chat dedicated screen stable.
- Call UI professional.
- Offline/handoff state clear.
- CSAT after conversation close.
- Pre-chat form optional:
  - Name.
  - Email.
  - Phone optional.
  - Reason optional.

### 10. Launch QA and Error Handling

Build a pre-launch QA checklist:

- Empty states.
- Loading states.
- Error states.
- No org selected.
- Plan blocked.
- Channel disconnected.
- API key missing.
- Supabase realtime disconnected.
- AI provider missing/failure.
- Email webhook failure.
- WhatsApp token expired.
- Vapi key missing/failure.
- Action timeout/failure.

Every major page should have:

- Friendly error message.
- Retry button.
- Docs link where useful.

---

## P1 Strong Differentiator Work

Ye launch ke immediately baad ya agar time ho to launch se pehle add kar sakte ho. Ye product ko Intercom-lite se "AI-first support OS" banayenge.

### 1. AI Quality Center, But Simpler Than Before

Pehle Quality Center overcomplicated laga, so next version minimal rakho.

Build:

- Unanswered questions list.
- Low confidence answers.
- Human handoff reasons.
- KB improvement suggestions.
- Top missing topics.
- Agent rating of AI answers.

Do not add:

- Heavy AI profile.
- Too many guidance systems.
- Complex eval UI before data exists.

Better version:

"AI Improvements" page inside Knowledge Base:

- Failed question.
- Conversation link.
- Suggested KB note.
- Approve to add source.

### 2. Channel-Aware AI Behavior

Intercom Fin channel-specific deployment karta hai. Aapko bhi simple version chahiye.

Add settings:

- Chat tone: short, conversational.
- Email tone: structured, complete.
- WhatsApp tone: concise, friendly.
- Voice tone: very short, spoken.

Behavior:

- Same answer different channel mein different format.
- Email mein greeting/signature.
- WhatsApp mein shorter answer.
- Voice mein 1-2 sentence answer.

### 3. AI Action v1 Hardening

Actions v2 abhi remove hua tha, so v1 ko stable aur trustable banao.

Improve:

- Better action templates.
- Test action panel with example payloads.
- Action execution preview.
- Required parameter helper text.
- Logs with request/response/status/latency.
- Failure reasons readable.
- Retry button for failed safe actions.
- Approval queue polished.
- Secrets rotation UI.
- Domain allowlist UI.
- Action usage analytics.

Do not rebuild v2 yet.

V2 later should include:

- Connectors.
- Procedures.
- Step builder.
- Conditions.
- Temporary attributes.
- Dry-run simulator.
- Mock responses.
- Approval policies.

### 4. Customer Profile Timeline

Contacts page ko customer intelligence center banao.

Add:

- All conversations by channel.
- Contact timeline.
- Notes.
- Tags.
- Custom fields.
- Company/account association P2.
- Last seen / current page from widget.
- Conversation count.
- Satisfaction history.
- AI actions used for this contact.

Why:

Support team ko customer context instant milega.

### 5. CSAT and Feedback

Build:

- Widget CSAT after resolved conversation.
- Agent CSAT view.
- Fin/AI answer rating.
- Conversation rating comments.
- Analytics charts:
  - CSAT by channel.
  - CSAT by agent.
  - CSAT by AI vs human.

This is important because analytics tab currently performance-heavy hai, but customer satisfaction missing hai.

### 6. Agent Productivity Tools

Add:

- AI reply draft for human agents.
- Summarize conversation.
- Rewrite reply:
  - more friendly.
  - shorter.
  - more formal.
- Translate response.
- Suggested next action.
- Similar resolved conversations.

This competes with Intercom Copilot style value without building full Copilot.

### 7. Macros / Saved Replies

Canned replies remove kiye thay, but support product mein macros valuable hain.

Re-introduce later as "Macros", not canned replies.

Macro should support:

- Saved text.
- Variables like customer name.
- Optional actions:
  - assign.
  - label.
  - close.
  - snooze.

Keep it simple first.

### 8. Workflow Lite

Intercom Workflows bohat broad hain. Aapka first version simple ho.

Workflow triggers:

- New conversation.
- Channel is email/WhatsApp/chat.
- Message contains keywords.
- SLA at risk.
- Contact has tag.
- AI confidence low.

Actions:

- Assign team/member.
- Add label.
- Set priority.
- Send auto-reply.
- Require human.

This should come before full Actions v2 Procedures.

---

## P2 Expansion and Intercom-Parity Work

Ye items important hain but launch-critical nahi.

### 1. Facebook Messenger and Instagram DM

Add after launch if demand confirms.

Build:

- Meta OAuth.
- Page and Instagram account selection.
- Webhook setup.
- Incoming DMs, story replies, mentions if allowed.
- Outbound replies.
- Attachment/media support.
- Conversation/contact matching.
- Channel settings.
- Reconnect flow.
- Analytics by social channel.

### 2. SMS Channel

SMS useful hai but compliance heavy hai.

Need:

- Provider: Twilio or similar.
- Number setup.
- Consent management.
- Quiet hours.
- Segment count/cost display.
- One open SMS conversation per contact rule.

### 3. Public API and Webhooks

For advanced customers:

- Public API keys.
- Webhook subscriptions:
  - conversation.created
  - message.created
  - conversation.assigned
  - conversation.resolved
  - action.executed
  - contact.created
- API docs.
- Rate limits.
- Audit logs.

### 4. Apps and Integrations

Potential integrations:

- Shopify.
- Stripe.
- Calendly.
- Slack.
- HubSpot.
- Salesforce.
- Linear/Jira.
- Zapier/Make.

Start with:

- Shopify customer/order lookup.
- Stripe subscription lookup.
- Calendly booking link/action.
- Slack notifications.

### 5. Outbound and Product Tours

Intercom has strong outbound/product tours. Aap later add kar sakte ho:

- Targeted in-widget messages.
- Announcements.
- Banners.
- Product tours.
- Checklists.
- Surveys.

This is not required for support launch. Ye growth/engagement product line hai.

---

## Dashboard Pages - Next Improvements

Dashboard pages ko ab "beautiful screens" se zyada "daily operating system" banana hai.

### Dashboard Home

Add:

- Launch readiness score.
- Today workload by channel.
- SLA risk strip.
- AI handoff queue.
- Action failures needing review.
- Channel health:
  - widget installed.
  - email connected.
  - WhatsApp active.
  - voice active.
- Onboarding checklist with verification.
- Team availability status.

Remove or avoid:

- Vanity cards without action.
- Huge cards with little data.
- Duplicate metrics already in Analytics.

Dashboard home should answer:

- Kya support system healthy hai?
- Kahan immediate attention chahiye?
- Kis channel mein issue hai?
- AI kahan fail ho raha hai?
- Team workload kaisa hai?

### Inbox

Add:

- Saved views.
- Internal notes.
- Timeline events.
- Bulk actions.
- Snooze conversation.
- Priority.
- Tags/labels with management UI.
- Mention teammate.
- Assignment history.
- Collision warning if two agents reply.
- Reply draft autosave.
- Search across messages.

### Analytics

Already graph-heavy improve hua hai. Next add:

- AI resolution rate.
- Human takeover rate.
- Unanswered question trend.
- KB source usage.
- Action success/failure/latency trend.
- CSAT.
- First response SLA by channel.
- Team leaderboard.
- Agent workload.
- Channel mix.
- Conversation topics P1/P2.

### Knowledge Base

Add:

- Source health.
- Re-index.
- Sitemap crawl.
- Crawl schedule.
- Duplicate/conflict detection.
- Missing topic suggestions.
- Source priority.
- Source preview.
- KB test panel:
  - Ask question.
  - See retrieved chunks.
  - See answer.
  - See confidence.

### AI Actions

Keep v1, improve:

- Cleaner builder.
- Template gallery.
- Test/dry run per action.
- Logs table.
- Health card.
- Approval queue.
- Security settings:
  - allowlist.
  - secret keys.
  - confirmation required.
  - human approval required.
- Docs link inside page.

### Contacts

Add:

- Unified channel tabs are good; continue polishing.
- Contact merge.
- Contact tags.
- Custom fields.
- Contact activity timeline.
- Last conversation summary.
- Delete behavior already fixed, but keep testing widget/local session edge cases.

### Channels

Improve:

- Channel health page.
- Email:
  - DNS/auth status if possible.
  - inbound webhook status.
  - test inbound/outbound.
- WhatsApp:
  - token validity.
  - webhook status.
  - template message guidance.
- Widget:
  - install verification.
  - platform guide.
- Voice:
  - Vapi key health.
  - assistant sync status.

### Team

Add:

- Agent availability.
- Workload count.
- Assigned conversations.
- Permissions templates:
  - Admin.
  - Supervisor.
  - Agent.
  - Billing only.
- Invite resend.
- Transfer ownership.

### Billing

Add:

- Feature matrix.
- Current usage vs plan.
- Preview-mode explanation.
- Upgrade path.
- Plan guard consistency.
- "Why blocked" messages.

---

## AI Improvement Roadmap

AI ko aur strong karne ka best route ye hai ke aap "bigger prompt" nahi, "better AI system" banayein.

### P0: Grounded Answer Reliability

Keep:

- Answer only from KB.
- Out-of-scope fallback.
- Human handoff when answer missing.
- Same language reply.

Add:

- Source confidence visible to admin.
- Low confidence logging.
- Failed question storage.
- Admin can convert failed question to KB note.

Acceptance:

- "What is Stripe?" agar KB mein nahi hai to generic Stripe explanation nahi dena.
- "Tell me about your company" sirf tab answer kare jab KB mein company intro ho.
- Agar KB mein company intro hai to "which company?" unnecessary na poochay.
- Roman Urdu question ka Roman Urdu response.

### P1: Lightweight Guidance

Do not re-add heavy AI Profile yet.

Add simple "AI Instructions" per org:

- Brand tone.
- Forbidden claims.
- Escalation rules.
- Supported topics.
- Short answer style.

Important:

Guidance must not override grounding. Guidance should style and policy control kare, facts generate na kare.

### P1: AI Debugger for Admin

Add a test panel:

- Question.
- Retrieved sources.
- Confidence.
- Final answer.
- Reason for handoff.
- Which KB used.

This helps debugging without exposing internals to customers.

### P1: AI Agent Assist

For human agents:

- Draft reply.
- Summarize thread.
- Suggest label.
- Suggest status.
- Suggest action.
- Rewrite reply tone.

This gives immediate value even when AI cannot fully resolve conversation.

### P2: Eval Suite

Eval suite ka faida:

- Historical conversations se AI ko test karna.
- Regression catch karna.
- KB change ke baad check karna ke old answers break to nahi hue.
- Launch se pehle "safe to deploy" confidence.

Keep it internal/admin-only. Production users ko isay visible karna zaroori nahi unless power-user feature banana ho.

---

## AI Actions Roadmap

### Current best strategy

Actions v1 ko launch ke liye stable rakho. V2 later.

### Actions v1 launch quality

Must have:

- Secrets encrypted.
- Outbound domain allowlist.
- Requires confirmation for write actions.
- Human approval for risky actions.
- Logs with latency/status/error.
- Test action before enabling.
- Templates with docs.

### Strong v1 use cases

- Order status lookup.
- Subscription status lookup.
- Appointment availability lookup.
- Create support ticket in external system.
- Refund/cancel request with approval.
- Update customer attribute.
- Send internal notification.
- Check shipment ETA.

### Later Actions v2 direction

Intercom-style parity ke liye V2 should become:

- Connectors: reusable API definitions.
- Operations: read/write calls.
- Procedures: multi-step flows.
- Step builder: instruction, connector call, condition, approval, response.
- Temporary attributes: connector result values available in next step.
- Conditions: if plan is active, if order is delivered, if amount is below limit.
- Mock responses: test without real API.
- Dry-run simulator: execute procedure safely.
- Approval policies: write actions require approval.
- Health monitoring: success, fail, retry, latency.
- Templates: Shopify, Stripe, Calendly, custom REST.

But do not restart this before v1 is trusted.

---

## Docs Roadmap Detail

Docs launch ke liye must-have hain.

### Docs Information Architecture

`/docs`

- Product overview.
- Quick start.
- Choose your setup.

`/docs/getting-started`

- Create account.
- Create organization.
- Add widget.
- Add knowledge.
- Test AI.
- Invite team.

`/docs/widget-installation`

- Basic script.
- React/Next.js.
- Shopify.
- WordPress.
- Webflow.
- Wix.
- Squarespace.
- Google Tag Manager.
- Segment.
- Verify installation.
- Common issues.

`/docs/widget-customization`

- Theme.
- Position.
- Help items.
- Suggestions.
- Voice/call.
- Pre-chat settings.
- Branding.

`/docs/knowledge-base`

- Create KB.
- Add URL.
- Add file.
- Add text note.
- Delete source.
- Re-index source.
- Test AI.
- Best practices for writing KB content.

`/docs/unified-inbox`

- Conversation states.
- Assignment.
- Team workflows.
- SLA.
- Backlog.
- Human takeover.
- Internal notes.

`/docs/email-channel`

- Connect email.
- Inbound forwarding/webhook.
- Outbound send.
- Test.
- Troubleshooting.

`/docs/whatsapp-channel`

- Meta setup.
- Phone number ID.
- WhatsApp business ID.
- Access token.
- Webhook verify token.
- 24-hour window explanation.
- Test send/receive.

`/docs/voice-assistant`

- Add Vapi key.
- Configure assistant.
- Widget calling.
- Transcripts.
- Call logs.

`/docs/ai-actions`

- What actions are.
- Safe read action.
- Write action with confirmation.
- Secrets.
- Allowlist.
- Logs.
- Testing examples.

`/docs/billing-and-limits`

- Plans.
- Feature matrix.
- Preview mode.
- Upgrade.
- Usage.

`/docs/troubleshooting`

- Widget not appearing.
- AI no answer.
- Email not receiving.
- WhatsApp token error.
- Realtime delay.
- Action failed.
- Plan blocked.

### Docs style

- Write in English for customer-facing docs.
- Keep this roadmap Roman Urdu only because requested.
- Use screenshots/GIFs later.
- Every docs page should include "Expected result" and "Troubleshooting".

---

## Security and Reliability Before Launch

Add or verify:

- RLS policies for all tables.
- Server-side org scoping everywhere.
- Action outbound allowlist.
- Secret encryption.
- Webhook signature/verify tokens.
- Rate limits for public widget APIs.
- Abuse protection for chat widget.
- File upload size/type validation.
- PII redaction P1.
- Audit logs for admin actions.
- Error logging.
- Backup/rollback runbook.

### Public widget abuse control

Because widget public hota hai:

- Per visitor rate limit.
- Per org message limit.
- Bot/spam detection.
- Blocklist option.
- Max message length.
- Attachment restrictions if attachments added.

---

## What Not To Do Before Launch

Avoid:

- Full Facebook/Instagram unless customer demand confirmed.
- Rebuilding Actions v2 immediately.
- Heavy marketing animation work.
- Complex AI Profile system that breaks grounding.
- Product tours/outbound campaigns before support workflow stable.
- Too many plans and pricing complexity.
- Public API before internal API is stable.
- Over-designed dashboards with weak data.

Launch-ready product with fewer reliable features is better than huge product with confusing edges.

---

## Fast Execution Checklist

If aap fast agentic coding se execute karna chahte ho, recommended order:

1. Build docs routes and docs layout.
2. Add product onboarding checklist with verification.
3. Add in-app notifications.
4. Add inbox saved views.
5. Add internal notes and conversation timeline.
6. Add KB source health and re-index.
7. Add AI failed-question logging and admin improvement flow.
8. Add widget CSAT and pre-chat form.
9. Harden AI Actions v1 logs/test/templates.
10. Add channel health page.
11. Run launch QA checklist.
12. Polish marketing pages simply.

---

## Recommended Launch Feature Set

Launch page should confidently claim:

- AI website chat widget.
- Unified team inbox.
- Knowledge-base powered AI replies.
- Human takeover.
- Email channel.
- WhatsApp channel.
- Voice assistant/calls.
- AI Actions for API lookups and safe automations.
- Team assignment and permissions.
- SLA and queue tracking.
- Analytics and reporting.
- Widget customization.
- Installation wizard and verification.

Do not claim:

- Facebook/Instagram support until built.
- Fully autonomous workflows/procedures until V2 stable.
- Product tours/outbound campaigns until built.
- Enterprise-grade integrations until tested.

---

## Competitor Gap Matrix

| Area | Current Tinfiz Status | Intercom/Fin Benchmark | Priority |
| --- | --- | --- | --- |
| Web widget | Strong customization, install wizard | Mature Messenger, JS/API, apps | P0 polish |
| Unified inbox | Good base with channels, SLA, assignment | Team inboxes, views, workflows, tickets | P0/P1 |
| AI answers | Grounded RAG, handoff | RAG, Guidance, multilingual, inspection | P0/P1 |
| Knowledge | URL/file/text, vector search, source delete | Content library, suggestions, targeting | P1 |
| Actions | V1 API endpoints, secrets, approvals | Data connectors, Tasks, Procedures | P1 now, P2 V2 |
| Channels | Chat, email, WhatsApp, voice | Chat, email, phone, WhatsApp, social, SMS, Slack/Discord | P2 expansion |
| Analytics | Premium graphs | Custom reports, Fin reports, CSAT, SLA/team reports | P1 |
| Docs | Missing route structure | Full help center/docs | P0 |
| Outbound | Not built | Messages, tours, banners, surveys, SMS | P2 |
| Team ops | Invites/permissions, assignment | Team inboxes, macros, workflows, collision controls | P0/P1 |
| Customer profile | Contacts and conversations | Rich customer intelligence | P1 |
| Security | Good start | Mature privacy/security controls | P0/P1 |

---

## Final Recommendation

Ab next development ka most practical path ye hai:

- Marketing simple rakho, but docs strong banao.
- P0 launch-critical product polish karo.
- Dashboard ko operational command center banao.
- Inbox ko agent workflow ke liye mature karo.
- AI ko grounded + measurable + improvable banao.
- Actions v1 ko stable rakho, V2 baad mein karo.
- Facebook/Instagram ko P2 rakho unless first customers social-heavy hon.
- Launch ke baad real usage data se decide karo ke kaunsa channel/feature next highest ROI deta hai.

Best next build sprint:

1. Docs Center.
2. Notification System.
3. Inbox Saved Views + Internal Notes + Timeline.
4. AI Failed Questions + KB Improvement Flow.
5. Widget CSAT + Pre-chat Form.

Ye 5 cheezain product ko launch-ready aur professional feel dene mein sab se zyada help karengi.

---

## Official Sources Checked

- Intercom Fin AI Agent explained: https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained
- Intercom Fin Guidance: https://www.intercom.com/help/en/articles/10210126-provide-fin-ai-agent-with-specific-guidance
- Intercom Fin Tasks and Data Connectors: https://www.intercom.com/help/en/articles/9569407-fin-tasks-and-data-connectors-explained
- Intercom Fin Procedures: https://www.intercom.com/help/en/articles/13449439-building-fin-procedures
- Intercom channel deployment for Fin: https://www.intercom.com/help/en/articles/13377077-choose-channels-to-deploy-fin-ai-agent
- Intercom Inbox setup: https://www.intercom.com/help/en/articles/10223008-setting-up-the-inbox
- Intercom Reports: https://www.intercom.com/help/en/articles/200-intercom-reports-explained
- Intercom Outbound: https://www.intercom.com/help/en/articles/3292835-outbound-explained
- Intercom JavaScript installation: https://developers.intercom.com/installing-intercom/web/installation


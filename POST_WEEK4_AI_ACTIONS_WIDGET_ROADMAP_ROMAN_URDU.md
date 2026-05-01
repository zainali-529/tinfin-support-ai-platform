# Tinfin Post Week 4 Roadmap - AI, Actions, Widget Install, aur Next Product Direction

**Date:** 1 May 2026  
**Prepared For:** Tinfin AI Support Platform  
**Language:** Roman Urdu  
**Scope:** Week 1 se Week 4 tak jo launch-hardening improvements complete hui hain unke baad next best development direction.

---

## 1) Seedhi Baat - Ab Next Sabse Important Kya Hai

Aap ne Week 1 se Week 4 tak jo foundation build ki hai, woh ab normal MVP se kaafi aage ja chuki hai. Database baseline, inbox operations, routing/SLA, AI actions security, realtime improvements, AI collaboration, eval harness, reporting, aur launch hardening jaise core pieces project mein aa chuke hain.

Ab next work ka focus sirf aur dashboards banana nahi hona chahiye. Ab product ko Intercom-class feel dene ke liye 3 cheezen sabse zyada important hain:

1. **AI Identity + Guidance Layer**
2. **AI Actions v2 - Connectors + Procedures**
3. **No-code Widget Install + Verification**

Meri recommendation: agla sprint sabse pehle AI quality par hona chahiye, kyun ke user ka first impression widget aur AI answer se banta hai. Agar AI "tell me about your company" par confuse ho jaye to baqi dashboards strong hone ke bawajood customer ko product immature feel hota hai.

---

## 2) Week 1-4 Recheck - Project Ab Kahan Khara Hai

## 2.1 Week 1 - Security + DB + Assignment

**Status:** Mostly complete.

Already project mein ye cheezen visible hain:

- DB baseline/migration discipline establish ho chuka hai.
- `packages/db/drizzle` project-side source of truth ban raha hai.
- AI action secrets ke liye encryption/decryption/security layer present hai.
- Outbound domain allowlist action execution path mein present hai.
- Assign-agent dropdown aur team assignment UX par kaam ho chuka hai.

**Remaining hardening:**

- Secrets rotation UI add karni chahiye.
- Action secret last-used timestamp add karna chahiye.
- Allowlist ko per-action aur org-level dono modes mein expose karna chahiye.
- Assignment changes ki audit timeline har conversation mein visible honi chahiye.

## 2.2 Week 2 - Inbox Operations Core

**Status:** Core foundation implemented, product depth abhi grow karni hai.

Already project mein ye direction add hui hai:

- Routing engine v1.
- Queue states.
- Backlog indicators.
- SLA model and basic timers.
- Realtime assignment/typing/collaboration improvements.

**Remaining hardening:**

- Skill-based routing.
- Business-hours aware SLA.
- Assignment capacity limits per agent.
- Queue escalation rules.
- Bulk assign / bulk resolve / bulk label.
- Complete activity timeline.

## 2.3 Week 3 - AI Quality + Collaboration

**Status:** Strong foundation implemented, but AI maturity layer abhi zaroori hai.

Already project mein ye cheezen visible hain:

- Text Note ingestion real backend path se hoti hai.
- Historical replay eval harness script present hai.
- Voice/chat action parity improve hui hai.
- Collision/replying indicators direction implement hui hai.
- AI actions path mein confirmation/approval concept present hai.

**Important gap:** AI abhi "company representative" identity ko stable context ke taur par har prompt mein carry nahi kar raha. Isi wajah se generic questions, jaise "tell me about your company", weak ho sakte hain.

## 2.4 Week 4 - Reporting + Launch Hardening

**Status:** Reporting layer improve hui hai, launch runbook bhi present hai.

Already project mein ye cheezen aa chuki hain:

- SLA analytics.
- Assignee dashboards.
- Action analytics expansion.
- Load testing script/runbook.
- Rollback and QA checklist documentation.
- Analytics UI ko premium direction mein improve kiya gaya.

**Remaining hardening:**

- CSAT analytics.
- QA scorecards.
- Conversation topic trends.
- Action ROI analytics.
- AI answer quality dashboard.
- Source coverage dashboard.

---

## 3) Current AI Issue - "Tell Me About Your Company" Confusion Kyun Ho Rahi Hai

Aap ne knowledge base mein company introduction text note add kiya. Jab visitor ne widget par bola "tell me about your company", AI ne poocha "which company?".

Ye bug sirf ek prompt issue nahi hai. Ye 4-layer design issue hai:

1. **AI prompt mein organization identity stable form mein inject nahi ho rahi.**
2. **RAG retrieval sirf user query ke embedding par depend kar rahi hai.**
3. **Company intro text note normal KB chunk jaisa treat ho raha hai, pinned brand context jaisa nahi.**
4. **Generic words "your company", "about you", "who are you" ko company-intent mein rewrite nahi kiya ja raha.**

Current RAG prompt ka nature professional support assistant hai, lekin usmein yeh guarantee nahi ke assistant har request mein "main is organization ka representative hoon" context carry kare. Agar KB chunk retrieve nahi hota to AI safe side par clarification pooch leta hai.

**Correct behavior kya hona chahiye:**

Agar visitor poochay:

- "Tell me about your company"
- "What do you do?"
- "Who are you?"
- "Tell me about you"
- "Aapki company kya karti hai?"
- "Tum log kya provide karte ho?"

To AI ko automatically current organization ko refer karna chahiye. Usay "which company?" nahi poochna chahiye, jab tak customer kisi third-party company ka comparison na pooch raha ho.

---

## 4) AI Improvement Plan - Agent Jaisa Behavior Kaise Build Karna Hai

## 4.1 Organization AI Profile

Sabse pehla feature hona chahiye: **Organization AI Profile**.

Ye profile har AI response mein system context ke taur par inject honi chahiye.

Recommended fields:

| Field | Purpose |
|---|---|
| `company_name` | AI ko pata rahe ke woh kis company ko represent kar raha hai |
| `assistant_name` | Widget aur voice assistant ka naam |
| `company_summary` | Short intro jo "tell me about your company" mein use ho |
| `website_url` | Company website reference |
| `industry` | Contextual understanding |
| `target_customers` | Kis audience ko serve karte hain |
| `value_proposition` | Company ka core promise |
| `support_scope` | AI kin topics par help kar sakta hai |
| `do_not_answer_scope` | AI kin cheezon par answer na de |
| `brand_voice` | Friendly, formal, concise, premium, etc. |
| `default_language` | Default response language |
| `handoff_policy` | Kab human agent ko transfer karna hai |
| `formatting_style` | Short answers, bullets, step-by-step, tables |
| `forbidden_phrases` | Aisi phrases jo AI avoid kare |
| `example_good_answers` | Admin ke sample answers |
| `example_bad_answers` | Admin ke avoid examples |

**Implementation direction:**

- New DB table: `organization_ai_profiles`.
- Dashboard page: `AI Settings` ya `AI Training > Profile`.
- Profile complete na ho to onboarding checklist mein warning show ho.
- Chat, email, WhatsApp, voice, and actions prompt sab mein ye profile inject ho.

## 4.2 Company Profile as Pinned Knowledge

Company intro ko normal text note ki tarah treat nahi karna chahiye. Isko pinned source banana chahiye.

Recommended approach:

- Text note source type mein `company_profile` add karo.
- Admin ko option do: "Use this as company profile".
- Company profile chunks ko normal vector search ke ilawa identity questions mein always include karo.
- Agar `company_profile` missing ho to `organization_ai_profiles.company_summary` fallback use karo.

**Result:**

AI har generic identity question mein company ko correctly represent karega.

## 4.3 Query Intent Router

RAG se pehle ek lightweight intent router hona chahiye.

Recommended intents:

| Intent | Example |
|---|---|
| `company_identity` | "Tell me about your company" |
| `product_overview` | "What do you offer?" |
| `pricing` | "How much does it cost?" |
| `support_policy` | "Do you offer refunds?" |
| `technical_issue` | "Widget is not loading" |
| `account_action` | "Cancel my plan" |
| `order_action` | "Where is my order?" |
| `human_handoff` | "I want to talk to a person" |
| `small_talk` | "Hi, how are you?" |
| `out_of_scope` | "Who won the match yesterday?" |

For generic company questions, router should rewrite:

`tell me about your company`

into:

`Explain the company overview, products, value proposition, and support scope for {company_name}.`

**Important rule:**

AI should not ask "which company?" if current organization profile exists.

## 4.4 Retrieval Improvements

Current semantic retrieval useful hai, lekin AI support agents ke liye sirf vector search enough nahi hota.

Recommended retrieval stack:

- Vector search.
- Keyword/BM25 search.
- Source boosting.
- Pinned source injection.
- Recency/version boosting.
- Audience filtering.
- Channel filtering.

Source boosting example:

| Source Type | Boost |
|---|---|
| `company_profile` | Very high for identity questions |
| `policy` | High for refund/pricing/shipping |
| `product_doc` | High for product questions |
| `troubleshooting` | High for technical issues |
| `old_import` | Lower if stale |

## 4.5 Better Prompt Contract

AI prompt ko generic "helpful support assistant" se aage le jana hoga.

Recommended response contract:

- Tum current company ke official support assistant ho.
- "Your company", "you", "your team", "this business" ka matlab current organization hai.
- Agar company profile available hai to identity questions ka direct answer do.
- Sirf tab clarification poochna jab user ne truly ambiguous third-party comparison poocha ho.
- Same language mein answer do.
- Simple answer first, extra details baad mein.
- Facts sirf org profile, KB, conversation history, ya action result se do.
- Agar source mein data missing hai to gap clearly batao aur helpful next question poochho.

## 4.6 AI Formatting Standards

AI ka answer structure consistent hona chahiye.

Recommended formats:

| User Query Type | AI Format |
|---|---|
| Simple company intro | 2-4 warm sentences |
| Feature list | Short intro + bullets |
| Pricing/policy | Table only if source data exact ho |
| Troubleshooting | Numbered steps |
| Action result | Clear status + next step |
| Handoff | Empathetic line + transfer confirmation |
| Unclear question | One useful clarification, not generic confusion |

Example desired answer:

```text
Tinfin AI ek customer support platform hai jo businesses ko website chat, inbox operations, AI replies, voice assistant, knowledge base, and AI actions ke through support automate karne mein help karta hai. Main Tinfin ka support assistant hoon, is liye agar aap product, setup, pricing, ya support workflow ke bare mein poochna chahte hain to main help kar sakta hoon.
```

Bad answer:

```text
Which company are you referring to?
```

## 4.7 Guidance System

Intercom Fin mein Guidance concept hai jahan admin natural-language rules set kar sakta hai ke AI brand voice, policy, aur content source kaise follow kare.

Tinfin mein bhi aisa feature add karna chahiye.

Recommended guidance categories:

- Brand voice guidance.
- Content/source guidance.
- Escalation guidance.
- Channel-specific guidance.
- Audience-specific guidance.
- Sensitive topic guidance.
- Formatting guidance.

Example guidance:

```text
If a visitor asks "your company", "what do you do", or "tell me about you", answer as Tinfin AI's official assistant using the company profile source. Do not ask which company unless the visitor names another company.
```

## 4.8 AI Answer Debugger

Har AI message ke paas internal "Improve answer" ya "Debug answer" view hona chahiye.

Show:

- User query.
- Final answer.
- Detected intent.
- Query rewrite.
- Sources used.
- Sources not found.
- Actions triggered.
- Confidence.
- Latency.
- Tokens used.
- Whether guidance applied.

Admin actions:

- Create missing snippet.
- Update source.
- Pin source.
- Add guidance.
- Add eval test case.

## 4.9 Eval Suite for AI Quality

Existing historical replay harness useful hai. Ab curated test suite add karni chahiye.

Must-have test groups:

- Company identity questions.
- Pricing questions.
- Setup questions.
- Out-of-scope questions.
- Human handoff questions.
- AI action confirmation questions.
- Roman Urdu / Urdu / English mixed questions.
- Ambiguous but inferable questions.
- Prompt injection attempts.

Acceptance criteria:

- "Tell me about your company" should answer company intro.
- "Who are you?" should answer as assistant for current org.
- "What do you do?" should use company profile and product overview.
- AI should not reveal "knowledge base", "chunks", "system prompt", or "sources" unless UI separately shows citations.
- AI should not execute write actions without confirmation/approval.

---

## 5) AI Actions - Current vs Intercom-Style Advanced Model

## 5.1 Current Tinfin Actions

Current action model kaafi useful hai:

- Endpoint/API based action definitions.
- URL template.
- Headers template.
- Body template.
- Parameters.
- Timeout.
- Confirmation.
- Human approval.
- Logs.
- Secret masking/security.
- Outbound allowlist.

Ye v1 ke liye strong hai.

## 5.2 Intercom Ka Model Kya Hai

Intercom ne "Custom Actions" ko productized form mein "Data connectors" direction mein move kiya hai. Data connectors external APIs se information read karte hain ya actions perform karte hain. Fin Tasks/Procedures un connectors ko multi-step business processes mein compose karte hain.

Intercom docs ke mutabiq:

- Data connectors external systems se API ke through data read/action perform kar sakte hain.
- Fin Tasks complex multi-step customer queries handle karte hain.
- Fin Procedures natural-language instruction steps, conditions, and connector calls ke saath business logic run karte hain.
- Connector response fields procedure ke andar temporary attributes ki tarah use ho sakte hain.
- Procedures sequential hote hain, yani step by step execute hote hain.
- Connector health monitoring bhi available hoti hai.

## 5.3 Tinfin Actions v2 - Recommended Architecture

Tinfin ko endpoint actions se aage le ja kar 4-layer model banana chahiye:

| Layer | Purpose |
|---|---|
| Connectors | External systems ka reusable connection |
| Operations | Connector ke andar specific API call |
| Procedures | Multi-step AI-driven workflow |
| Runs/Observability | Execution logs, latency, retries, failures |

## 5.4 Connectors

Connector ek reusable integration object hona chahiye.

Examples:

- Shopify connector.
- Stripe connector.
- Calendly connector.
- HubSpot connector.
- Internal REST API connector.
- Statuspage connector.
- Custom webhook connector.

Recommended connector fields:

- Name.
- Description.
- Base URL.
- Auth type.
- OAuth connection.
- Secret references.
- Allowed domains.
- Rate limits.
- Environment: test/production.
- Health status.
- Last successful run.
- Last failed run.

## 5.5 Operations

Operation connector ke andar ek specific API action hota hai.

Examples:

- Get order status.
- Cancel order.
- Create refund request.
- Get subscription plan.
- Update appointment.
- Create support ticket.

Recommended operation fields:

- Operation key.
- Method.
- Path template.
- Input JSON schema.
- Output JSON schema.
- Safety level: read, write, destructive.
- Confirmation required.
- Human approval required.
- Idempotency key template.
- Retry policy.
- Timeout.
- Response formatter.

## 5.6 Procedures

Procedure multi-step workflow hota hai.

Example: "Cancel order"

Steps:

1. Collect order ID if missing.
2. Call `get_order`.
3. If order shipped, explain cannot cancel and offer return policy.
4. If order not shipped, ask confirmation.
5. Call `cancel_order`.
6. Send final confirmation.
7. Log outcome.

Procedure step types:

- Instruction.
- Ask user.
- Collect input.
- Validate input.
- Call operation.
- Condition.
- Code transform.
- Confirmation.
- Human approval.
- Handoff.
- Respond.

## 5.7 Action Simulator

Actions v2 mein simulator must-have hai.

Simulator should support:

- Mock response.
- Real test call.
- Dry run without writing data.
- Sample conversation.
- Expected tool trigger.
- Step-by-step trace.
- Validation errors.

## 5.8 Action Safety

Write/destructive actions ke liye strict rules:

- Always confirmation.
- Idempotency key.
- Audit log.
- Retry only if safe.
- Human approval for refunds/cancellations/account deletion.
- Domain allowlist.
- Secret never shown in logs.
- Response schema validation.
- Rate limit.
- Circuit breaker after repeated failures.

## 5.9 Action Analytics

Current action analytics ko aur expand karna chahiye:

- Success rate.
- Failure rate.
- Retry rate.
- Average latency.
- p95 latency.
- Most triggered actions.
- Most failed actions.
- Approval wait time.
- Confirmation drop-off.
- Automation saved time.
- Human fallback after action failure.
- Revenue/order/refund impact if relevant.

---

## 6) Widget Embedding - Humara Model vs Intercom

## 6.1 Humara Current Widget Install

Current Tinfin widget embed simple aur correct direction mein hai:

```html
<script
  src="https://cdn.tinfin.com/widget.js"
  data-org-id="YOUR_ORG_ID"
  async
></script>
```

Current widget loader:

- Script tag se `data-org-id` read karta hai.
- Legacy `data-organization-id` bhi support karta hai.
- Optional `data-color`, `data-company`, `data-position` read karta hai.
- Shadow DOM host create karta hai.
- React widget mount karta hai.

Ye Intercom-style embeddable widget ke basic pattern jaisa hi hai.

## 6.2 Intercom Widget Kaise Install Hota Hai

Intercom official docs ke mutabiq web install ke liye multiple options hain:

- Basic JavaScript snippet.
- Single-page app setup.
- WordPress.
- Google Tag Manager.
- Shopify.
- Segment.
- Rails gem.

Basic JavaScript pattern mein Intercom workspace/app ID set hoti hai, `window.intercomSettings` define hota hai, aur widget script async load hoti hai. SPA ke liye `Intercom('boot')`, `Intercom('update')`, aur logout par `Intercom('shutdown')` type methods use hote hain.

## 6.3 Tinfin Ko Next Widget API Kya Add Karni Chahiye

Tinfin ko script tag ke saath programmatic JS API bhi deni chahiye.

Recommended API:

```js
window.Tinfin('boot', {
  orgId: 'org_id',
  user: {
    id: 'user_123',
    email: 'customer@example.com',
    name: 'Customer Name'
  },
  company: {
    id: 'company_123',
    name: 'Acme Inc'
  }
})

window.Tinfin('update', {
  pageUrl: window.location.href,
  plan: 'pro'
})

window.Tinfin('shutdown')
window.Tinfin('show')
window.Tinfin('hide')
window.Tinfin('openNewMessage', 'I need help with...')
window.Tinfin('trackEvent', 'checkout_started', { value: 120 })
```

## 6.4 Why JS API Zaroori Hai

Sirf `data-org-id` anonymous visitor ke liye fine hai. Lekin SaaS customers ke liye ye enough nahi:

- Logged-in user identity pass karni hoti hai.
- Email/name/customer ID link karna hota hai.
- SPA route changes par update karna hota hai.
- Logout par session clear karna hota hai.
- User plan/company attributes pass karne hote hain.
- Product events track karne hote hain.
- Messenger show/hide programmatically karna hota hai.

## 6.5 Identity Verification

Logged-in users ke liye HMAC identity verification add karni chahiye.

Reason:

Without verification koi bhi frontend se kisi aur email/user ID ka impersonation kar sakta hai.

Recommended approach:

- Customer backend generates `user_hash`.
- Hash uses org secret + user ID/email.
- Widget boot payload includes `userHash`.
- Tinfin backend verifies before linking conversation to contact.

## 6.6 Widget Install Verification

Dashboard mein "Verify installation" button hona chahiye.

Verification checks:

- URL reachable hai ya nahi.
- HTML mein Tinfin script present hai ya nahi.
- `data-org-id` correct hai ya nahi.
- Script CDN load ho raha hai ya nahi.
- Widget config API hit ho rahi hai ya nahi.
- Realtime websocket connect ho raha hai ya nahi.
- Test message inbox mein aa raha hai ya nahi.

---

## 7) Non-Technical User - Kya Sirf URL Dene Se Auto Install Ho Sakta Hai?

Short answer: **Random website par sirf URL de kar script automatically paste karna possible nahi hota**, jab tak user ne humein platform/CMS/GTM/hosting account ki permission na di ho.

Reason:

- Browser aur web security kisi third-party ko arbitrary website source code modify karne nahi deti.
- Legal/security wise bhi bina owner authorization script inject karna allowed nahi.
- Static website, Shopify, WordPress, Webflow, Wix, Squarespace sab ke install mechanisms different hote hain.

Lekin non-technical users ke liye better options ban sakte hain.

## 7.1 Best No-Code Install Options

| Option | Best For | User Experience |
|---|---|---|
| Google Tag Manager | Marketing teams | Connect GTM, choose container, publish tag |
| WordPress Plugin | WordPress users | Install plugin, connect Tinfin |
| Shopify App | Shopify stores | Install app, enable widget embed |
| Webflow App/Guide | Webflow sites | Connect or guided custom code |
| Wix/Squarespace App | Site builders | Marketplace/app-based install |
| Cloudflare Zaraz/Worker | Advanced no-code/semi-code | Add via Cloudflare account |
| Email developer | Non-technical founder | Send snippet to developer |
| Concierge install | Paid plan | Tinfin team installs for customer |

## 7.2 URL-Based Platform Detector

Tinfin can ask:

```text
Enter your website URL
```

Then backend scans public HTML and detects:

- WordPress signals: `wp-content`, generator meta.
- Shopify signals: `cdn.shopify.com`, Shopify theme scripts.
- Webflow signals: `webflow.js`.
- Wix signals: Wix assets.
- Squarespace signals.
- GTM installed or not.
- Existing script conflicts.

Then UI says:

```text
We detected Shopify. Install Tinfin through our Shopify app for one-click setup.
```

Ya:

```text
We detected Google Tag Manager. Connect GTM and we can add the widget tag for you.
```

## 7.3 Google Tag Manager Integration

This should be first no-code integration.

Flow:

1. User enters website URL.
2. Tinfin detects GTM container.
3. User connects Google account through OAuth.
4. User selects GTM account/container/workspace.
5. Tinfin creates Custom HTML tag with widget snippet.
6. Tinfin attaches Window Loaded trigger.
7. User previews.
8. User publishes or Tinfin requests publish permission.
9. Tinfin verifies install.

## 7.4 WordPress Plugin

Flow:

1. User installs Tinfin plugin from WordPress.
2. User clicks "Connect Tinfin".
3. OAuth or API key connects org.
4. Plugin injects widget snippet via `wp_footer`.
5. Plugin supports logged-in user identity.
6. Tinfin dashboard verifies installation.

## 7.5 Shopify App

Flow:

1. Merchant installs Tinfin Shopify app.
2. App creates/enables app embed.
3. Widget loads on storefront.
4. Shopify customer/order data can become action connector data.
5. AI can answer order-status questions with connector permission.

## 7.6 Best Recommendation for Starter Plan

For non-technical starter users, build this install wizard:

1. Enter website URL.
2. Detect platform.
3. Show best install path.
4. Offer one-click GTM/WordPress/Shopify if available.
5. If custom site, show copy snippet + "Email developer" button.
6. Verify installation automatically.

This is realistic, safe, and product-quality.

---

## 8) Next Development Roadmap - Recommended Priority

## Phase 1 - AI Identity and Guidance Sprint

**Priority:** P0  
**Why:** Current AI quality ka biggest visible gap yehi hai.

Build:

- Organization AI Profile table.
- AI Profile dashboard UI.
- Company Profile pinned source.
- Query intent router.
- Query rewrite for identity/company questions.
- Prompt contract update for chat + voice + actions.
- Curated eval suite.
- AI answer debugger MVP.

Acceptance criteria:

- "Tell me about your company" direct company intro deta hai.
- "Who are you?" current org assistant ke taur par answer deta hai.
- "What do you do?" product/company overview deta hai.
- Roman Urdu mixed questions mein same language response deta hai.
- AI "which company?" nahi poochta unless truly ambiguous third-party context ho.

## Phase 2 - Knowledge Quality Center

**Priority:** P0/P1  
**Why:** AI ka output content quality par depend karta hai.

Build:

- Source health dashboard.
- Missing answer topics.
- Stale source detector.
- Duplicate source detector.
- Source type tagging.
- Pinned sources.
- Source usage analytics.
- "Create snippet from failed answer" flow.
- "Add to eval suite" flow.

Acceptance criteria:

- Admin ko pata chale AI kis source se answer de raha hai.
- Failed answer se directly new snippet/guidance create ho sakay.
- Company profile source always available ho.

## Phase 3 - Widget Install Wizard + JS API

**Priority:** P0/P1  
**Why:** Non-technical adoption ke liye installation friction kam karni hogi.

Build:

- `window.Tinfin()` JS API.
- `boot`, `update`, `shutdown`, `show`, `hide`, `trackEvent`.
- Logged-in user identity.
- HMAC user verification.
- Platform detector.
- Install verification.
- Email developer flow.
- GTM integration MVP.

Acceptance criteria:

- Anonymous and logged-in both modes work.
- SPA route update supported.
- Logout session clear hota hai.
- Dashboard verify install kar sakta hai.
- GTM install without code possible ho.

## Phase 4 - AI Actions v2

**Priority:** P1  
**Why:** Ye Intercom Fin Data Connectors/Procedures parity ka route hai.

Build:

- Connectors.
- Operations.
- Procedures.
- Procedure step builder.
- Mock/test responses.
- Dry-run simulator.
- Temporary attributes.
- Conditions.
- Approval policies.
- Action health monitoring.
- Templates for Shopify/Stripe/Calendly/custom REST.

Acceptance criteria:

- Admin simple API connector bana sakta hai.
- Admin multi-step procedure create kar sakta hai.
- AI procedure ko conversation mein reliably execute kar sakta hai.
- Write action confirmation/approval ke bina execute nahi hota.
- Simulator production se pehle procedure test kar sakta hai.

## Phase 5 - Automation Rules Engine

**Priority:** P1  
**Why:** Intercom/Zendesk/Front class operations ke liye rules zaroori hain.

Build:

- Trigger/condition/action builder.
- Examples: new conversation, SLA at risk, tag added, assigned to team, customer inactive.
- Actions: assign, tag, priority, send message, notify teammate, call webhook, trigger AI procedure.
- Time-based automation.
- Rule audit logs.

Acceptance criteria:

- Admin no-code rules bana sakta hai.
- Inbox work automatically route/label/escalate hota hai.

## Phase 6 - Customer Experience Layer

**Priority:** P1/P2  
**Why:** Launch ke baad quality measure karni hogi.

Build:

- CSAT survey.
- Conversation rating.
- Agent QA scorecards.
- AI answer rating.
- Negative feedback analysis.
- Customer sentiment.
- Topic trends.

Acceptance criteria:

- Team ko pata chale customers happy hain ya nahi.
- AI/agent quality measurable ho.

## Phase 7 - Integrations Marketplace

**Priority:** P2  
**Why:** SaaS scale ke liye ecosystem important hai.

Build:

- Shopify.
- Stripe.
- Slack.
- HubSpot.
- Salesforce.
- Jira.
- Linear.
- Calendly.
- Zapier/Make.
- Webhooks.

Acceptance criteria:

- Common business workflows no-code/semi-code connect ho sakay.

---

## 9) Recommended Immediate Sprint - Agar Aaj Se Start Karna Ho

Meri strong recommendation ye hai ke next sprint ka title ho:

**AI Agent Maturity + Install Friction Reduction**

## Sprint Goals

- AI ko current company ka representative banane wala stable identity layer.
- Generic company questions solve.
- AI guidance and formatting controls.
- Widget install ko non-technical users ke liye easier banana.
- Actions v2 ka design groundwork.

## Sprint Tasks

| Priority | Task | Files/Areas |
|---|---|---|
| P0 | Organization AI Profile schema | `packages/db/src/schema.ts`, migrations |
| P0 | AI Profile settings UI | `apps/web` dashboard |
| P0 | Inject org profile into RAG prompt | `packages/ai/src/rag.service.ts` |
| P0 | Inject org profile into actions prompt | `packages/ai/src/actions.service.ts` |
| P0 | Company identity intent router | `packages/ai/src` |
| P0 | Pinned company profile source | `packages/ai/src/ingest.service.ts`, KB UI |
| P0 | Eval tests for identity questions | `apps/api/src/scripts/eval-*` |
| P1 | AI answer debugger MVP | Inbox AI message UI + API |
| P1 | Widget JS API design | `apps/widget/src/main.ts` |
| P1 | Install verifier API | `apps/api` + widget dashboard |
| P1 | Platform detector | `apps/api` |
| P1 | Actions v2 schema draft | DB + AI package |

## Sprint Acceptance Criteria

- 20 curated AI tests pass.
- Generic company questions no longer ask "which company?".
- Widget can boot with anonymous and logged-in modes.
- Dashboard can detect if widget script exists on provided URL.
- Actions v2 DB/design documented and ready for implementation.

---

## 10) Suggested DB Tables for Next Work

## 10.1 `organization_ai_profiles`

Purpose: AI ka stable identity, brand voice, and policy profile.

Fields:

- `id`
- `org_id`
- `assistant_name`
- `company_name`
- `company_summary`
- `website_url`
- `industry`
- `target_customers`
- `value_proposition`
- `support_scope`
- `out_of_scope`
- `brand_voice`
- `default_language`
- `formatting_style`
- `handoff_policy`
- `forbidden_phrases`
- `good_answer_examples`
- `bad_answer_examples`
- `created_at`
- `updated_at`

## 10.2 `ai_guidance_rules`

Purpose: Natural-language guidance rules like Intercom Fin Guidance.

Fields:

- `id`
- `org_id`
- `name`
- `category`
- `condition_text`
- `guidance_text`
- `source_ids`
- `audience_rules`
- `channel`
- `priority`
- `is_active`
- `created_at`
- `updated_at`

## 10.3 `ai_eval_cases`

Purpose: Curated AI quality tests.

Fields:

- `id`
- `org_id`
- `name`
- `input_message`
- `expected_intent`
- `expected_contains`
- `forbidden_contains`
- `required_source_type`
- `language`
- `channel`
- `is_active`
- `created_at`
- `updated_at`

## 10.4 `ai_answer_traces`

Purpose: Debugger ke liye trace.

Fields:

- `id`
- `org_id`
- `conversation_id`
- `message_id`
- `query`
- `detected_intent`
- `rewritten_query`
- `sources_used`
- `guidance_used`
- `actions_used`
- `confidence`
- `latency_ms`
- `tokens_used`
- `model`
- `created_at`

## 10.5 `action_connectors`

Purpose: Reusable external system connection.

Fields:

- `id`
- `org_id`
- `name`
- `description`
- `connector_type`
- `base_url`
- `auth_type`
- `secret_ref`
- `allowed_domains`
- `rate_limit`
- `environment`
- `status`
- `created_at`
- `updated_at`

## 10.6 `action_operations`

Purpose: Connector ke andar specific API operation.

Fields:

- `id`
- `org_id`
- `connector_id`
- `operation_key`
- `display_name`
- `description`
- `method`
- `path_template`
- `input_schema`
- `output_schema`
- `safety_level`
- `requires_confirmation`
- `human_approval_required`
- `idempotency_key_template`
- `retry_policy`
- `timeout_seconds`
- `response_template`
- `is_active`
- `created_at`
- `updated_at`

## 10.7 `action_procedures`

Purpose: Multi-step AI process.

Fields:

- `id`
- `org_id`
- `name`
- `description`
- `trigger_description`
- `status`
- `version`
- `created_at`
- `updated_at`

## 10.8 `action_procedure_steps`

Purpose: Procedure ke ordered steps.

Fields:

- `id`
- `org_id`
- `procedure_id`
- `step_order`
- `step_type`
- `instruction`
- `config`
- `next_step_rules`
- `created_at`
- `updated_at`

## 10.9 `widget_installations`

Purpose: Install verification and platform detection.

Fields:

- `id`
- `org_id`
- `website_url`
- `detected_platform`
- `install_method`
- `script_found`
- `org_id_match`
- `last_verified_at`
- `last_error`
- `status`
- `created_at`
- `updated_at`

---

## 11) What Not To Do

Avoid these mistakes:

- Sirf embeddings par company identity rely na karo.
- AI ko company profile ke bina launch na karo.
- "Your company" type queries par clarification-first behavior na rakho.
- Write actions bina confirmation ke na chalne do.
- External API response ko validate kiye bina final answer mein use na karo.
- Random URL par bina authorization auto script inject karne ki koshish na karo.
- Widget logged-in identity bina HMAC verification ke trust na karo.
- Dashboard features banate rehna, lekin AI answer quality ignore karna.

---

## 12) Final Recommendation

Aap ka next best move:

1. **AI Identity + Guidance Layer build karo.**
2. **Company Profile ko pinned knowledge source banao.**
3. **Query intent router and rewrite add karo.**
4. **AI eval cases add karo, especially "your company" and Roman Urdu cases.**
5. **Widget JS API + install verification start karo.**
6. **Actions v2 ka connector/procedure architecture design implement karo.**

Is order mein kaam karne se product ka customer-facing quality jump sabse zyada hoga. Dashboard aur reporting already strong direction mein hain; ab AI ko "generic chatbot" se "trained company support agent" banana zaroori hai.

---

## 13) Sources Used for Intercom Comparison

Official Intercom sources:

- Intercom web installation docs: https://developers.intercom.com/installing-intercom/web/installation
- Intercom JavaScript API methods: https://developers.intercom.com/installing-intercom/web/methods
- Install Intercom with Google Tag Manager: https://www.intercom.com/help/en/articles/2631808-install-intercom-with-google-tag-manager
- Install Intercom on WordPress: https://www.intercom.com/help/en/articles/173-install-intercom-on-your-wordpress-site
- Install the Shopify App: https://www.intercom.com/help/en/articles/16188-install-the-shopify-app
- Fin Tasks and Data connectors explained: https://www.intercom.com/help/en/articles/9569407-fin-tasks-and-data-connectors-explained
- How to set up data connectors: https://www.intercom.com/help/en/articles/9916497-how-to-set-up-data-connectors
- How to use data connectors in Fin Procedures: https://www.intercom.com/help/en/articles/13459820-how-to-use-data-connectors-in-fin-procedures
- Fin Procedures explained: https://www.intercom.com/help/en/articles/12495167-fin-procedures-explained
- Provide Fin AI Agent with specific guidance: https://www.intercom.com/help/en/articles/10210126-provide-fin-ai-agent-with-specific-guidance
- Debug Fin AI Agent answers: https://www.intercom.com/help/en/articles/8403222-debug-fin-ai-agent-answers
- Batch test Fin AI Agent: https://www.intercom.com/help/en/articles/10521711-batch-test-fin-ai-agent
- Knowledge sources for AI agents: https://www.intercom.com/help/en/articles/9440354-knowledge-sources-to-power-ai-agents-and-self-serve-support


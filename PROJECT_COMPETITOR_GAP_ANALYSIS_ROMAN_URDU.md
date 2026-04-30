# Tinfin AI Support Platform - Deep Audit, Competitor Gap Analysis, aur 1 Month Execution Plan (Roman Urdu)

**Date:** 30 April 2026  
**Prepared For:** Tinfin Launch Prep (80% complete phase)  
**Language Note:** Is document ko Roman Urdu style mein likha gaya hai.

---

## 0) Scope aur Important Assumption

- Aap ne "Fund AI" bola tha. Maine isko **Front AI** assume kiya hai, kyun ke support-stack context mein yeh natural competitor banta hai.
- Intercom ke under **Fin AI** ko alag depth mein cover kiya gaya hai.
- Analysis do sources pe based hai:
  - Aap ka current codebase audit
  - Official competitor docs (Intercom, Front, Zendesk)

---

## 1) Executive Snapshot (Seedhi Baat)

Aap ka product already strong v1 stage pe hai. Aap ne sirf UI nahi, real infra wali cheezen bana li hain:

- Unified inbox for chat + email + WhatsApp
- AI actions with confirmation + human approval queue
- Action logs and post-execution traceability
- Voice assistant (Vapi) integration with tool-calling
- Team roles + module permissions
- KB ingest (URL/file), RAG, analytics dashboards

Lekin agar goal "Intercom/Zendesk class" parity ka hai, to next 1 month mein sabse zyada value ye areas denge:

1. **Inbox operations depth** (routing, SLA, queue discipline, collision control)
2. **AI governance depth** (secure secrets, response contracts, simulation/evals)
3. **DB process discipline** (SQL editor dependency khatam, migration source-of-truth clear)

---

## 2) Current Tinfin Audit (Codebase Reality)

## 2.1 Unified Inbox - kya ban chuka hai

### Already implemented

- Multi-channel list/filter (`chat`, `email`, `whatsapp`) with status filters (`bot`, `open`, `pending`, `resolved`).
- Infinite/paginated conversation loading.
- Search by contact + message/email subject.
- Pending AI approval modal integrated directly in inbox.
- Channel-based renderer (`ConversationView`, `EmailConversationView`, `WhatsAppConversationView`).

### Important limitations

- "Assign agent / Add label / View contact" menu items UI mein hain, lekin action wiring mostly placeholder nature ki hai.
- True routing engine nahi hai (skills, load balancing, capacity, queue priorities absent).
- SLA timers, breach indicators, queue re-prioritization absent.
- Internal note/comment workflow clear productized form mein nahi.
- Collision detection (who is replying/editing now) inbox-side missing.

---

## 2.2 AI Actions - current architecture

### Strong points

- Action definition model achha hai: URL template, headers/body template, params, timeout.
- Runtime tool-calling integrated with OpenAI.
- `requiresConfirmation` aur `humanApprovalRequired` dono patterns available.
- Logs + approval queue + post-approval execution supported.
- Secret masking in logs/request payload exists.

### Critical gaps

- Action secrets DB mein plain value pattern par hain (`key_value`) - encryption at rest required.
- Outbound domain allowlist nahi (any HTTP/HTTPS template allowed if valid URL).
- Response contract validation (strict JSON schema) missing.
- Retry/idempotency policy structured form mein missing.
- Voice path mein action approval handle hota hai, lekin chat wali confirmation parity (`requiresConfirmation`) fully aligned nahi lagti.

---

## 2.3 Knowledge Base / Training stack

### Good

- URL ingest + file ingest with chunking + embeddings + RAG retrieval.
- Contact/channel scoped support usage.

### Gaps

- **Text Note tab currently simulated behavior** pe hai (backend real ingest path nahi).
- File ingest MIME scope narrow hai (PDF, DOCX only).
- Crawler mostly static HTML parsing hai; JS-heavy docs websites ke liye weak ho sakta hai.
- Scheduled re-crawl/versioning pipeline productized form mein visible nahi.

---

## 2.4 Analytics

Current analytics v1 useful hai (volume, resolution trend, AI vs human split, calls), lekin enterprise ops ke liye depth missing hai:

- FRT/NRT/TTR style SLA analytics
- Assignee workload analytics
- Queue aging / backlog-at-risk
- CSAT/CX, QA scorecards
- Action ROI and failure root-cause dashboards

---

## 2.5 DB / Migration state (very important)

Aap ka concern bilkul valid hai.

### Codebase reality

Code tables aur Drizzle schema/migrations mein drift hai.

- Code mein used tables ka set:
  `email_accounts`, `email_messages`, `org_invitations`, `whatsapp_accounts`, etc.
- Drizzle schema mein kuch tables missing hain.
- Migrations incremental hain, lekin full baseline schema history complete nahi lagti.

### Iska impact

- New environment spin-up risky hota hai.
- Drift debugging tough hoti hai.
- Team collaboration mein "kis SQL ka source of truth hai" confusion banta hai.

---

## 3) Competitor Deep Analysis

## 3.1 Intercom (Fin AI)

### Intercom kya strong karta hai

- **Workload management depth:** balanced assignment, round robin, assignment limits, active-teammate logic.
- **SLA operations:** workflow-based SLA apply, timer behavior, inbox urgency sort, office hours handling.
- **Fin training loop:** train -> test -> deploy -> analyze cycle clearly productized.
- **Tasks + Data Connectors:** complex multi-step flows; connectors as API calls with business logic wrapping.
- **Guidance + reporting:** policy-level coaching + usage/performance insights.
- **Multi-channel AI deploy:** chat, email, voice, social surface coverage.

### Intercom se kya seekhna chahiye (directly)

- Assignment intelligence + capacity-aware routing
- SLA-first inbox prioritization
- Training + simulation + evaluation workflow
- Better analytics loop for "why Fin failed" and "what to improve"

---

## 3.2 Front AI

### Front kya strong karta hai

- Shared inbox collaboration ka mature model.
- Rules engine with triggers/conditions/actions (including delayed/time-goal style ops).
- Load balancing rules + assignment limits.
- Real-time collision detection + shared drafts.
- Strong operational activity history visibility.
- Channel/API extensibility (Channel API + plugins).

### Front se kya seekhna chahiye

- Team collaboration UX polish
- Real-time collision and draft ownership
- Rule-driven inbox automations
- Assignment pressure balancing

---

## 3.3 Zendesk

### Zendesk kya strong karta hai

- Omnichannel routing based on status + capacity + skills.
- Unified agent status model.
- SLA policy system with deep metric model.
- Trigger + automation engine (event-based + time-based).
- Advanced AI agent actions architecture (AI-agent level, use-case level, block level).
- API/custom integration orchestration for advanced AI flows.

### Zendesk se kya seekhna chahiye

- Routing governance framework
- Rules + automations discipline
- SLA policy engine
- Layered AI action orchestration model

---

## 4) Unified Inbox Gap Matrix (Competitor Parity Lens)

| Capability | Tinfin Current | Gap Level | Kya karna hai |
|---|---|---|---|
| Channel unification | Chat+Email+WA present | Low | Good base, maintain and harden |
| Assignment engine | Self-takeover heavy, no smart routing | High | Skill/capacity/load-based assignment add karo |
| SLA timers & breach sorting | Missing | High | FRT/NRT/TTR targets + inbox urgency views |
| Queue governance | Basic statuses only | High | Queue aging, priority bands, backlog risk |
| Collision detection | Missing | Medium-High | "Agent X typing/drafting" indicators |
| Internal collaboration | Limited | Medium | Internal notes, mentions, handoff context |
| Labeling/custom fields | Partial UI placeholders | Medium-High | Real tag/custom fields + analytics hooks |
| Activity/audit history | Partial | Medium | Detailed state transitions + actor logs |
| Bulk actions | Missing | Medium | Assign/resolve/tag in bulk |
| QA/CSAT overlays | Missing | Medium | Conversation quality layer |

---

## 5) AI Actions - Aap ke specific sawal ka seedha jawab

### "Kya hamara AI Action endpoint-based hai?"

**Haan.** Current model endpoint-template based hai:

- URL template + params replace
- Optional body/header templating
- Runtime HTTP call
- Response parse/format
- Approval/confirmation flow

### "Kya Intercom bhi aisa hi karta hai?"

**Conceptually yes, lekin product layer zyada mature hai.**

- Data connectors API-call units ki tarah act karte hain.
- Fin Tasks/Procedures in connectors ko multi-step business logic mein compose karte hain.
- Training, testing, and reporting layers deeply integrated hain.

### "Zendesk side pe kya scene hai?"

- Zendesk Advanced AI actions ko multi-layer pe apply karta hai:
  - AI-agent level
  - Use-case level
  - Block level
- CRM actions + custom API integration patterns available hain.

### "Front AI side pe?"

- Front ka AI model zyada shared inbox productivity + rules + knowledge assist orientation pe hai.
- Deep action-orchestration Intercom/Zendesk Advanced jaisa default depth nahi, lekin extensibility API/plugin side strong hai.

---

## 6) New Features Add Karni Hain (Net-New Build List)

## P0 (Month-1 mein high impact)

1. **Routing Engine v1**
- Round-robin + load-aware + assignment limits
- Team/skill based rules
- Fallback queue behavior

2. **SLA Engine v1**
- First response + next response + resolution targets
- Business-hours aware timers
- Inbox "at-risk" + "breached" indicators

3. **Inbox Collaboration Signals**
- Real-time "who is replying"
- Draft collision warning
- Handoff context card

4. **Action Security Hardening**
- Secrets encryption at rest
- Per-org outbound domain allowlist
- Idempotency key option for write actions

5. **Simulation/Eval Harness (minimum viable)**
- 30-50 historical conversations replay
- Pass/fail assertions (policy + hallucination + action safety)

## P1

6. **Rules/Automation Builder v1**
- Trigger (inbound/status change/time condition)
- Conditions (channel, tags, priority, assignee)
- Actions (assign, tag, SLA apply, notify)

7. **Conversation Tags + Custom Fields**
- Real DB model + filter + analytics usage

8. **Customer feedback loop**
- CSAT/CX mini module

## P2

9. **Advanced multi-step procedure designer**
10. **Intent/attribute training layer**

---

## 7) Existing Features Improve Karni Hain (Enhancement List)

1. **Text Note ingest ko real backend flow pe lao**
- Abhi success simulate ho raha hai
- Isko true ingest endpoint se bind karo

2. **Voice/chat action parity**
- `requiresConfirmation` behavior ko voice path par align karo

3. **Analytics depth improve**
- FRT/NRT/TTR
- Assignee productivity and queue load
- Action success/failure insights with root causes

4. **Knowledge ingestion robustness**
- JS-heavy pages fallback (Playwright based crawler)
- Re-crawl scheduling
- Source versioning and stale-content detection

5. **Assignment UX complete karo**
- Dropdown placeholders ko real assignment mutations se wire karo

6. **Operational audit logs**
- Assignment/reassignment/resolve/handoff/tags ka deterministic audit trail

---

## 8) Database Migration Question ka Detailed Jawab

### "Kya hum SQL editor wali cheezen migrate kar sakte hain?"

**Haan, 100% kar sakte hain - aur karni chahiye.**

Lekin isko ek disciplined migration project ki tarah run karna hoga.

## 8.1 Current issue summary

- Repo migrations ka set limited hai.
- Kuch production-used tables Drizzle schema mein fully represented nahi.
- Kuch migrations assume karte hain ke base tables pehle se exist karte hain.

## 8.2 Recommended migration strategy (safe path)

### Step A - Freeze window
- 3-5 din ka "manual SQL freeze" announce karo.
- Is window mein SQL editor se random direct changes band karo.

### Step B - Production schema snapshot
- Supabase/DB se `schema-only` dump lo.
- Yeh aap ka ground-truth baseline hoga.

### Step C - Baseline migration create
- `0000_baseline.sql` generate karo jisme current full schema ho.
- Isme tables, indexes, constraints, functions, triggers sab include karo.

### Step D - Drizzle schema sync
- `packages/db/src/schema.ts` ko full baseline se align karo.
- Missing tables include karo (`email_accounts`, `email_messages`, `org_invitations`, `whatsapp_accounts`, etc.)

### Step E - Drift check CI
- Har PR pe schema drift check lagao.
- Agar DB aur code mismatch ho, PR fail karo.

### Step F - New rule forever
- Future mein **sirf migration files** se DB changes allowed.
- SQL editor emergency-only, aur phir turant migration-backport mandatory.

## 8.3 Practical command examples (adapt as needed)

```bash
# schema snapshot (example)
pg_dump --schema-only "$DATABASE_URL" > baseline_schema.sql

# generate new drizzle migration after schema.ts updates
pnpm --filter @workspace/db db:generate

# apply migrations
pnpm --filter @workspace/db db:migrate
```

Agar Supabase CLI use karte ho to equivalent `db pull`/`migration` flow bhi adopt ho sakta hai.

---

## 9) 1 Month Execution Plan (Week-by-Week)

## Week 1 - Foundation + Safety

- DB baseline and migration governance lock
- Action secrets encryption
- Outbound domain allowlist
- Assign-agent dropdown wiring complete

**Outcome:** platform safer + predictable deployments.

## Week 2 - Inbox Operations Core

- Routing engine v1 (round robin + load-aware)
- Queue states + backlog indicators
- SLA model data design + basic UI timers

**Outcome:** team efficiency jump + ops discipline.

## Week 3 - AI Quality + Collaboration

- Text Note real ingestion
- Voice/chat confirmation parity
- Collision detection + replying indicators
- Eval harness v1 (historical conversation replay)

**Outcome:** AI trust increase + fewer production surprises.

## Week 4 - Reporting + Launch Hardening

- SLA analytics + assignee dashboards
- Action analytics expansion (success/fail/retry/latency)
- Final QA checklist + load testing + rollback runbook

**Outcome:** launch confidence + measurable business visibility.

---

## 10) Prioritized Build Backlog (New vs Improve)

## 10.1 New Add (priority order)

1. Routing Engine v1 (P0)
2. SLA Engine v1 (P0)
3. Action security hardening (P0)
4. Collaboration signals (P0/P1)
5. Rules/automation builder v1 (P1)
6. Tags/custom fields model (P1)
7. Eval harness + simulation dashboard (P1/P2)

## 10.2 Improve Existing

1. Text Note ingestion true backend path (P0)
2. Voice/chat action parity for confirmation (P0)
3. Analytics depth beyond resolution trend (P1)
4. Knowledge crawl robustness + re-crawl scheduling (P1)
5. Inbox placeholder actions to full functionality (P1)

---

## 11) Risks agar yeh kaam delay hua

1. **Ops overload risk** - scale pe manual triage collapse karega.
2. **AI trust risk** - simulation/eval ke bina edge-case failures production mein jayenge.
3. **Security risk** - plaintext secrets aur unrestricted outbound calls enterprise sales block karenge.
4. **Data drift risk** - SQL editor dependency se deployment incidents repeat honge.

---

## 12) Final Recommendation (Aap ko next kya karna chahiye)

Agar aap next 30 din invest kar rahe ho, to best ROI order yeh hai:

1. **DB source-of-truth fix karo** (baseline + migrations discipline)
2. **Inbox routing + SLA core lao** (real operational moat)
3. **AI action governance harden karo** (security + reliability)
4. **Training/eval loop banao** (Intercom-level trust curve ke liye)
5. **Advanced features baad mein** (procedure designer, deep attributes, etc.)

Is order mein kaam karne se aap launch delay ko "quality upgrade window" mein convert kar doge, sirf delay nahi lagega.

---

## 13) Code Evidence (Local Audit Pointers)

- Inbox filters/status/channel logic: `apps/api/src/routers/chat.router.ts`
- Unified inbox UI + approvals modal: `apps/web/components/inbox/UnifiedInbox.tsx`
- Conversation action placeholders (assign/tag/contact):
  - `apps/web/components/inbox/ConversationView.tsx`
  - `apps/web/components/email/EmailConversationView.tsx`
- WhatsApp view ops controls: `apps/web/components/inbox/WhatsAppConversationView.tsx`
- AI actions router + secret persistence: `apps/api/src/routers/actions.router.ts`
- AI actions execution core: `packages/ai/src/actions.service.ts`
- Voice tool-call action path: `apps/api/src/routes/vapi-webhook.route.ts`
- DB schema definitions: `packages/db/src/schema.ts`
- DB migrations folder: `packages/db/drizzle/`
- KB text note simulated path: `apps/web/components/knowledge/AddSourceDialog.tsx`
- Ingest supported MIME scope: `apps/api/src/routers/ingest.router.ts`
- Analytics scope (current): `apps/api/src/routers/analytics.router.ts`

---

## 14) Official Competitor Sources (used for comparison)

### Intercom

- https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained
- https://www.intercom.com/help/en/articles/6560715-workload-management-explained
- https://www.intercom.com/help/en/articles/6546152-set-slas-for-conversations-and-tickets
- https://www.intercom.com/help/en/articles/9569407-fin-tasks-and-data-connectors-explained
- https://www.intercom.com/help/en/articles/13459820-how-to-use-data-connectors-in-fin-procedures
- https://www.intercom.com/help/en/articles/13617008-fin-procedures-faqs
- https://www.intercom.com/help/en/articles/10210126-provide-fin-ai-agent-with-specific-guidance
- https://www.intercom.com/help/en/articles/9929230-the-fin-ai-engine

### Front

- https://help.front.com/en/articles/2194
- https://help.front.com/en/articles/2105
- https://help.front.com/en/articles/2121
- https://help.front.com/en/articles/2403
- https://help.front.com/en/articles/2216
- https://help.front.com/en/articles/2414
- https://help.front.com/en/articles/4614336
- https://help.front.com/en/articles/2482
- https://help.front.com/en/articles/2137

### Zendesk

- https://support.zendesk.com/hc/en-us/articles/4409149119514-About-omnichannel-routing
- https://support.zendesk.com/hc/en-us/articles/4828787357210-Managing-your-omnichannel-routing-configuration
- https://support.zendesk.com/hc/en-us/articles/8357756651290-About-actions-for-advanced-AI-agents
- https://support.zendesk.com/hc/en-us/articles/6970583409690-About-AI-agents
- https://support.zendesk.com/hc/en-us/articles/9522180655386-Using-parameters-in-advanced-AI-agents
- https://support.zendesk.com/hc/en-us/articles/8724978128282-Getting-started-with-AI-agents-Advanced
- https://support.zendesk.com/hc/en-us/articles/4408829459866-Defining-SLA-policies
- https://support.zendesk.com/hc/en-us/articles/4408832924314-What-is-the-difference-between-ticket-triggers-and-automations
- https://support.zendesk.com/hc/en-us/articles/4408885654298-Automation-conditions-and-actions-reference

---

Agar aap chaho to next step mein main isi document ke basis par "Execution Tracker" bhi bana sakta hoon (Week-wise tasks + owner + ETA + Done/Blocked columns) taake aap direct team ke saath execute kar sako.

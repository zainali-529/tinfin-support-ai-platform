# AI Actions and AI Training Playbook (Tinfin)

Last updated: April 29, 2026
Audience: Product, Engineering, CX, Sales

## 1. Direct answers to your core questions

### Q1) AI Actions ke use cases kya hain?
AI Actions let the assistant do real operations, not only chat replies.

Typical categories:
- Read actions: order status, invoice lookup, booking availability, subscription status.
- Write actions: cancel order, reschedule booking, update profile, create support ticket.
- Process actions: verify account, trigger workflow/webhook, run escalation side-effects.

### Q2) Endpoint URLs kis ke paas hongi?
Usually yes, endpoints customer side par hoti hain.

Common models:
- Customer-owned API: best model. Customer gives their own backend endpoint.
- Third-party API direct: Shopify/Stripe/Calendly etc. Endpoint third-party ka hota hai, token customer ka.
- Middleware model: if customer ke paas clean API nahi hai, hum adapter API bana dete hain (recommended for enterprise).

### Q3) Kya hamara AI ab strong hai?
Short answer: strong v1 foundation, but not final enterprise maturity yet.

What is strong:
- Real API actions in chat, inbox, and voice integration.
- Confirmation and human approval controls.
- Execution logs, approval queue, and status badges.
- KB-based grounded answers.

What is still missing for top-tier parity:
- Multi-step visual/agentic procedure builder.
- Simulation/evaluation suite before go-live.
- Deeper training controls (attribute detection, intent governance, policy layers).
- Stronger production security controls around secrets and action governance.

## 2. Current implementation in this project

This is what is already implemented in codebase.

### 2.1 Action platform
- Action definitions in `ai_actions`.
- Secret values in `ai_action_secrets`.
- Full audit logs in `ai_action_logs`.
- Pending human approvals in `ai_action_approvals`.
- Max actions/org guard: 20 actions.

### 2.2 Runtime behavior
- AI can choose tools (KB search, handoff, custom actions).
- If `requiresConfirmation = true`, action pauses and asks user confirmation.
- If `humanApprovalRequired = true`, action enters approval queue.
- If no blockers, action executes immediately.
- Result is logged and attached to message metadata for inbox visibility.

### 2.3 Inbox and widget visibility
- Action badge appears in conversation timeline.
- Pending approval can be approved/rejected by agent from inbox UI.
- Approval/rejection posts assistant update back to conversation.

### 2.4 Voice support (Vapi)
- Org actions are injected as Vapi tools.
- Webhook can execute action tool calls and log results.
- Human approval flow is supported in voice path.

### 2.5 Action testing support
- Action Test panel shows request payload, response payload, formatted result, duration.
- Mock API endpoints are available at:
  - `GET /api/action-mock/orders/:orderId`
  - `POST /api/action-mock/orders/:orderId/cancel`
  - `GET /api/action-mock/health`

## 3. Why action looked "successful" but AI reply felt weak

If endpoint response only echoes `orderId`, AI can only say generic text like "I received order ID...".

To get high-quality answers, API must return operational fields such as:
- `status`
- `estimatedDelivery`
- `trackingNumber`
- `lastUpdate`

And action should include:
- `responsePath` to right object.
- `responseTemplate` for deterministic structure.

## 4. Production endpoint strategy for customers

### 4.1 Recommended contract
For each action endpoint:
- Stable HTTPS URL.
- Auth method defined (Bearer/API key/OAuth proxy).
- Clear JSON schema.
- Explicit success + error payload.
- Idempotency for write operations.

### 4.2 Recommended response shape

```json
{
  "success": true,
  "data": {
    "orderId": "32423",
    "status": "out_for_delivery",
    "estimatedDelivery": "Today by 6:00 PM",
    "trackingNumber": "TRK-123456",
    "lastUpdate": "Courier is on the way"
  },
  "error": null
}
```

### 4.3 If customer has no API
Use adapter pattern:
- Build a small integration service.
- Connect DB/ERP/CRM internally.
- Expose safe, AI-specific endpoints.
- Add auth, rate limits, schema validation, and audit.

## 5. Safe testing blueprint (practical)

### Step 1: Test in AI Actions panel
Use mock endpoint:
- URL: `http://localhost:3001/api/action-mock/orders/{orderId}`
- Method: `GET`
- Parameter: `orderId` (required)
- Response path: `order`
- Response template: `Order {id} is {status}. ETA: {estimatedDelivery}. Tracking: {trackingNumber}.`

### Step 2: Test in widget/inbox
Send real prompt like:
- `Check order status for order 32423`

Expected:
- Action badge with `Success`.
- Assistant message with structured status output.

### Step 3: Test write action with confirmation/approval
Use cancel route:
- URL: `http://localhost:3001/api/action-mock/orders/{orderId}/cancel`
- Method: `POST`
- Body template: `{"reason":"{reason}"}`
- Enable confirmation and human approval.

Expected:
- Customer confirmation prompt.
- Approval request in inbox.
- On approve: cancellation response posted back.

## 6. Training system maturity (current)

### 6.1 What exists today
- Knowledge base CRUD.
- URL crawl ingestion.
- PDF/DOCX ingestion.
- Chunking and embedding pipeline.
- RAG answer generation with confidence + handoff behavior.

### 6.2 Important practical limits right now
- URL crawler is mostly static HTML parsing; JS-heavy pages may be weak.
- No robust automated re-crawl/versioning pipeline visible in current flow.
- "Text Note" in UI is not fully wired to real backend ingest yet.
- No dedicated simulation/evaluation harness for pre-production behavior tests.
- No intent/attribute training layer comparable to Fin Attributes.

## 7. Security and governance assessment

### 7.1 Strengths already present
- Admin gate for action management/testing.
- URL template protocol validation.
- Timeout controls.
- Approval queue for sensitive actions.
- Action logs + request/response traces.
- Masking of secrets in request display/log path.

### 7.2 Gaps to close before enterprise scale
- Secrets are stored as plain values in `ai_action_secrets` table (should move to encrypted vault/KMS pattern).
- No visible allowlist policy for outbound action domains.
- No strict JSON schema validation on response contracts at runtime.
- No automatic retry/idempotency strategy for transient failures.
- Voice tool path currently enforces approval, but customer confirmation parity should be validated and aligned with chat behavior.

## 8. Intercom benchmark (research summary)

As of April 29, 2026, Intercom Fin documents highlight a broader training-control loop around Actions/Data Connectors, Procedures, Simulations, Attributes, and reporting.

### 8.1 What Intercom does well
- Data connectors connect external APIs and can be used for read/write actions.
- Procedures support natural-language multi-step logic with conditions/tools.
- Simulations provide pre-live behavior testing and pass/fail style validation.
- Fin Attributes support AI classification for routing, escalation, reporting.
- Deep reporting for resolution/escalation/unanswered/procedure handoff metrics.
- Broad multi-channel deployment (chat, email, phone, Slack, Discord, social).

### 8.2 Notable Intercom constraints (also useful for us)
- Procedure execution is sequential; no parallel system calls in one step.
- Procedure triggering is intent-driven, not deterministic workflow call-in.
- Some feature gaps are documented in their own FAQs (for example certain procedure capabilities still evolving).

### 8.3 Tinfin vs Intercom capability view
- Custom action execution: competitive baseline achieved.
- Training controls depth: Intercom ahead.
- Simulation/testing framework: Intercom ahead.
- Attribute-based routing intelligence: Intercom ahead.
- Action analytics depth: Intercom ahead.
- Flexibility/customization potential: Tinfin good potential due open custom API model.

## 9. Are we ready to sell this strongly?

Yes, for v1 positioning.

Strong positioning today:
- "AI that can answer + take real actions + ask approvals + work in chat/inbox/voice."

Position carefully (avoid overclaim):
- "Enterprise-grade fully autonomous multi-step agentic workflows" is not yet complete.

Recommended pitch line:
- "Tinfin delivers practical AI automation now: grounded answers, real API actions, and human-controlled safety rails."

## 10. 60-day professional roadmap (high impact)

### Phase A: Reliability and safety (Week 1-2)
- Encrypt secrets at rest (KMS/Vault).
- Add outbound domain allowlist per org.
- Add response JSON schema validator per action.
- Add idempotency key support for write actions.

### Phase B: Better outcomes (Week 3-4)
- Build action-level retry policy with exponential backoff.
- Add action fallback messages per failure type.
- Improve confirmation NLP for multilingual and ambiguous replies.
- Complete true Text Note ingestion path.

### Phase C: Competitive moat (Week 5-8)
- Add "Procedure"-like orchestration layer for multi-step deterministic + AI flow.
- Add simulation playground (test sets, pass/fail, regressions).
- Add intent/attribute training module for routing and escalation.
- Add deeper analytics dashboard: resolve rate, deflection, escalation reason, action ROI.

## 11. Go-live checklist for each customer org

- Confirm endpoint ownership and SLA.
- Define 3-5 high-volume actions first (not 20 at once).
- Enable confirmation for destructive writes.
- Enable human approval for financial/account-risk actions.
- Validate each action in Test Panel and real widget.
- Review action logs for 3-7 days before scaling.
- Add fallback/handoff policy for every failure state.

## 12. Intercom references used (official)

- https://www.intercom.com/help/en/articles/9916497-how-to-set-up-data-connectors
- https://www.intercom.com/help/en/articles/9916507-fin-and-data-connectors-faqs
- https://www.intercom.com/help/en/articles/12495167-fin-procedures-explained
- https://www.intercom.com/help/en/articles/13617008-fin-procedures-faqs
- https://www.intercom.com/help/en/articles/12521277-train-fin-as-a-service-agent
- https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained
- https://www.intercom.com/help/en/articles/12396892-manage-fin-ai-agent-s-escalation-guidance-and-rules
- https://www.intercom.com/help/en/articles/11680403-how-to-create-fin-attributes
- https://www.intercom.com/help/en/articles/12397045-using-fin-attributes-in-workflows-reports-and-the-inbox
- https://www.intercom.com/help/en/articles/7022438-reporting-metrics-attributes
- https://www.intercom.com/help/en/articles/9929230-the-fin-ai-engine
- https://www.intercom.com/blog/whats-new-with-fin-3/


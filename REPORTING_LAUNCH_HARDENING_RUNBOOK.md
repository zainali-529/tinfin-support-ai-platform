# Reporting + Launch Hardening Runbook

Ye runbook launch se pehle reporting, SLA visibility, AI action reliability, load testing, aur rollback process ko standardize karta hai. Is ka goal ye hai ke launch ke waqt team ke paas sirf dashboard na ho, balkay clear decision system bhi ho.

## 1. Scope

Is phase mein ye cheezen add ki gayi hain:

- SLA analytics: breach rate, active breaches, first response average, resolution average, channel-level SLA, queue backlog, at-risk queue.
- Assignee dashboard: active assigned load, breached conversations, SLA met rate, first response speed, agent reply count.
- Action analytics expansion: success/fail/timeout/rejected/cancelled counts, retry count, retry rate, average latency, P95 latency, recent failures.
- Launch readiness checklist: automatic checks plus manual gates.
- Load testing script: reporting endpoint ka protected load test.
- Rollback runbook: migration/UI/API rollback ke steps.

## 2. Database Migration

Migration file:

```bash
packages/db/drizzle/0003_reporting_launch_hardening.sql
```

Is migration mein `ai_action_logs` ke liye structured reporting columns add kiye gaye hain:

- `duration_ms`: action execution latency.
- `status_code`: external API HTTP status code.
- `retry_count`: future retry-aware action execution ke liye count.
- `completed_at`: action completion/rejection/cancel timestamp.

Indexes bhi add kiye gaye hain taake analytics queries launch traffic par slow na hon:

- action logs by org/status/date
- action logs by org/action/date
- action duration index
- completed action index
- conversations by channel/date
- conversations by assigned/date
- messages by role/date

Migration command:

```bash
pnpm --filter @workspace/db db:migrate
```

Important: app code new columns write karega, is liye deploy order ye hona chahiye:

1. Database migration run karo.
2. API deploy karo.
3. Web deploy karo.
4. Load test run karo.

## 3. Launch Readiness Gates

Dashboard mein score automatic calculate hota hai, lekin launch decision human-owned hona chahiye.

Recommended thresholds:

- Readiness score: `90+` launch ready.
- Readiness score: `75-89` watch mode, launch possible but owner sign-off zaroori.
- Readiness score: `<75` launch block.
- Active SLA breaches: `0` ideal, `1-3` warning, `4+` block.
- Action success rate: `95%+` ideal, `85-94%` warning, `<85%` block.
- Action P95 latency: `<5s` ideal, `5-10s` warning, `>10s` block.
- Reporting endpoint P95 load-test latency: `<1500ms` ideal.
- Reporting endpoint error rate: `<1%` required.

## 4. SLA QA Checklist

Launch se pehle ye verify karo:

- Default `inbox_sla_policies` row har organization ke liye exist karti hai.
- Channel-specific SLA policies sirf tab use ho rahi hain jab genuinely needed hon.
- Pending/open conversations mein `first_response_due_at`, `next_response_due_at`, `resolution_due_at` populate ho rahe hain.
- Agent reply ke baad `first_response_at` aur `last_agent_reply_at` update ho rahe hain.
- Customer ke new message ke baad `last_customer_message_at` update ho raha hai.
- Inbox list aur analytics dashboard dono same SLA risk story show kar rahe hain.
- Breached queue empty ya intentionally accepted hai.

## 5. Assignee Dashboard QA

Verify:

- Assigned conversations correct agent ke under count ho rahi hain.
- Unassigned queue separately show ho rahi hai.
- Agent messages attribution `ai_metadata.agentId` se aa raha hai.
- Load score high-risk agents ko top par la raha hai.
- Team member remove/invite ke baad dashboard break nahi hota.
- Empty team state graceful hai.

## 6. AI Action Analytics QA

Verify:

- Success action logs `status = success` ke saath `duration_ms` store kar rahe hain.
- Failed HTTP responses `status = failed` aur `status_code` ke saath capture ho rahe hain.
- Timeout actions `status = timeout` show kar rahe hain.
- Human rejected actions `completed_at` populate kar rahe hain.
- Confirmation cancelled actions `status = cancelled` show kar rahe hain.
- Recent failures panel useful error message show kar raha hai.
- Secrets dashboard ya logs mein leak nahi ho rahe.

## 7. Load Testing

Script:

```bash
pnpm --filter @workspace/api load:reporting
```

Required env:

```bash
API_URL=http://localhost:3001
TINFIN_LOAD_AUTH_TOKEN=<supabase-user-access-token>
LOAD_PERIOD=30d
LOAD_REQUESTS=120
LOAD_CONCURRENCY=12
```

PowerShell example:

```powershell
$env:API_URL="http://localhost:3001"
$env:TINFIN_LOAD_AUTH_TOKEN="<token>"
$env:LOAD_PERIOD="30d"
$env:LOAD_REQUESTS="120"
$env:LOAD_CONCURRENCY="12"
pnpm --filter @workspace/api load:reporting
```

Pass criteria:

- `errorRate <= 1`
- `latency.p95Ms <= 1500`
- no repeated `401`, `403`, `500`

If load test fail ho:

- Pehle Supabase slow query logs check karo.
- Analytics period `90d` par specifically test karo.
- Indexes migration apply hui hai ya nahi verify karo.
- Dashboard ko temporary `30d` default par lock kar sakte ho.
- Action recent failures query ko limit reduce kar sakte ho.

## 8. Rollback Runbook

### 8.1 Web UI rollback

Agar premium analytics UI issue de:

1. Web deployment ko previous stable build par rollback karo.
2. API ko running rehne do, kyun ke old analytics wrappers still available hain.
3. Browser console aur network error capture karo.
4. Fix deploy se pehle `pnpm --filter web typecheck` run karo.

### 8.2 API rollback

Agar `analytics.getReportingDashboard` endpoint issue de:

1. API deployment previous stable build par rollback karo.
2. Web analytics page temporarily unavailable ho sakta hai, lekin inbox core unaffected rehna chahiye.
3. Supabase query logs mein failing select check karo.
4. Agar issue missing migration hai to migration run karo, API rollback avoid karo.

### 8.3 DB rollback

Migration mostly additive hai. Emergency rollback normally required nahi hota.

If rollback absolutely needed:

```sql
DROP INDEX IF EXISTS public.idx_ai_action_logs_org_status_created;
DROP INDEX IF EXISTS public.idx_ai_action_logs_org_action_created;
DROP INDEX IF EXISTS public.idx_ai_action_logs_org_duration;
DROP INDEX IF EXISTS public.idx_ai_action_logs_org_completed;
DROP INDEX IF EXISTS public.idx_conversations_org_channel_started;
DROP INDEX IF EXISTS public.idx_conversations_org_assigned_started;
DROP INDEX IF EXISTS public.idx_messages_org_role_created;

ALTER TABLE public.ai_action_logs
  DROP COLUMN IF EXISTS duration_ms,
  DROP COLUMN IF EXISTS status_code,
  DROP COLUMN IF EXISTS retry_count,
  DROP COLUMN IF EXISTS completed_at;
```

Warning: DB rollback se new action analytics fields lose ho jayengi. Pehle data export karna better hai.

## 9. Launch Day Monitoring

Launch ke first 2 hours mein ye monitor karo:

- Analytics readiness score.
- Active SLA breaches.
- Pending conversations.
- Assignee load imbalance.
- Action success rate.
- Action P95 latency.
- Recent action failures.
- API CPU/memory.
- Supabase slow queries.
- Web console errors.

Recommended launch cadence:

- T-60 min: migration + API deploy + web deploy.
- T-45 min: smoke test analytics/inbox/actions.
- T-30 min: load test reporting endpoint.
- T-15 min: clear active SLA breaches.
- T-0: launch.
- T+15/T+30/T+60/T+120: dashboard review.

## 10. Owner Sign-off

Launch owner ko ye confirm karna chahiye:

- Dashboard score accepted hai.
- Manual checks reviewed hain.
- Rollback owner assigned hai.
- Supabase migration applied hai.
- Load test result saved hai.
- Customer support team ko SLA/assignee dashboard samjha diya gaya hai.

# DB Improvement And Migration Playbook (Roman Urdu)

## 1) Ab Current Source Of Truth Kya Hai
- `packages/db/drizzle/0001_baseline.sql`: poora canonical baseline schema, policies, functions, indexes.
- `packages/db/src/schema.ts`: app-level typed schema jo baseline ke saath align hai.
- `supa-migrations/*.sql`: historical/archive reference. In ko production source of truth **na** samjho.

## 2) Is Rewrite Mein Kya Cover Ho Chuka Hai
- Core multi-org tables finalize:
  - `organizations`, `users`, `user_organizations`, `org_invitations`
- Inbox core:
  - `contacts`, `conversations`, `messages`
- Knowledge + RAG:
  - `knowledge_bases`, `kb_chunks`
  - `match_kb_chunks` RPC upgraded with optional `match_kb_id`
- Channels:
  - `email_accounts`, `email_messages`
  - `whatsapp_accounts`, `whatsapp_messages`
- Voice:
  - `vapi_assistants` (including `kb_ids`, `tools_enabled`)
  - `calls` (metadata + updated_at + linking fields)
- Billing + usage:
  - `subscriptions` (Stripe fields included), `usage_events`
- AI actions:
  - `ai_actions`, `ai_action_secrets`, `ai_action_logs`, `ai_action_approvals`
- Extras:
  - `canned_responses`, `org_api_keys`, `widget_configs`
  - storage bucket/policies for `chat-attachments`
  - realtime publication add for `conversations/messages/contacts/email_messages/whatsapp_messages`
  - RLS model with service-role full access + authenticated scoped access for frontend-required tables
  - signup trigger `handle_new_user`

## 3) Policy Strategy (Short)
- API routes service-role key use karte hain: full access.
- Browser auth user ke liye scoped policies:
  - select/update/insert sirf org membership scope ke andar.
- Sensitive tables (`org_api_keys`, action secrets, channel credentials) direct frontend access ke liye open nahi ki gayi.

## 4) Future Rule (Hard Rule)
- Supabase SQL editor mein direct manual schema changes **band**.
- Har DB change repo migration file ke through:
  - `packages/db/drizzle/000X_<feature>.sql`
- Har change ke baad `schema.ts` ko sync/update karna lazmi.

## 5) Next Time Naya DB Change Ka SOP
1. Requirement finalize karo.
2. `packages/db/src/schema.ts` update karo.
3. New migration add karo:
   - naming example: `packages/db/drizzle/0002_team_tags.sql`
4. Migration SQL mein:
   - DDL (`CREATE/ALTER`)
   - related indexes
   - RLS/policy update (agar required)
   - backfill/update logic (agar required)
5. Local run/test:
   - `pnpm --filter @workspace/db db:migrate`
6. App smoke test:
   - inbox, team, channels, calls, ai actions basic flows
7. Deploy target DB par same migration apply karo.

## 6) Fresh DB Banane Ke Exact Commands
## Assumption
- `DATABASE_URL` Supabase Postgres connection string par set hai.

```bash
pnpm --filter @workspace/db db:migrate
```

## Optional verify quick checks
```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```

```sql
select policyname, tablename
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

## 7) Safety Checklist Before Production
- DB backup/snapshot lo.
- Pehle staging pe migrate karo.
- Signup flow test:
  - org create
  - users row
  - user_organizations row
  - widget_configs + subscriptions default rows
- Inbox smoke:
  - message insert
  - conversation status update
  - realtime events
- Channel smoke:
  - email inbound/outbound
  - whatsapp inbound/outbound
- Voice smoke:
  - calls upsert
  - vapi assistant save
- AI actions smoke:
  - action create
  - secret set
  - logs + approvals

## 8) Important Note About Old Supabase SQL Editor Scripts
- `supa-migrations` folder helpful archive hai, lekin ab ismein new changes add na karo.
- Naya kaam sirf:
  - `packages/db/drizzle`
  - `packages/db/src/schema.ts`

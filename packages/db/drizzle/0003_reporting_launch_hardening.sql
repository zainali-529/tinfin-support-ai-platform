-- 0003_reporting_launch_hardening.sql
-- Reporting + launch hardening:
--   1) First-class AI action latency/retry analytics columns
--   2) Backfill structured analytics from existing request_payload metadata
--   3) Reporting indexes for SLA, assignee, and action dashboards

ALTER TABLE public.ai_action_logs
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS status_code INTEGER,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.ai_action_logs
SET
  duration_ms = COALESCE(
    duration_ms,
    CASE
      WHEN jsonb_typeof(request_payload) = 'object'
       AND request_payload ? 'durationMs'
       AND (request_payload->>'durationMs') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN ROUND((request_payload->>'durationMs')::numeric)::integer
      ELSE NULL
    END
  ),
  status_code = COALESCE(
    status_code,
    CASE
      WHEN jsonb_typeof(request_payload) = 'object'
       AND request_payload ? 'statusCode'
       AND (request_payload->>'statusCode') ~ '^[0-9]+$'
      THEN (request_payload->>'statusCode')::integer
      ELSE NULL
    END
  ),
  retry_count = COALESCE(
    retry_count,
    CASE
      WHEN jsonb_typeof(request_payload) = 'object'
       AND request_payload ? 'retryCount'
       AND (request_payload->>'retryCount') ~ '^[0-9]+$'
      THEN (request_payload->>'retryCount')::integer
      WHEN jsonb_typeof(request_payload) = 'object'
       AND request_payload ? 'retries'
       AND (request_payload->>'retries') ~ '^[0-9]+$'
      THEN (request_payload->>'retries')::integer
      ELSE 0
    END
  ),
  completed_at = COALESCE(completed_at, executed_at)
WHERE duration_ms IS NULL
   OR status_code IS NULL
   OR completed_at IS NULL
   OR retry_count IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_action_logs_org_status_created
  ON public.ai_action_logs(org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_action_logs_org_action_created
  ON public.ai_action_logs(org_id, action_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_action_logs_org_duration
  ON public.ai_action_logs(org_id, duration_ms)
  WHERE duration_ms IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_action_logs_org_completed
  ON public.ai_action_logs(org_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_org_channel_started
  ON public.conversations(org_id, channel, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_org_assigned_started
  ON public.conversations(org_id, assigned_to, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_org_role_created
  ON public.messages(org_id, role, created_at DESC);

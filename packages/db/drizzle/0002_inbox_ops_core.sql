-- 0002_inbox_ops_core.sql
-- Inbox operations core:
--   1) Routing engine state and events
--   2) Queue-state + backlog foundation
--   3) SLA policy model + timers foundation

-- ============================================================
-- New Tables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_sla_policies (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel                        TEXT NOT NULL DEFAULT 'all',
  first_response_target_seconds  INTEGER NOT NULL DEFAULT 600,
  next_response_target_seconds   INTEGER NOT NULL DEFAULT 900,
  resolution_target_seconds      INTEGER NOT NULL DEFAULT 14400,
  is_default                     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inbox_sla_policies_org_channel_unique UNIQUE (org_id, channel)
);

CREATE TABLE IF NOT EXISTS public.inbox_routing_state (
  org_id                 UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_assigned_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  last_assigned_at       TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inbox_routing_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  assigned_to      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason           TEXT NOT NULL DEFAULT 'auto',
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Conversations: queue + SLA + routing metadata
-- ============================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS queue_state TEXT NOT NULL DEFAULT 'bot',
  ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_response_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_agent_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS routing_assigned_at TIMESTAMPTZ;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_conversations_org_queue_state_started
  ON public.conversations(org_id, queue_state, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_org_sla_first_due
  ON public.conversations(org_id, first_response_due_at);

CREATE INDEX IF NOT EXISTS idx_conversations_org_sla_resolution_due
  ON public.conversations(org_id, resolution_due_at);

CREATE INDEX IF NOT EXISTS idx_conversations_org_assigned_status_started
  ON public.conversations(org_id, assigned_to, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_sla_policies_org_id
  ON public.inbox_sla_policies(org_id);

CREATE INDEX IF NOT EXISTS idx_inbox_routing_state_last_assigned_user_id
  ON public.inbox_routing_state(last_assigned_user_id);

CREATE INDEX IF NOT EXISTS idx_inbox_routing_events_org_created
  ON public.inbox_routing_events(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_routing_events_conversation
  ON public.inbox_routing_events(conversation_id, created_at DESC);

-- ============================================================
-- SLA + Queue Utility Functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_sla_targets_seconds(
  p_org_id UUID,
  p_channel TEXT
)
RETURNS TABLE (
  first_response_target_seconds INTEGER,
  next_response_target_seconds INTEGER,
  resolution_target_seconds INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.first_response_target_seconds,
    p.next_response_target_seconds,
    p.resolution_target_seconds
  FROM public.inbox_sla_policies p
  WHERE p.org_id = p_org_id
    AND (p.channel = p_channel OR p.channel = 'all')
  ORDER BY
    CASE WHEN p.channel = p_channel THEN 0 ELSE 1 END,
    p.is_default DESC,
    p.updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 600, 900, 14400;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_conversation_queue_state(
  p_status TEXT,
  p_assigned_to UUID
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_status IN ('resolved', 'closed') THEN
    RETURN 'resolved';
  END IF;

  IF p_status = 'bot' THEN
    RETURN 'bot';
  END IF;

  IF p_status = 'open' THEN
    RETURN 'in_progress';
  END IF;

  IF p_status = 'pending' THEN
    IF p_assigned_to IS NULL THEN
      RETURN 'queued';
    END IF;
    RETURN 'assigned';
  END IF;

  IF p_assigned_to IS NULL THEN
    RETURN 'queued';
  END IF;

  RETURN 'assigned';
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_conversation_ops_defaults()
RETURNS TRIGGER AS $$
DECLARE
  targets RECORD;
  now_ts TIMESTAMPTZ := NOW();
  next_queue_state TEXT;
BEGIN
  next_queue_state := public.compute_conversation_queue_state(NEW.status, NEW.assigned_to);

  IF NEW.status = 'open' AND NEW.queue_state = 'waiting_customer' THEN
    next_queue_state := 'waiting_customer';
  END IF;

  NEW.queue_state := next_queue_state;

  IF NEW.queue_entered_at IS NULL THEN
    NEW.queue_entered_at := COALESCE(NEW.started_at, now_ts);
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO targets
    FROM public.resolve_sla_targets_seconds(NEW.org_id, NEW.channel);

    IF NEW.status IN ('pending', 'open') THEN
      IF NEW.first_response_due_at IS NULL THEN
        NEW.first_response_due_at :=
          COALESCE(NEW.started_at, now_ts)
          + make_interval(secs => COALESCE(targets.first_response_target_seconds, 600));
      END IF;

      IF NEW.resolution_due_at IS NULL THEN
        NEW.resolution_due_at :=
          COALESCE(NEW.started_at, now_ts)
          + make_interval(secs => COALESCE(targets.resolution_target_seconds, 14400));
      END IF;
    END IF;

    IF NEW.status <> 'bot' AND NEW.last_customer_message_at IS NULL THEN
      NEW.last_customer_message_at := COALESCE(NEW.started_at, now_ts);
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.status IN ('resolved', 'closed')
     AND COALESCE(OLD.status, '') NOT IN ('resolved', 'closed')
     AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now_ts;
  END IF;

  IF NEW.status NOT IN ('resolved', 'closed')
     AND COALESCE(OLD.status, '') IN ('resolved', 'closed') THEN
    NEW.resolved_at := NULL;
  END IF;

  IF next_queue_state IN ('queued', 'assigned')
     AND COALESCE(OLD.queue_state, '') NOT IN ('queued', 'assigned') THEN
    NEW.queue_entered_at := now_ts;
  END IF;

  IF NEW.status = 'pending' AND COALESCE(OLD.status, '') = 'bot' THEN
    SELECT * INTO targets
    FROM public.resolve_sla_targets_seconds(NEW.org_id, NEW.channel);

    IF NEW.first_response_due_at IS NULL THEN
      NEW.first_response_due_at :=
        now_ts + make_interval(secs => COALESCE(targets.first_response_target_seconds, 600));
    END IF;

    IF NEW.resolution_due_at IS NULL THEN
      NEW.resolution_due_at :=
        now_ts + make_interval(secs => COALESCE(targets.resolution_target_seconds, 14400));
    END IF;

    IF NEW.last_customer_message_at IS NULL THEN
      NEW.last_customer_message_at := now_ts;
    END IF;
  END IF;

  IF NEW.status = 'open'
     AND COALESCE(OLD.status, '') = 'pending'
     AND NEW.assigned_to IS NOT NULL
     AND NEW.first_response_at IS NULL THEN
    NEW.first_response_at := now_ts;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.apply_message_ops_updates()
RETURNS TRIGGER AS $$
DECLARE
  targets RECORD;
  conv_channel TEXT;
BEGIN
  IF NEW.conversation_id IS NULL OR NEW.org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.channel
  INTO conv_channel
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id
    AND c.org_id = NEW.org_id
  LIMIT 1;

  IF conv_channel IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO targets
  FROM public.resolve_sla_targets_seconds(NEW.org_id, conv_channel);

  IF NEW.role = 'user' THEN
    UPDATE public.conversations c
    SET
      last_customer_message_at = NEW.created_at,
      next_response_due_at = NEW.created_at + make_interval(secs => COALESCE(targets.next_response_target_seconds, 900)),
      queue_state = public.compute_conversation_queue_state(c.status, c.assigned_to)
    WHERE c.id = NEW.conversation_id
      AND c.org_id = NEW.org_id;

    RETURN NEW;
  END IF;

  IF NEW.role = 'agent' THEN
    UPDATE public.conversations c
    SET
      first_response_at = COALESCE(c.first_response_at, NEW.created_at),
      last_agent_reply_at = NEW.created_at,
      queue_state = CASE
        WHEN c.status IN ('resolved', 'closed') THEN 'resolved'
        WHEN c.status = 'open' THEN 'waiting_customer'
        ELSE public.compute_conversation_queue_state(c.status, c.assigned_to)
      END
    WHERE c.id = NEW.conversation_id
      AND c.org_id = NEW.org_id;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conversations_ops_defaults ON public.conversations;
CREATE TRIGGER conversations_ops_defaults
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.apply_conversation_ops_defaults();

DROP TRIGGER IF EXISTS messages_ops_updates ON public.messages;
CREATE TRIGGER messages_ops_updates
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.apply_message_ops_updates();

DROP TRIGGER IF EXISTS inbox_sla_policies_updated_at ON public.inbox_sla_policies;
CREATE TRIGGER inbox_sla_policies_updated_at
  BEFORE UPDATE ON public.inbox_sla_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS inbox_routing_state_updated_at ON public.inbox_routing_state;
CREATE TRIGGER inbox_routing_state_updated_at
  BEFORE UPDATE ON public.inbox_routing_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Seed defaults + backfill existing records
-- ============================================================
INSERT INTO public.inbox_sla_policies (
  org_id,
  channel,
  first_response_target_seconds,
  next_response_target_seconds,
  resolution_target_seconds,
  is_default
)
SELECT
  o.id,
  'all',
  600,
  900,
  14400,
  TRUE
FROM public.organizations o
ON CONFLICT (org_id, channel) DO NOTHING;

UPDATE public.conversations c
SET
  queue_state = public.compute_conversation_queue_state(c.status, c.assigned_to),
  queue_entered_at = COALESCE(c.queue_entered_at, c.started_at, NOW())
WHERE c.queue_state IS DISTINCT FROM public.compute_conversation_queue_state(c.status, c.assigned_to)
   OR c.queue_entered_at IS NULL;

WITH message_stats AS (
  SELECT
    m.org_id,
    m.conversation_id,
    MIN(m.created_at) FILTER (WHERE m.role = 'agent') AS first_agent_at,
    MAX(m.created_at) FILTER (WHERE m.role = 'agent') AS last_agent_at,
    MAX(m.created_at) FILTER (WHERE m.role = 'user') AS last_user_at
  FROM public.messages m
  GROUP BY m.org_id, m.conversation_id
)
UPDATE public.conversations c
SET
  first_response_at = COALESCE(c.first_response_at, stats.first_agent_at),
  last_agent_reply_at = COALESCE(c.last_agent_reply_at, stats.last_agent_at),
  last_customer_message_at = COALESCE(c.last_customer_message_at, stats.last_user_at)
FROM message_stats stats
WHERE c.id = stats.conversation_id
  AND c.org_id = stats.org_id;

UPDATE public.conversations c
SET
  first_response_due_at = COALESCE(
    c.first_response_due_at,
    COALESCE(c.last_customer_message_at, c.started_at, NOW())
      + make_interval(
        secs => COALESCE(
          (
            SELECT t.first_response_target_seconds
            FROM public.resolve_sla_targets_seconds(c.org_id, c.channel) AS t
            LIMIT 1
          ),
          600
        )
      )
  ),
  resolution_due_at = COALESCE(
    c.resolution_due_at,
    COALESCE(c.started_at, NOW())
      + make_interval(
        secs => COALESCE(
          (
            SELECT t.resolution_target_seconds
            FROM public.resolve_sla_targets_seconds(c.org_id, c.channel) AS t
            LIMIT 1
          ),
          14400
        )
      )
  )
WHERE c.status IN ('pending', 'open');

UPDATE public.conversations c
SET
  next_response_due_at = COALESCE(
    c.next_response_due_at,
    c.last_customer_message_at
      + make_interval(
        secs => COALESCE(
          (
            SELECT t.next_response_target_seconds
            FROM public.resolve_sla_targets_seconds(c.org_id, c.channel) AS t
            LIMIT 1
          ),
          900
        )
      )
  )
WHERE c.last_customer_message_at IS NOT NULL
  AND c.status IN ('pending', 'open');

-- ============================================================
-- RLS for new tables
-- ============================================================
ALTER TABLE public.inbox_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_routing_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_routing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_inbox_sla_policies ON public.inbox_sla_policies;
CREATE POLICY service_role_inbox_sla_policies
  ON public.inbox_sla_policies FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_inbox_routing_state ON public.inbox_routing_state;
CREATE POLICY service_role_inbox_routing_state
  ON public.inbox_routing_state FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_inbox_routing_events ON public.inbox_routing_events;
CREATE POLICY service_role_inbox_routing_events
  ON public.inbox_routing_events FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS inbox_sla_policies_select_member ON public.inbox_sla_policies;
CREATE POLICY inbox_sla_policies_select_member
  ON public.inbox_sla_policies FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

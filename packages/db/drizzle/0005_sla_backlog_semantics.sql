-- 0005_sla_backlog_semantics.sql
-- Tightens live inbox semantics:
--   1) Backlog means "team action is waiting", not total conversation age.
--   2) Waiting-customer and resolved conversations no longer behave like live backlog.
--   3) Customer replies in an open conversation restart the active response window.

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

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'open'
       AND COALESCE(NEW.queue_state, OLD.queue_state) = 'waiting_customer' THEN
      next_queue_state := 'waiting_customer';
    END IF;
  END IF;

  NEW.queue_state := next_queue_state;

  IF NEW.queue_entered_at IS NULL THEN
    NEW.queue_entered_at := CASE
      WHEN next_queue_state = 'in_progress' THEN COALESCE(NEW.last_customer_message_at, NEW.started_at, now_ts)
      ELSE COALESCE(NEW.started_at, now_ts)
    END;
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
    NEW.queue_entered_at := COALESCE(NEW.last_customer_message_at, now_ts);
  END IF;

  IF next_queue_state = 'in_progress'
     AND (
       COALESCE(OLD.queue_state, '') <> 'in_progress'
       OR NEW.last_customer_message_at IS DISTINCT FROM OLD.last_customer_message_at
     ) THEN
    NEW.queue_entered_at := COALESCE(NEW.last_customer_message_at, now_ts);
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
      next_response_due_at = CASE
        WHEN c.status IN ('pending', 'open') THEN
          NEW.created_at + make_interval(secs => COALESCE(targets.next_response_target_seconds, 900))
        ELSE c.next_response_due_at
      END,
      queue_state = CASE
        WHEN c.status IN ('resolved', 'closed') THEN 'resolved'
        WHEN c.status = 'bot' THEN 'bot'
        WHEN c.status = 'open' THEN 'in_progress'
        ELSE public.compute_conversation_queue_state(c.status, c.assigned_to)
      END,
      queue_entered_at = CASE
        WHEN c.status = 'open' THEN NEW.created_at
        WHEN c.status = 'pending' AND c.queue_state NOT IN ('queued', 'assigned') THEN NEW.created_at
        ELSE c.queue_entered_at
      END
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

UPDATE public.conversations c
SET
  queue_state = CASE
    WHEN c.status IN ('resolved', 'closed') THEN 'resolved'
    WHEN c.status = 'bot' THEN 'bot'
    WHEN c.status = 'open'
      AND c.last_agent_reply_at IS NOT NULL
      AND (c.last_customer_message_at IS NULL OR c.last_agent_reply_at >= c.last_customer_message_at)
      THEN 'waiting_customer'
    ELSE public.compute_conversation_queue_state(c.status, c.assigned_to)
  END,
  queue_entered_at = CASE
    WHEN c.status = 'open'
      AND c.last_customer_message_at IS NOT NULL
      AND (c.last_agent_reply_at IS NULL OR c.last_customer_message_at > c.last_agent_reply_at)
      THEN c.last_customer_message_at
    WHEN c.status = 'pending'
      THEN COALESCE(c.queue_entered_at, c.last_customer_message_at, c.started_at, NOW())
    ELSE COALESCE(c.queue_entered_at, c.started_at, NOW())
  END
WHERE TRUE;

-- Dashboard performance indexes for large workspaces.
-- These keep overview counts, recent conversation previews, and activity feeds
-- fast when an organization has thousands of conversations/messages.

CREATE INDEX IF NOT EXISTS idx_conversations_org_status_started_perf
  ON public.conversations (org_id, status, started_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_org_active_assigned_perf
  ON public.conversations (org_id, assigned_to)
  WHERE status IN ('bot', 'pending', 'open');

CREATE INDEX IF NOT EXISTS idx_conversations_org_active_sla_first_perf
  ON public.conversations (org_id, first_response_due_at)
  WHERE status IN ('pending', 'open')
    AND first_response_at IS NULL
    AND first_response_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_org_active_sla_next_perf
  ON public.conversations (org_id, next_response_due_at)
  WHERE status IN ('pending', 'open')
    AND first_response_at IS NOT NULL
    AND next_response_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_org_created_perf
  ON public.messages (org_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_email_messages_org_created_perf
  ON public.email_messages (org_id, created_at DESC, id DESC);

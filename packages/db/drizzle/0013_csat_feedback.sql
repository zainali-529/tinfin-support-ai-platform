-- Customer satisfaction feedback.
-- Captures widget CSAT after resolved conversations and keeps agent/analytics
-- reporting separate from internal AI-quality signals.

CREATE TABLE IF NOT EXISTS public.conversation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  source TEXT NOT NULL DEFAULT 'widget',
  channel TEXT NOT NULL DEFAULT 'chat',
  handled_by TEXT NOT NULL DEFAULT 'unknown'
    CHECK (handled_by IN ('ai', 'human', 'mixed', 'unknown')),
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversation_feedback_source_check
    CHECK (source IN ('widget', 'agent', 'api', 'import'))
);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_feedback_org_conversation_source_unique
  ON public.conversation_feedback(org_id, conversation_id, source);

CREATE INDEX IF NOT EXISTS idx_conversation_feedback_org_created
  ON public.conversation_feedback(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_feedback_conversation
  ON public.conversation_feedback(org_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_feedback_contact
  ON public.conversation_feedback(org_id, contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_feedback_channel_created
  ON public.conversation_feedback(org_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_feedback_assigned_created
  ON public.conversation_feedback(org_id, assigned_to, created_at DESC)
  WHERE assigned_to IS NOT NULL;

DROP TRIGGER IF EXISTS conversation_feedback_updated_at ON public.conversation_feedback;
CREATE TRIGGER conversation_feedback_updated_at
  BEFORE UPDATE ON public.conversation_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.conversation_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_conversation_feedback ON public.conversation_feedback;
CREATE POLICY service_role_conversation_feedback
  ON public.conversation_feedback FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS conversation_feedback_select_member ON public.conversation_feedback;
CREATE POLICY conversation_feedback_select_member
  ON public.conversation_feedback FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS conversation_feedback_insert_member ON public.conversation_feedback;
CREATE POLICY conversation_feedback_insert_member
  ON public.conversation_feedback FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_in_org(org_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.org_id = org_id
    )
  );

DROP POLICY IF EXISTS conversation_feedback_update_member ON public.conversation_feedback;
CREATE POLICY conversation_feedback_update_member
  ON public.conversation_feedback FOR UPDATE TO authenticated
  USING (public.auth_user_in_org(org_id))
  WITH CHECK (public.auth_user_in_org(org_id));

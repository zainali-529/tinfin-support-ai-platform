-- Internal notes and conversation timeline
-- Keeps agent collaboration data separate from customer-visible messages.

CREATE TABLE IF NOT EXISTS public.conversation_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  note_id UUID REFERENCES public.conversation_internal_notes(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_internal_notes_conversation_created
  ON public.conversation_internal_notes(org_id, conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_internal_notes_author
  ON public.conversation_internal_notes(org_id, author_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_timeline_conversation_created
  ON public.conversation_timeline_events(org_id, conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_timeline_type_created
  ON public.conversation_timeline_events(org_id, event_type, created_at DESC);

DROP TRIGGER IF EXISTS conversation_internal_notes_updated_at ON public.conversation_internal_notes;
CREATE TRIGGER conversation_internal_notes_updated_at
  BEFORE UPDATE ON public.conversation_internal_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.conversation_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_conversation_internal_notes ON public.conversation_internal_notes;
CREATE POLICY service_role_conversation_internal_notes
  ON public.conversation_internal_notes FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_conversation_timeline_events ON public.conversation_timeline_events;
CREATE POLICY service_role_conversation_timeline_events
  ON public.conversation_timeline_events FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS conversation_internal_notes_select_member ON public.conversation_internal_notes;
CREATE POLICY conversation_internal_notes_select_member
  ON public.conversation_internal_notes FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS conversation_internal_notes_insert_member ON public.conversation_internal_notes;
CREATE POLICY conversation_internal_notes_insert_member
  ON public.conversation_internal_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_in_org(org_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.org_id = org_id
    )
  );

DROP POLICY IF EXISTS conversation_timeline_events_select_member ON public.conversation_timeline_events;
CREATE POLICY conversation_timeline_events_select_member
  ON public.conversation_timeline_events FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS conversation_timeline_events_insert_member ON public.conversation_timeline_events;
CREATE POLICY conversation_timeline_events_insert_member
  ON public.conversation_timeline_events FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_in_org(org_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.org_id = org_id
    )
  );

-- Internal note edit/delete audit fields
-- Notes are soft-deleted so the conversation timeline keeps collaboration history.

ALTER TABLE public.conversation_internal_notes
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_internal_notes_active_created
  ON public.conversation_internal_notes(org_id, conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS conversation_internal_notes_update_author ON public.conversation_internal_notes;
CREATE POLICY conversation_internal_notes_update_author
  ON public.conversation_internal_notes FOR UPDATE TO authenticated
  USING (
    public.auth_user_in_org(org_id)
    AND author_user_id = auth.uid()
  )
  WITH CHECK (
    public.auth_user_in_org(org_id)
    AND author_user_id = auth.uid()
  );

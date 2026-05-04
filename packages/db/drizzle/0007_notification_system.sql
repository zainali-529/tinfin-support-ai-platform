-- ============================================================
-- Notification System
-- In-app notification inbox for agents/admins with optional
-- browser/email delivery handled by the application layer.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'not_queued',
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_recipient_created
  ON public.notifications(org_id, recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications(recipient_user_id, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_org_type_created
  ON public.notifications(org_id, type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_unique
  ON public.notifications(org_id, recipient_user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

DROP TRIGGER IF EXISTS notifications_updated_at ON public.notifications;
CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_notifications ON public.notifications;
CREATE POLICY service_role_notifications
  ON public.notifications FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS notifications_select_recipient ON public.notifications;
CREATE POLICY notifications_select_recipient
  ON public.notifications FOR SELECT TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND public.auth_user_in_org(org_id)
  );

DROP POLICY IF EXISTS notifications_update_recipient ON public.notifications;
CREATE POLICY notifications_update_recipient
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND public.auth_user_in_org(org_id)
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    AND public.auth_user_in_org(org_id)
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;

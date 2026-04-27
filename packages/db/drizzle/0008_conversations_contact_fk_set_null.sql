-- 0008_conversations_contact_fk_set_null.sql
-- Ensure deleting a contact does not fail when conversations still exist.

DO $$
DECLARE
  v_confdeltype "char";
BEGIN
  SELECT c.confdeltype
  INTO v_confdeltype
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace ns ON ns.oid = t.relnamespace
  WHERE ns.nspname = 'public'
    AND t.relname = 'conversations'
    AND c.conname = 'conversations_contact_id_fkey';

  IF v_confdeltype IS NULL THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_contact_id_fkey
      FOREIGN KEY (contact_id)
      REFERENCES public.contacts(id)
      ON DELETE SET NULL;
  ELSIF v_confdeltype <> 'n' THEN
    ALTER TABLE public.conversations
      DROP CONSTRAINT conversations_contact_id_fkey;

    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_contact_id_fkey
      FOREIGN KEY (contact_id)
      REFERENCES public.contacts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

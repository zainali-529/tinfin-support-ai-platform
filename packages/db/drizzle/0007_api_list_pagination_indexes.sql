-- 0007_api_list_pagination_indexes.sql
-- Improves performance for API-based pagination and search across inbox, contacts, and calls.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Conversation list pagination and filters
CREATE INDEX IF NOT EXISTS idx_conversations_org_started_id
  ON public.conversations (org_id, started_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_org_channel_status_started
  ON public.conversations (org_id, channel, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_org_contact
  ON public.conversations (org_id, contact_id);

-- Message and email preview lookups
CREATE INDEX IF NOT EXISTS idx_messages_org_conversation_created
  ON public.messages (org_id, conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_messages_org_conversation_created
  ON public.email_messages (org_id, conversation_id, created_at DESC);

-- Contacts and calls list pagination
CREATE INDEX IF NOT EXISTS idx_contacts_org_created
  ON public.contacts (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_org_created
  ON public.calls (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_org_status_created
  ON public.calls (org_id, status, created_at DESC);

-- Trigram indexes for fast ILIKE search
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm
  ON public.contacts USING GIN (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
  ON public.contacts USING GIN (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON public.messages USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_email_messages_subject_trgm
  ON public.email_messages USING GIN (subject gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_calls_caller_number_trgm
  ON public.calls USING GIN (caller_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_calls_summary_trgm
  ON public.calls USING GIN (summary gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id_trgm
  ON public.calls USING GIN (vapi_call_id gin_trgm_ops);

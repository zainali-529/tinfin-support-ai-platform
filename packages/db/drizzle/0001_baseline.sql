-- 0001_baseline.sql
-- Canonical baseline for a fresh Tinfin database.
-- Source of truth: repository migrations only (no manual SQL editor drift).

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- Core Tables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  email         TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'agent',
  avatar_url    TEXT,
  is_online     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  is_owner    BOOLEAN NOT NULL DEFAULT FALSE,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_organizations_user_org_unique UNIQUE (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS public.org_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  token       UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_invitations_token_unique UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email       TEXT,
  name        TEXT,
  phone       TEXT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'bot',
  assigned_to  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ai_context   JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel      TEXT NOT NULL DEFAULT 'chat',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL,
  content          TEXT NOT NULL,
  attachments      JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_metadata      JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.knowledge_bases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  source_type  TEXT,
  settings     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id         UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  source_url    TEXT,
  source_title  TEXT,
  embedding     vector(1536),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.widget_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_color    TEXT NOT NULL DEFAULT '#6366f1',
  text_color       TEXT NOT NULL DEFAULT '#ffffff',
  bg_color         TEXT NOT NULL DEFAULT '#ffffff',
  position         TEXT NOT NULL DEFAULT 'bottom-right',
  welcome_message  TEXT NOT NULL DEFAULT 'Hi! How can we help?',
  company_name     TEXT,
  logo_url         TEXT,
  show_branding    BOOLEAN NOT NULL DEFAULT TRUE,
  settings         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_sub_id         TEXT,
  stripe_customer_id    TEXT,
  plan                  TEXT NOT NULL DEFAULT 'free',
  status                TEXT NOT NULL DEFAULT 'active',
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT subscriptions_org_id_key UNIQUE (org_id),
  CONSTRAINT subscriptions_stripe_customer_id_key UNIQUE (stripe_customer_id)
);

CREATE TABLE IF NOT EXISTS public.usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  period      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.org_api_keys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  openai_key_encrypted  TEXT,
  claude_key_encrypted  TEXT,
  vapi_key_encrypted    TEXT
);

CREATE TABLE IF NOT EXISTS public.email_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  resend_api_key        TEXT,
  from_email            TEXT NOT NULL DEFAULT '',
  from_name             TEXT NOT NULL DEFAULT 'Support',
  inbound_address       TEXT,
  inbound_provider      TEXT NOT NULL DEFAULT 'postmark',
  inbound_webhook_token TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT FALSE,
  ai_auto_reply         BOOLEAN NOT NULL DEFAULT FALSE,
  email_signature       TEXT,
  settings              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id      UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id           UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  external_message_id  TEXT,
  in_reply_to          TEXT,
  references_header    TEXT,
  subject              TEXT NOT NULL DEFAULT '',
  from_email           TEXT NOT NULL,
  from_name            TEXT,
  to_emails            TEXT[] NOT NULL DEFAULT '{}',
  cc_emails            TEXT[] DEFAULT '{}',
  html_body            TEXT,
  text_body            TEXT,
  direction            TEXT NOT NULL DEFAULT 'inbound',
  status               TEXT NOT NULL DEFAULT 'received',
  error_message        TEXT,
  raw_headers          JSONB DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vapi_assistants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  vapi_assistant_id    TEXT,
  name                 TEXT NOT NULL DEFAULT 'Support Assistant',
  first_message        TEXT NOT NULL DEFAULT 'Hello! How can I help you today?',
  system_prompt        TEXT,
  voice                TEXT NOT NULL DEFAULT 'jennifer-playht',
  model                TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  language             TEXT NOT NULL DEFAULT 'en',
  max_duration_seconds INTEGER NOT NULL DEFAULT 600,
  background_sound     TEXT NOT NULL DEFAULT 'off',
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  phone_number_id      TEXT,
  kb_ids               TEXT[] NOT NULL DEFAULT '{}',
  tools_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  settings             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.calls (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id            UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id       UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  vapi_call_id          TEXT NOT NULL UNIQUE,
  vapi_assistant_id     TEXT,
  phone_number_id       TEXT,
  status                TEXT NOT NULL DEFAULT 'created',
  type                  TEXT NOT NULL DEFAULT 'webCall',
  direction             TEXT NOT NULL DEFAULT 'inbound',
  duration_seconds      INTEGER,
  recording_url         TEXT,
  stereo_recording_url  TEXT,
  transcript            TEXT,
  summary               TEXT,
  cost_cents            TEXT,
  cost_breakdown        JSONB,
  ended_reason          TEXT,
  caller_number         TEXT,
  called_number         TEXT,
  visitor_id            TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number_id       TEXT NOT NULL,
  whatsapp_business_id  TEXT NOT NULL,
  access_token          TEXT NOT NULL,
  display_phone_number  TEXT,
  display_name          TEXT,
  webhook_verify_token  TEXT NOT NULL UNIQUE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  ai_auto_reply         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id       UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  wa_message_id    TEXT UNIQUE,
  wa_contact_id    TEXT,
  direction        TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'sent',
  message_type     TEXT NOT NULL DEFAULT 'text',
  media_url        TEXT,
  media_mime_type  TEXT,
  raw_payload      JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_actions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  display_name             TEXT NOT NULL,
  description              TEXT NOT NULL,
  method                   TEXT NOT NULL DEFAULT 'GET',
  url_template             TEXT NOT NULL,
  headers_template         JSONB NOT NULL DEFAULT '{}'::jsonb,
  body_template            TEXT,
  response_path            TEXT,
  response_template        TEXT,
  parameters               JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_confirmation    BOOLEAN NOT NULL DEFAULT FALSE,
  human_approval_required  BOOLEAN NOT NULL DEFAULT FALSE,
  timeout_seconds          INTEGER NOT NULL DEFAULT 10,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  category                 TEXT NOT NULL DEFAULT 'custom',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_actions_org_name_unique UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS public.ai_action_secrets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id   UUID NOT NULL REFERENCES public.ai_actions(id) ON DELETE CASCADE,
  key_name    TEXT NOT NULL,
  key_value   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_action_secrets_action_key_unique UNIQUE (action_id, key_name)
);

CREATE TABLE IF NOT EXISTS public.ai_action_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_id        UUID NOT NULL REFERENCES public.ai_actions(id) ON DELETE CASCADE,
  conversation_id  UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  parameters_used  JSONB,
  request_payload  JSONB,
  response_raw     JSONB,
  response_parsed  TEXT,
  status           TEXT NOT NULL,
  error_message    TEXT,
  approved_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  executed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_action_approvals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id           UUID NOT NULL UNIQUE REFERENCES public.ai_action_logs(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  action_name      TEXT NOT NULL,
  parameters       JSONB,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_org_id ON public.users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_active_org_id ON public.users(active_org_id);

CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON public.user_organizations(org_id);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON public.org_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_email ON public.org_invitations(org_id, email, status);

CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON public.contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_created ON public.contacts(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON public.conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_org_started_id ON public.conversations(org_id, started_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_org_channel_status_started ON public.conversations(org_id, channel, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_org_contact ON public.conversations(org_id, contact_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_id ON public.messages(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_conversation_created ON public.messages(org_id, conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_has_attachments
  ON public.messages USING GIN (attachments)
  WHERE jsonb_array_length(attachments) > 0;

CREATE INDEX IF NOT EXISTS idx_kb_chunks_org_id ON public.kb_chunks(org_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_kb_id ON public.kb_chunks(kb_id);
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx
  ON public.kb_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_email_accounts_org ON public.email_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_conv ON public.email_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_org ON public.email_messages(org_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_ext_id
  ON public.email_messages(external_message_id)
  WHERE external_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_in_reply_to
  ON public.email_messages(in_reply_to)
  WHERE in_reply_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_direction
  ON public.email_messages(org_id, conversation_id, direction, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_org_conversation_created
  ON public.email_messages(org_id, conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_org_created ON public.calls(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_org_status_created ON public.calls(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON public.calls(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_visitor_id ON public.calls(org_id, visitor_id) WHERE visitor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_vapi_id ON public.calls(vapi_call_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id ON public.whatsapp_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conv ON public.whatsapp_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_actions_org_active ON public.ai_actions(org_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_action_logs_conv ON public.ai_action_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_logs_org_date ON public.ai_action_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_action_approvals_conv ON public.ai_action_approvals(conversation_id);

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm ON public.contacts USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm ON public.contacts USING GIN (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON public.messages USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_email_messages_subject_trgm ON public.email_messages USING GIN (subject gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_calls_caller_number_trgm ON public.calls USING GIN (caller_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_calls_summary_trgm ON public.calls USING GIN (summary gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id_trgm ON public.calls USING GIN (vapi_call_id gin_trgm_ops);

-- ============================================================
-- Utility Triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_accounts_updated_at ON public.email_accounts;
CREATE TRIGGER email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS vapi_assistants_updated_at ON public.vapi_assistants;
CREATE TRIGGER vapi_assistants_updated_at
  BEFORE UPDATE ON public.vapi_assistants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS calls_updated_at ON public.calls;
CREATE TRIGGER calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS whatsapp_accounts_updated_at ON public.whatsapp_accounts;
CREATE TRIGGER whatsapp_accounts_updated_at
  BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS ai_actions_updated_at ON public.ai_actions;
CREATE TRIGGER ai_actions_updated_at
  BEFORE UPDATE ON public.ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Auth / Membership Helper Functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.auth_user_active_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(active_org_id, org_id)
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.auth_user_in_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organizations
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  org_slug TEXT,
  org_plan TEXT,
  user_role TEXT,
  is_default BOOLEAN,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.slug,
    o.plan,
    uo.role,
    uo.is_default,
    uo.joined_at
  FROM public.user_organizations uo
  JOIN public.organizations o ON o.id = uo.org_id
  WHERE uo.user_id = p_user_id
  ORDER BY uo.is_default DESC, uo.joined_at ASC
$$;

-- ============================================================
-- RAG RPC Function
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  query_embedding vector(1536),
  match_org_id uuid,
  match_threshold float,
  match_count int,
  match_kb_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  kb_id uuid,
  content text,
  source_url text,
  source_title text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kbc.id,
    kbc.kb_id,
    kbc.content,
    kbc.source_url,
    kbc.source_title,
    kbc.metadata,
    (1 - (kbc.embedding <=> query_embedding))::float AS similarity
  FROM public.kb_chunks kbc
  WHERE
    kbc.org_id = match_org_id
    AND (match_kb_id IS NULL OR kbc.kb_id = match_kb_id)
    AND kbc.embedding IS NOT NULL
    AND (1 - (kbc.embedding <=> query_embedding)) > match_threshold
  ORDER BY kbc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_kb_chunks(vector(1536), uuid, float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_kb_chunks(vector(1536), uuid, float, int, uuid) TO service_role;

-- ============================================================
-- Signup Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name  TEXT;
  v_new_org   UUID;
  v_slug_base TEXT;
  v_slug      TEXT;
  v_counter   INTEGER := 0;
BEGIN
  v_org_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'org_name'), ''),
    'My Organization'
  );

  v_slug_base := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug_base := trim(both '-' from v_slug_base);
  v_slug := v_slug_base;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.organizations WHERE slug = v_slug
    );
    v_counter := v_counter + 1;
    v_slug := v_slug_base || '-' || v_counter;
  END LOOP;

  v_new_org := gen_random_uuid();

  INSERT INTO public.organizations (id, name, slug, plan)
  VALUES (v_new_org, v_org_name, v_slug, 'free');

  INSERT INTO public.subscriptions (org_id, plan, status)
  VALUES (v_new_org, 'free', 'active')
  ON CONFLICT (org_id) DO NOTHING;

  INSERT INTO public.users (id, org_id, active_org_id, email, name, role)
  VALUES (
    NEW.id,
    v_new_org,
    v_new_org,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    'admin'
  )
  ON CONFLICT (id) DO UPDATE
    SET org_id = EXCLUDED.org_id,
        active_org_id = EXCLUDED.active_org_id,
        email = EXCLUDED.email;

  INSERT INTO public.widget_configs (org_id)
  VALUES (v_new_org)
  ON CONFLICT (org_id) DO NOTHING;

  INSERT INTO public.user_organizations (user_id, org_id, role, is_default, is_owner, permissions)
  VALUES (
    NEW.id,
    v_new_org,
    'admin',
    TRUE,
    TRUE,
    jsonb_build_object(
      'dashboard', true,
      'inbox', true,
      'contacts', true,
      'calls', true,
      'knowledge', true,
      'analytics', true,
      'widget', true,
      'embedding', true,
      'voiceAssistant', true,
      'channels', true
    )
  )
  ON CONFLICT (user_id, org_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Storage Bucket + Policies (chat attachments)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  TRUE,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'video/mp4',
    'audio/mpeg',
    'audio/wav'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = EXCLUDED.public;

DO $$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS chat_attachments_public_read ON storage.objects;
  CREATE POLICY chat_attachments_public_read
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'chat-attachments');

  DROP POLICY IF EXISTS chat_attachments_service_insert ON storage.objects;
  CREATE POLICY chat_attachments_service_insert
    ON storage.objects FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'chat-attachments');

  DROP POLICY IF EXISTS chat_attachments_service_delete ON storage.objects;
  CREATE POLICY chat_attachments_service_delete
    ON storage.objects FOR DELETE
    TO service_role
    USING (bucket_id = 'chat-attachments');
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage.objects policy setup due to insufficient privileges (owner required).';
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_attachments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  obj storage.objects%ROWTYPE;
  file_url TEXT;
  is_referenced BOOLEAN;
BEGIN
  FOR obj IN
    SELECT *
    FROM storage.objects
    WHERE bucket_id = 'chat-attachments'
      AND created_at < NOW() - INTERVAL '30 days'
  LOOP
    file_url := '%' || obj.name || '%';

    SELECT EXISTS (
      SELECT 1 FROM public.messages
      WHERE attachments::text LIKE file_url
    ) INTO is_referenced;

    IF NOT is_referenced THEN
      DELETE FROM storage.objects WHERE id = obj.id;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vapi_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_organizations ON public.organizations;
CREATE POLICY service_role_organizations ON public.organizations FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_users ON public.users;
CREATE POLICY service_role_users ON public.users FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_user_organizations ON public.user_organizations;
CREATE POLICY service_role_user_organizations ON public.user_organizations FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_org_invitations ON public.org_invitations;
CREATE POLICY service_role_org_invitations ON public.org_invitations FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_contacts ON public.contacts;
CREATE POLICY service_role_contacts ON public.contacts FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_conversations ON public.conversations;
CREATE POLICY service_role_conversations ON public.conversations FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_messages ON public.messages;
CREATE POLICY service_role_messages ON public.messages FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_knowledge_bases ON public.knowledge_bases;
CREATE POLICY service_role_knowledge_bases ON public.knowledge_bases FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_kb_chunks ON public.kb_chunks;
CREATE POLICY service_role_kb_chunks ON public.kb_chunks FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_widget_configs ON public.widget_configs;
CREATE POLICY service_role_widget_configs ON public.widget_configs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_subscriptions ON public.subscriptions;
CREATE POLICY service_role_subscriptions ON public.subscriptions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_usage_events ON public.usage_events;
CREATE POLICY service_role_usage_events ON public.usage_events FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_org_api_keys ON public.org_api_keys;
CREATE POLICY service_role_org_api_keys ON public.org_api_keys FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_email_accounts ON public.email_accounts;
CREATE POLICY service_role_email_accounts ON public.email_accounts FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_email_messages ON public.email_messages;
CREATE POLICY service_role_email_messages ON public.email_messages FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_vapi_assistants ON public.vapi_assistants;
CREATE POLICY service_role_vapi_assistants ON public.vapi_assistants FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_calls ON public.calls;
CREATE POLICY service_role_calls ON public.calls FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_whatsapp_accounts ON public.whatsapp_accounts;
CREATE POLICY service_role_whatsapp_accounts ON public.whatsapp_accounts FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_whatsapp_messages ON public.whatsapp_messages;
CREATE POLICY service_role_whatsapp_messages ON public.whatsapp_messages FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_ai_actions ON public.ai_actions;
CREATE POLICY service_role_ai_actions ON public.ai_actions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_ai_action_secrets ON public.ai_action_secrets;
CREATE POLICY service_role_ai_action_secrets ON public.ai_action_secrets FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_ai_action_logs ON public.ai_action_logs;
CREATE POLICY service_role_ai_action_logs ON public.ai_action_logs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_ai_action_approvals ON public.ai_action_approvals;
CREATE POLICY service_role_ai_action_approvals ON public.ai_action_approvals FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
CREATE POLICY organizations_select_member
  ON public.organizations FOR SELECT TO authenticated
  USING (public.auth_user_in_org(id));

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS user_organizations_select_own ON public.user_organizations;
CREATE POLICY user_organizations_select_own
  ON public.user_organizations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_select_member ON public.subscriptions;
CREATE POLICY subscriptions_select_member
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS contacts_select_member ON public.contacts;
CREATE POLICY contacts_select_member
  ON public.contacts FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS conversations_select_member ON public.conversations;
CREATE POLICY conversations_select_member
  ON public.conversations FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS conversations_update_member ON public.conversations;
CREATE POLICY conversations_update_member
  ON public.conversations FOR UPDATE TO authenticated
  USING (public.auth_user_in_org(org_id))
  WITH CHECK (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS messages_select_member ON public.messages;
CREATE POLICY messages_select_member
  ON public.messages FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS messages_insert_member ON public.messages;
CREATE POLICY messages_insert_member
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_in_org(org_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.org_id = org_id
    )
  );

DROP POLICY IF EXISTS knowledge_bases_select_member ON public.knowledge_bases;
CREATE POLICY knowledge_bases_select_member
  ON public.knowledge_bases FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS kb_chunks_select_member ON public.kb_chunks;
CREATE POLICY kb_chunks_select_member
  ON public.kb_chunks FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS email_messages_select_member ON public.email_messages;
CREATE POLICY email_messages_select_member
  ON public.email_messages FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS whatsapp_messages_select_member ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_select_member
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

-- ============================================================
-- Realtime publication entries
-- ============================================================
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
        AND c.relname = 'conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'contacts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'email_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.email_messages;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'whatsapp_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
    END IF;
  END IF;
END $$;

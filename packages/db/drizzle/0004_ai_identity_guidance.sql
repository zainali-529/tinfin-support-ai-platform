-- 0004_ai_identity_guidance.sql
-- AI Identity + Guidance Sprint:
--   1) Organization AI profile and guidance rules
--   2) Pinned company-profile knowledge source support
--   3) Curated eval cases and answer traces for AI debugging

ALTER TABLE public.kb_chunks
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned_reason TEXT;

UPDATE public.kb_chunks
SET source_type = COALESCE(NULLIF(metadata->>'sourceType', ''), source_type, 'general')
WHERE source_type = 'general'
  AND jsonb_typeof(metadata) = 'object'
  AND metadata ? 'sourceType';

CREATE INDEX IF NOT EXISTS idx_kb_chunks_org_source_type
  ON public.kb_chunks(org_id, source_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_org_pinned
  ON public.kb_chunks(org_id, is_pinned, created_at DESC)
  WHERE is_pinned = TRUE;

CREATE TABLE IF NOT EXISTS public.organization_ai_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assistant_name TEXT NOT NULL DEFAULT 'Support Assistant',
  company_name TEXT NOT NULL,
  company_summary TEXT,
  website_url TEXT,
  industry TEXT,
  target_customers TEXT,
  value_proposition TEXT,
  support_scope TEXT,
  out_of_scope TEXT,
  brand_voice TEXT NOT NULL DEFAULT 'warm, clear, professional, concise',
  default_language TEXT NOT NULL DEFAULT 'auto',
  formatting_style TEXT NOT NULL DEFAULT 'direct answer first, bullets when helpful',
  handoff_policy TEXT,
  forbidden_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
  good_answer_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  bad_answer_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_ai_profiles_org_id_key
  ON public.organization_ai_profiles(org_id);

CREATE INDEX IF NOT EXISTS idx_organization_ai_profiles_org_id
  ON public.organization_ai_profiles(org_id);

CREATE TABLE IF NOT EXISTS public.ai_guidance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  condition_text TEXT,
  guidance_text TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'all',
  priority INTEGER NOT NULL DEFAULT 100,
  source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_guidance_rules_org_active_priority
  ON public.ai_guidance_rules(org_id, is_active, priority);

CREATE TABLE IF NOT EXISTS public.ai_eval_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  input_message TEXT NOT NULL,
  expected_intent TEXT NOT NULL DEFAULT 'company_identity',
  expected_contains JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbidden_contains JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_source_type TEXT,
  language TEXT NOT NULL DEFAULT 'auto',
  channel TEXT NOT NULL DEFAULT 'chat',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  last_passed BOOLEAN,
  last_score INTEGER,
  last_output TEXT,
  last_diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_eval_cases_org_active
  ON public.ai_eval_cases(org_id, is_active);

CREATE TABLE IF NOT EXISTS public.ai_answer_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'chat',
  query TEXT NOT NULL,
  detected_intent TEXT NOT NULL,
  rewritten_query TEXT,
  response_type TEXT NOT NULL,
  response_preview TEXT,
  sources_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  guidance_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_answer_traces_org_created
  ON public.ai_answer_traces(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_answer_traces_conversation
  ON public.ai_answer_traces(conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_answer_traces_org_intent
  ON public.ai_answer_traces(org_id, detected_intent);

DROP TRIGGER IF EXISTS organization_ai_profiles_updated_at ON public.organization_ai_profiles;
CREATE TRIGGER organization_ai_profiles_updated_at
  BEFORE UPDATE ON public.organization_ai_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS ai_guidance_rules_updated_at ON public.ai_guidance_rules;
CREATE TRIGGER ai_guidance_rules_updated_at
  BEFORE UPDATE ON public.ai_guidance_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS ai_eval_cases_updated_at ON public.ai_eval_cases;
CREATE TRIGGER ai_eval_cases_updated_at
  BEFORE UPDATE ON public.ai_eval_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_guidance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_eval_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_answer_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_organization_ai_profiles ON public.organization_ai_profiles;
CREATE POLICY service_role_organization_ai_profiles
  ON public.organization_ai_profiles FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_ai_guidance_rules ON public.ai_guidance_rules;
CREATE POLICY service_role_ai_guidance_rules
  ON public.ai_guidance_rules FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_ai_eval_cases ON public.ai_eval_cases;
CREATE POLICY service_role_ai_eval_cases
  ON public.ai_eval_cases FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS service_role_ai_answer_traces ON public.ai_answer_traces;
CREATE POLICY service_role_ai_answer_traces
  ON public.ai_answer_traces FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS organization_ai_profiles_select_member ON public.organization_ai_profiles;
CREATE POLICY organization_ai_profiles_select_member
  ON public.organization_ai_profiles FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS organization_ai_profiles_write_member ON public.organization_ai_profiles;
CREATE POLICY organization_ai_profiles_write_member
  ON public.organization_ai_profiles FOR ALL TO authenticated
  USING (public.auth_user_in_org(org_id))
  WITH CHECK (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS ai_guidance_rules_select_member ON public.ai_guidance_rules;
CREATE POLICY ai_guidance_rules_select_member
  ON public.ai_guidance_rules FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS ai_guidance_rules_write_member ON public.ai_guidance_rules;
CREATE POLICY ai_guidance_rules_write_member
  ON public.ai_guidance_rules FOR ALL TO authenticated
  USING (public.auth_user_in_org(org_id))
  WITH CHECK (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS ai_eval_cases_select_member ON public.ai_eval_cases;
CREATE POLICY ai_eval_cases_select_member
  ON public.ai_eval_cases FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS ai_eval_cases_write_member ON public.ai_eval_cases;
CREATE POLICY ai_eval_cases_write_member
  ON public.ai_eval_cases FOR ALL TO authenticated
  USING (public.auth_user_in_org(org_id))
  WITH CHECK (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS ai_answer_traces_select_member ON public.ai_answer_traces;
CREATE POLICY ai_answer_traces_select_member
  ON public.ai_answer_traces FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS ai_answer_traces_write_member ON public.ai_answer_traces;
CREATE POLICY ai_answer_traces_write_member
  ON public.ai_answer_traces FOR ALL TO authenticated
  USING (public.auth_user_in_org(org_id))
  WITH CHECK (public.auth_user_in_org(org_id));


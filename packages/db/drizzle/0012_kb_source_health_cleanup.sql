-- Knowledge Base source health and removed feature cleanup.
-- Keeps KB management minimal while making ingestion status visible and debuggable.

ALTER TABLE public.kb_chunks
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE TABLE IF NOT EXISTS public.kb_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  status TEXT NOT NULL DEFAULT 'indexed',
  chunk_count INTEGER NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
  quality_score INTEGER CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  warning_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  last_indexed_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kb_sources_source_type_check
    CHECK (source_type IN ('url', 'file', 'text_note', 'sitemap')),
  CONSTRAINT kb_sources_status_check
    CHECK (status IN ('indexing', 'indexed', 'failed', 'stale'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kb_chunks_source_id_fkey'
      AND conrelid = 'public.kb_chunks'::regclass
  ) THEN
    ALTER TABLE public.kb_chunks
      ADD CONSTRAINT kb_chunks_source_id_fkey
      FOREIGN KEY (source_id)
      REFERENCES public.kb_sources(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kb_sources_org_kb
  ON public.kb_sources(org_id, kb_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_sources_org_status
  ON public.kb_sources(org_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_sources_source_url
  ON public.kb_sources(source_url)
  WHERE source_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kb_chunks_source_id
  ON public.kb_chunks(source_id)
  WHERE source_id IS NOT NULL;

DROP TRIGGER IF EXISTS kb_sources_updated_at ON public.kb_sources;
CREATE TRIGGER kb_sources_updated_at
  BEFORE UPDATE ON public.kb_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.kb_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_kb_sources ON public.kb_sources;
CREATE POLICY service_role_kb_sources
  ON public.kb_sources FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS kb_sources_select_member ON public.kb_sources;
CREATE POLICY kb_sources_select_member
  ON public.kb_sources FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS kb_sources_insert_member ON public.kb_sources;
CREATE POLICY kb_sources_insert_member
  ON public.kb_sources FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_in_org(org_id)
    AND EXISTS (
      SELECT 1
      FROM public.knowledge_bases kb
      WHERE kb.id = kb_id
        AND kb.org_id = org_id
    )
  );

DROP POLICY IF EXISTS kb_sources_update_member ON public.kb_sources;
CREATE POLICY kb_sources_update_member
  ON public.kb_sources FOR UPDATE TO authenticated
  USING (public.auth_user_in_org(org_id))
  WITH CHECK (public.auth_user_in_org(org_id));

DROP POLICY IF EXISTS kb_sources_delete_member ON public.kb_sources;
CREATE POLICY kb_sources_delete_member
  ON public.kb_sources FOR DELETE TO authenticated
  USING (public.auth_user_in_org(org_id));

-- Remove data produced by the removed AI Profile / Quality Center features.
-- These chunks were pinned/generated guidance, not user-managed KB sources.
DELETE FROM public.kb_chunks
WHERE
  metadata->>'sourceType' IN (
    'organization_ai_profile',
    'company_profile',
    'ai_profile',
    'ai_guidance_rule',
    'quality_center',
    'quality_guidance'
  )
  OR metadata->>'profileSource' = 'organization_ai_profile'
  OR metadata->>'qualityCenterSource' = 'true'
  OR metadata->>'pinned' = 'true'
  OR source_title ILIKE 'AI Profile%'
  OR source_title ILIKE 'Company Profile%'
  OR source_title ILIKE 'Quality Center%';

-- Drop removed feature tables if they exist in projects that received those
-- experimental SQL-editor migrations before the code was simplified.
DROP TABLE IF EXISTS public.canned_responses CASCADE;
DROP TABLE IF EXISTS public.organization_ai_profiles CASCADE;
DROP TABLE IF EXISTS public.ai_guidance_rules CASCADE;
DROP TABLE IF EXISTS public.ai_eval_cases CASCADE;
DROP TABLE IF EXISTS public.ai_answer_traces CASCADE;
DROP TABLE IF EXISTS public.ai_answer_feedback CASCADE;
DROP TABLE IF EXISTS public.ai_answer_debug_sessions CASCADE;
DROP TABLE IF EXISTS public.ai_answer_debug_events CASCADE;
DROP TABLE IF EXISTS public.knowledge_quality_runs CASCADE;
DROP TABLE IF EXISTS public.knowledge_quality_findings CASCADE;
DROP TABLE IF EXISTS public.knowledge_quality_sources CASCADE;
DROP TABLE IF EXISTS public.knowledge_quality_checks CASCADE;
DROP TABLE IF EXISTS public.knowledge_source_quality CASCADE;

-- Backfill source-health rows from existing chunks. New ingestion will keep
-- this table updated directly.
WITH grouped_sources AS (
  SELECT
    kb_id,
    org_id,
    CASE
      WHEN source_url IS NOT NULL AND source_url <> '' THEN 'url'
      WHEN metadata->>'sourceType' = 'file' THEN 'file'
      WHEN metadata->>'sourceType' = 'text_note' THEN 'text_note'
      WHEN source_title ILIKE '%.pdf' OR source_title ILIKE '%.docx' THEN 'file'
      ELSE 'text_note'
    END AS source_type,
    NULLIF(source_url, '') AS source_url,
    COALESCE(NULLIF(source_title, ''), 'Untitled source') AS source_title,
    COUNT(*)::int AS chunk_count,
    MIN(created_at) AS created_at,
    MAX(created_at) AS last_indexed_at
  FROM public.kb_chunks
  WHERE source_id IS NULL
  GROUP BY
    kb_id,
    org_id,
    CASE
      WHEN source_url IS NOT NULL AND source_url <> '' THEN 'url'
      WHEN metadata->>'sourceType' = 'file' THEN 'file'
      WHEN metadata->>'sourceType' = 'text_note' THEN 'text_note'
      WHEN source_title ILIKE '%.pdf' OR source_title ILIKE '%.docx' THEN 'file'
      ELSE 'text_note'
    END,
    NULLIF(source_url, ''),
    COALESCE(NULLIF(source_title, ''), 'Untitled source')
),
inserted_sources AS (
  INSERT INTO public.kb_sources (
    kb_id,
    org_id,
    source_type,
    source_url,
    source_title,
    status,
    chunk_count,
    quality_score,
    warning_codes,
    last_indexed_at,
    last_checked_at,
    metadata,
    created_at,
    updated_at
  )
  SELECT
    kb_id,
    org_id,
    source_type,
    source_url,
    source_title,
    'indexed',
    chunk_count,
    CASE
      WHEN chunk_count = 0 THEN 0
      WHEN chunk_count < 2 THEN 55
      ELSE 90
    END,
    CASE
      WHEN chunk_count < 2 THEN '["low_chunk_count"]'::jsonb
      ELSE '[]'::jsonb
    END,
    last_indexed_at,
    now(),
    jsonb_build_object('backfilled', true),
    created_at,
    now()
  FROM grouped_sources
  RETURNING id, kb_id, org_id, source_type, source_url, source_title
)
UPDATE public.kb_chunks c
SET source_id = s.id,
    metadata = c.metadata || jsonb_build_object('sourceId', s.id)
FROM inserted_sources s
WHERE c.source_id IS NULL
  AND c.kb_id = s.kb_id
  AND c.org_id = s.org_id
  AND (
    (s.source_url IS NOT NULL AND c.source_url = s.source_url)
    OR (
      s.source_url IS NULL
      AND c.source_url IS NULL
      AND COALESCE(NULLIF(c.source_title, ''), 'Untitled source') = s.source_title
    )
  );

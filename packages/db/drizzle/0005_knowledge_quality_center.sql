-- 0005_knowledge_quality_center.sql
-- Knowledge Quality Center:
--   1) Manual source quality status/review fields
--   2) Health dashboard indexes for source freshness and review workflows

ALTER TABLE public.kb_chunks
  ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS quality_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_kb_chunks_org_quality_status
  ON public.kb_chunks(org_id, quality_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_org_last_reviewed
  ON public.kb_chunks(org_id, last_reviewed_at DESC)
  WHERE last_reviewed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kb_chunks_org_last_verified
  ON public.kb_chunks(org_id, last_verified_at DESC)
  WHERE last_verified_at IS NOT NULL;


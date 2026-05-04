-- Remove deprecated AI answer feedback storage.
-- Kept as a cleanup migration for environments that already applied the first feedback table.

DROP TABLE IF EXISTS public.ai_answer_feedback;

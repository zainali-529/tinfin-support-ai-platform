-- 0004_widget_customization_advanced.sql
-- Keeps widget placement focused on bottom corners and stores advanced customization in settings JSONB.

UPDATE public.widget_configs
SET position = 'bottom-right'
WHERE position NOT IN ('bottom-right', 'bottom-left');

ALTER TABLE public.widget_configs
  DROP CONSTRAINT IF EXISTS widget_configs_position_bottom_only;

ALTER TABLE public.widget_configs
  ADD CONSTRAINT widget_configs_position_bottom_only
  CHECK (position IN ('bottom-right', 'bottom-left'));

UPDATE public.widget_configs
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'themeMode', COALESCE(settings->>'themeMode', 'light')
)
WHERE settings IS NULL OR settings->>'themeMode' IS NULL;
-- 0006_team_member_permissions.sql
-- Add customizable per-organization module permissions for team members and invites.

ALTER TABLE public.user_organizations
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.org_invitations
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill explicit defaults so existing memberships behave predictably.
UPDATE public.user_organizations
SET permissions = jsonb_build_object(
  'dashboard', true,
  'inbox', true,
  'contacts', true,
  'calls', true,
  'knowledge', true,
  'analytics', true,
  'widget', true,
  'embedding', true,
  'voiceAssistant', true,
  'cannedResponses', true,
  'channels', true
)
WHERE role = 'admin'
  AND (permissions IS NULL OR permissions = '{}'::jsonb);

UPDATE public.user_organizations
SET permissions = jsonb_build_object(
  'dashboard', true,
  'inbox', true,
  'contacts', true,
  'calls', true,
  'knowledge', true,
  'analytics', false,
  'widget', false,
  'embedding', false,
  'voiceAssistant', false,
  'cannedResponses', false,
  'channels', false
)
WHERE role <> 'admin'
  AND (permissions IS NULL OR permissions = '{}'::jsonb);

-- Keep invitation defaults aligned with agent defaults.
UPDATE public.org_invitations
SET permissions = jsonb_build_object(
  'dashboard', true,
  'inbox', true,
  'contacts', true,
  'calls', true,
  'knowledge', true,
  'analytics', false,
  'widget', false,
  'embedding', false,
  'voiceAssistant', false,
  'cannedResponses', false,
  'channels', false
)
WHERE permissions IS NULL OR permissions = '{}'::jsonb;


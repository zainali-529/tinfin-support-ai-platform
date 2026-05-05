-- Default SLA policies for launch readiness.
-- Existing organizations get an "all channels" policy and future
-- organizations receive one automatically.

INSERT INTO public.inbox_sla_policies (
  org_id,
  channel,
  first_response_target_seconds,
  next_response_target_seconds,
  resolution_target_seconds,
  is_default
)
SELECT
  org.id,
  'all',
  600,
  900,
  14400,
  TRUE
FROM public.organizations org
WHERE NOT EXISTS (
  SELECT 1
  FROM public.inbox_sla_policies policy
  WHERE policy.org_id = org.id
    AND policy.channel = 'all'
)
ON CONFLICT (org_id, channel) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_default_sla_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inbox_sla_policies (
    org_id,
    channel,
    first_response_target_seconds,
    next_response_target_seconds,
    resolution_target_seconds,
    is_default
  )
  VALUES (
    NEW.id,
    'all',
    600,
    900,
    14400,
    TRUE
  )
  ON CONFLICT (org_id, channel) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_default_sla_policy ON public.organizations;
CREATE TRIGGER organizations_default_sla_policy
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_default_sla_policy();

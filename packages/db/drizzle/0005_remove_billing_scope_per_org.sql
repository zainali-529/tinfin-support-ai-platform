-- 0005_remove_billing_scope_per_org.sql
-- Cleanup migration: remove centralized billing scope artifacts.
-- Final model: billing is per organization.

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_billing_org_id_fkey;

DROP INDEX IF EXISTS idx_organizations_billing_org_id;

ALTER TABLE organizations
  DROP COLUMN IF EXISTS billing_org_id;

-- Ensure every organization has a subscription row.
INSERT INTO subscriptions (org_id, plan, status)
SELECT org.id, COALESCE(org.plan, 'free'), 'active'
FROM organizations AS org
LEFT JOIN subscriptions AS sub
  ON sub.org_id = org.id
WHERE sub.org_id IS NULL;

UPDATE subscriptions
SET plan = 'free'
WHERE plan IS NULL;

UPDATE subscriptions
SET status = 'active'
WHERE status IS NULL;

-- Keep denormalized organizations.plan aligned with that same org subscription.
UPDATE organizations AS org
SET plan = COALESCE(sub.plan, 'free')
FROM subscriptions AS sub
WHERE sub.org_id = org.id;

-- Refresh auth signup trigger so it does not reference billing_org_id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.user_organizations (user_id, org_id, role, is_default, is_owner)
  VALUES (NEW.id, v_new_org, 'admin', true, true)
  ON CONFLICT (user_id, org_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

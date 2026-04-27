-- 0003_billing_scope_and_starter.sql
-- Billing scope support (shared subscription across linked organizations)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_org_id uuid;

-- Every org must belong to a billing scope.
UPDATE organizations
SET billing_org_id = id
WHERE billing_org_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_billing_org_id_fkey'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_billing_org_id_fkey
      FOREIGN KEY (billing_org_id)
      REFERENCES organizations(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_billing_org_id
  ON organizations(billing_org_id);

ALTER TABLE organizations
  ALTER COLUMN billing_org_id SET NOT NULL;

-- Keep denormalized organizations.plan aligned with the billing-owner subscription.
UPDATE organizations AS org
SET plan = COALESCE(sub.plan, 'free')
FROM subscriptions AS sub
WHERE sub.org_id = org.billing_org_id;

-- Ensure every billing-owner org has a subscription row.
INSERT INTO subscriptions (org_id, plan, status)
SELECT org.id, 'free', 'active'
FROM organizations AS org
LEFT JOIN subscriptions AS sub ON sub.org_id = org.id
WHERE org.billing_org_id = org.id
  AND sub.org_id IS NULL;

-- Optional manual linking example:
-- If you want to link existing orgs under one billing owner, run:
-- UPDATE organizations
-- SET billing_org_id = '<billing_owner_org_uuid>'
-- WHERE id IN ('<child_org_1_uuid>', '<child_org_2_uuid>');
-- Then re-run the plan sync query above.

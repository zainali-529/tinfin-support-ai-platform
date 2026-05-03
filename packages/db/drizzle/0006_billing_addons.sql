-- Billing add-ons for current-period usage extensions.
-- These rows are created before Stripe Checkout and activated by the Stripe webhook.

CREATE TABLE IF NOT EXISTS public.billing_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  addon_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_addons_org_period
  ON public.billing_addons(org_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_billing_addons_org_status
  ON public.billing_addons(org_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS billing_addons_checkout_session_unique
  ON public.billing_addons(stripe_checkout_session_id);

DROP TRIGGER IF EXISTS billing_addons_updated_at ON public.billing_addons;
CREATE TRIGGER billing_addons_updated_at
  BEFORE UPDATE ON public.billing_addons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.billing_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_billing_addons ON public.billing_addons;
CREATE POLICY service_role_billing_addons
  ON public.billing_addons FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS billing_addons_select_member ON public.billing_addons;
CREATE POLICY billing_addons_select_member
  ON public.billing_addons FOR SELECT TO authenticated
  USING (public.auth_user_in_org(org_id));

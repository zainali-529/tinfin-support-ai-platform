import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlan, type Plan } from './plans'

interface SubscriptionRow {
  plan?: string | null
  status?: string | null
  stripe_sub_id?: string | null
  stripe_customer_id?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
}

export interface OrgSubscription {
  orgId: string
  planId: string
  plan: Plan
  status: string
  stripeSubId: string | null
  stripeCustomerId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export async function getOrgSubscription(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgSubscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      'plan,status,stripe_sub_id,stripe_customer_id,current_period_end,cancel_at_period_end'
    )
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) throw error

  const row = (data as SubscriptionRow | null) ?? null
  const planId = (row?.plan ?? 'free') as string

  return {
    orgId,
    planId,
    plan: getPlan(planId),
    status: (row?.status ?? 'active') as string,
    stripeSubId: (row?.stripe_sub_id ?? null) as string | null,
    stripeCustomerId: (row?.stripe_customer_id ?? null) as string | null,
    currentPeriodEnd: (row?.current_period_end ?? null) as string | null,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end ?? false),
  }
}

export async function getOrgPlanId(
  supabase: SupabaseClient,
  orgId: string
): Promise<string> {
  const sub = await getOrgSubscription(supabase, orgId)
  return sub.planId
}

export async function getOrgPlan(
  supabase: SupabaseClient,
  orgId: string
): Promise<Plan> {
  const sub = await getOrgSubscription(supabase, orgId)
  return sub.plan
}

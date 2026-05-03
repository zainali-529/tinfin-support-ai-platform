import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlan, type Plan } from './plans'

export type SubscriptionAccessMode = 'active' | 'grace' | 'restricted'

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
  accessMode: SubscriptionAccessMode
  isBillingActive: boolean
  isBillingRestricted: boolean
  graceEndsAt: string | null
}

const ACTIVE_STATUSES = new Set(['active', 'trialing'])
const BILLING_GRACE_DAYS = 7

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function getBillingPeriodStart(currentPeriodEnd: string | null): Date {
  if (currentPeriodEnd) {
    const end = new Date(currentPeriodEnd)
    if (!Number.isNaN(end.getTime())) {
      const start = new Date(end)
      start.setMonth(start.getMonth() - 1)
      return start
    }
  }

  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export function getBillingPeriodEnd(currentPeriodEnd: string | null): Date {
  if (currentPeriodEnd) {
    const end = new Date(currentPeriodEnd)
    if (!Number.isNaN(end.getTime())) return end
  }

  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

export function getSubscriptionAccess(params: {
  planId: string
  status: string
  currentPeriodEnd: string | null
}): {
  accessMode: SubscriptionAccessMode
  isBillingActive: boolean
  isBillingRestricted: boolean
  graceEndsAt: string | null
} {
  if (params.planId === 'free') {
    return {
      accessMode: 'active',
      isBillingActive: true,
      isBillingRestricted: false,
      graceEndsAt: null,
    }
  }

  if (ACTIVE_STATUSES.has(params.status)) {
    return {
      accessMode: 'active',
      isBillingActive: true,
      isBillingRestricted: false,
      graceEndsAt: null,
    }
  }

  if (params.status === 'past_due') {
    const periodEnd = getBillingPeriodEnd(params.currentPeriodEnd)
    const graceEnd = addDays(periodEnd, BILLING_GRACE_DAYS)
    const inGrace = Date.now() <= graceEnd.getTime()

    return {
      accessMode: inGrace ? 'grace' : 'restricted',
      isBillingActive: inGrace,
      isBillingRestricted: !inGrace,
      graceEndsAt: graceEnd.toISOString(),
    }
  }

  return {
    accessMode: 'restricted',
    isBillingActive: false,
    isBillingRestricted: true,
    graceEndsAt: null,
  }
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
  const status = (row?.status ?? 'active') as string
  const currentPeriodEnd = (row?.current_period_end ?? null) as string | null
  const access = getSubscriptionAccess({
    planId,
    status,
    currentPeriodEnd,
  })

  return {
    orgId,
    planId,
    plan: getPlan(planId),
    status,
    stripeSubId: (row?.stripe_sub_id ?? null) as string | null,
    stripeCustomerId: (row?.stripe_customer_id ?? null) as string | null,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end ?? false),
    ...access,
  }
}

export async function getOrgPlanId(
  supabase: SupabaseClient,
  orgId: string
): Promise<string> {
  const sub = await getOrgSubscription(supabase, orgId)
  return sub.isBillingRestricted ? 'free' : sub.planId
}

export async function getOrgPlan(
  supabase: SupabaseClient,
  orgId: string
): Promise<Plan> {
  const sub = await getOrgSubscription(supabase, orgId)
  return sub.plan
}

import { TRPCError } from '@trpc/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BILLING_ADD_ONS,
  getBillingAddOn,
  type BillingAddOnId,
  type Plan,
  type PlanLimitKey,
} from './plans'
import {
  getBillingPeriodEnd,
  getBillingPeriodStart,
  getOrgSubscription,
  type OrgSubscription,
} from './subscriptions'

export type UsageLimitKey =
  | 'teamMembers'
  | 'knowledgeBases'
  | 'kbChunks'
  | 'conversationsPerMonth'
  | 'voiceMinutesPerMonth'

export type PublicLimitKey =
  | 'teamMembers'
  | 'knowledgeBases'
  | 'kbChunks'
  | 'conversations'
  | 'voiceMinutes'

export type EffectiveLimits = Record<UsageLimitKey, number>

export interface ActiveBillingAddOn {
  id: string
  addOnId: BillingAddOnId
  name: string
  quantity: number
  unitAmount: number
  limitKey: UsageLimitKey
  totalUnits: number
  periodStart: string
  periodEnd: string
  status: string
}

export interface BillingLimitSummary {
  subscription: OrgSubscription
  periodStart: Date
  periodEnd: Date
  baseLimits: EffectiveLimits
  addOnLimits: EffectiveLimits
  effectiveLimits: EffectiveLimits
  activeAddOns: ActiveBillingAddOn[]
}

const ZERO_LIMITS: EffectiveLimits = {
  teamMembers: 0,
  knowledgeBases: 0,
  kbChunks: 0,
  conversationsPerMonth: 0,
  voiceMinutesPerMonth: 0,
}

export function toPublicLimitKey(key: UsageLimitKey): PublicLimitKey {
  if (key === 'conversationsPerMonth') return 'conversations'
  if (key === 'voiceMinutesPerMonth') return 'voiceMinutes'
  return key
}

export function toUsageLimitKey(key: keyof Plan['limits']): UsageLimitKey {
  return key as UsageLimitKey
}

export function planLimitsToEffective(plan: Plan): EffectiveLimits {
  return {
    teamMembers: plan.limits.teamMembers,
    knowledgeBases: plan.limits.knowledgeBases,
    kbChunks: plan.limits.kbChunks,
    conversationsPerMonth: plan.limits.conversationsPerMonth,
    voiceMinutesPerMonth: plan.limits.voiceMinutesPerMonth,
  }
}

function addLimits(base: EffectiveLimits, additions: EffectiveLimits): EffectiveLimits {
  const next = { ...base }

  for (const key of Object.keys(next) as UsageLimitKey[]) {
    if (next[key] === -1) continue
    next[key] += additions[key] ?? 0
  }

  return next
}

function emptyLimits(): EffectiveLimits {
  return { ...ZERO_LIMITS }
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || /billing_addons/i.test(error.message ?? '')
}

export async function getActiveBillingAddOns(
  supabase: SupabaseClient,
  orgId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ActiveBillingAddOn[]> {
  const { data, error } = await supabase
    .from('billing_addons')
    .select('id, addon_id, quantity, status, period_start, period_end, metadata')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .lte('period_start', periodEnd.toISOString())
    .gte('period_end', periodStart.toISOString())

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(`Failed to load billing add-ons: ${error.message}`)
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .reduce<ActiveBillingAddOn[]>((items, row) => {
      const addOn = getBillingAddOn(row.addon_id as string)
      if (!addOn) return items
      const quantity = typeof row.quantity === 'number' ? row.quantity : 1
      const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>
      const limitKey = addOn.limitKey as UsageLimitKey
      const customUnits = metadata.pricingModel === 'custom_units'
        ? Number(metadata.requestedUnits ?? metadata.totalUnits ?? quantity)
        : NaN
      const totalUnits = Number.isFinite(customUnits) && customUnits > 0
        ? Math.trunc(customUnits)
        : addOn.unitAmount * quantity

      items.push({
        id: row.id as string,
        addOnId: addOn.id as BillingAddOnId,
        name: addOn.name as string,
        quantity,
        unitAmount: addOn.unitAmount,
        limitKey,
        totalUnits,
        periodStart: row.period_start as string,
        periodEnd: row.period_end as string,
        status: row.status as string,
      })

      return items
    }, [])
}

export async function getBillingLimitSummary(
  supabase: SupabaseClient,
  orgId: string,
  subscription?: OrgSubscription
): Promise<BillingLimitSummary> {
  const orgSub = subscription ?? await getOrgSubscription(supabase, orgId)
  const periodStart = getBillingPeriodStart(orgSub.currentPeriodEnd)
  const periodEnd = getBillingPeriodEnd(orgSub.currentPeriodEnd)
  const baseLimits = planLimitsToEffective(orgSub.plan)
  const addOnLimits = emptyLimits()
  const activeAddOns = orgSub.isBillingRestricted
    ? []
    : await getActiveBillingAddOns(supabase, orgId, periodStart, periodEnd)

  for (const addOn of activeAddOns) {
    addOnLimits[addOn.limitKey] += addOn.totalUnits
  }

  return {
    subscription: orgSub,
    periodStart,
    periodEnd,
    baseLimits,
    addOnLimits,
    effectiveLimits: addLimits(baseLimits, addOnLimits),
    activeAddOns,
  }
}

export function publicLimits(limits: EffectiveLimits): Record<PublicLimitKey, number> {
  return {
    teamMembers: limits.teamMembers,
    knowledgeBases: limits.knowledgeBases,
    kbChunks: limits.kbChunks,
    conversations: limits.conversationsPerMonth,
    voiceMinutes: limits.voiceMinutesPerMonth,
  }
}

export function addOnCatalog() {
  return Object.values(BILLING_ADD_ONS)
}

export function assertBillingWritable(subscription: OrgSubscription): void {
  if (!subscription.isBillingRestricted) return

  throw new TRPCError({
    code: 'FORBIDDEN',
    message:
      'This workspace is in restricted billing mode. Please update billing to continue using paid features.',
  })
}

export async function requireEffectiveLimit(
  supabase: SupabaseClient,
  orgId: string,
  limitKey: PlanLimitKey,
  currentCount: number
): Promise<void> {
  const summary = await getBillingLimitSummary(supabase, orgId)
  assertBillingWritable(summary.subscription)

  const key = toUsageLimitKey(limitKey)
  const max = summary.effectiveLimits[key]
  if (max === -1 || currentCount < max) return

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `You've reached the ${max} ${toPublicLimitKey(key)} limit for this billing period. Buy an add-on or upgrade your plan.`,
  })
}

export async function canStartConversation(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ allowed: boolean; reason: 'ok' | 'billing_restricted' | 'limit_reached'; limit: number; used: number }> {
  const summary = await getBillingLimitSummary(supabase, orgId)
  if (summary.subscription.isBillingRestricted) {
    return { allowed: false, reason: 'billing_restricted', limit: 0, used: 0 }
  }

  const { count, error } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('started_at', summary.periodStart.toISOString())

  if (error) {
    throw new Error(`Failed to count conversations: ${error.message}`)
  }

  const limit = summary.effectiveLimits.conversationsPerMonth
  const used = count ?? 0
  return {
    allowed: limit === -1 || used < limit,
    reason: limit !== -1 && used >= limit ? 'limit_reached' : 'ok',
    limit,
    used,
  }
}

export async function canUseVoiceNow(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ allowed: boolean; reason: 'ok' | 'billing_restricted' | 'limit_reached' | 'not_included'; limit: number; used: number }> {
  const summary = await getBillingLimitSummary(supabase, orgId)
  if (summary.subscription.isBillingRestricted) {
    return { allowed: false, reason: 'billing_restricted', limit: 0, used: 0 }
  }

  const limit = summary.effectiveLimits.voiceMinutesPerMonth
  if (limit <= 0) return { allowed: false, reason: 'not_included', limit, used: 0 }

  const { data, error } = await supabase
    .from('calls')
    .select('duration_seconds')
    .eq('org_id', orgId)
    .gte('created_at', summary.periodStart.toISOString())
    .not('duration_seconds', 'is', null)

  if (error) {
    throw new Error(`Failed to count voice usage: ${error.message}`)
  }

  const seconds = ((data ?? []) as Array<{ duration_seconds: number | null }>).reduce(
    (sum, row) => sum + (row.duration_seconds ?? 0),
    0
  )
  const used = Math.ceil(seconds / 60)

  return {
    allowed: used < limit,
    reason: used >= limit ? 'limit_reached' : 'ok',
    limit,
    used,
  }
}

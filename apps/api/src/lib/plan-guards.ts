/**
 * apps/api/src/lib/plan-guards.ts
 *
 * Reusable helpers to enforce subscription limits in routers.
 * Import these in any router that needs plan-based gating.
 *
 * Usage:
 *   import { requireFeature, requireLimit } from '../lib/plan-guards'
 *   await requireFeature(ctx.supabase, orgId, 'voiceCalls')
 *   await requireLimit(ctx.supabase, orgId, 'teamMembers', currentCount)
 */

import { TRPCError } from '@trpc/server'
import { getPlan, planAllows, withinLimit, type Plan } from './plans'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgPlanId } from './subscriptions'

async function getOrgPlan(supabase: SupabaseClient, orgId: string): Promise<string> {
  return getOrgPlanId(supabase, orgId)
}

const FEATURE_NAMES: Record<string, string> = {
  chatWidget: 'Chat Widget',
  aiResponses: 'AI Responses',
  knowledgeBase: 'Knowledge Base',
  emailChannel: 'Email Channel',
  whatsappChannel: 'WhatsApp Channel',
  widgetCustomization: 'Widget Customization',
  voiceCalls: 'Voice Calls',
  teamMembers: 'Team Members',
  analytics: 'Analytics',
  customBranding: 'Custom Branding',
  prioritySupport: 'Priority Support',
}

const LIMIT_NAMES: Record<string, string> = {
  conversations: 'conversations',
  voiceMinutes: 'voice minutes',
  teamMembers: 'team members',
  knowledgeBases: 'knowledge bases',
  kbChunks: 'knowledge base storage',
}

const REQUIRED_PLAN: Record<string, 'starter' | 'pro' | 'scale'> = {
  emailChannel: 'starter',
  whatsappChannel: 'starter',
  widgetCustomization: 'starter',
  voiceCalls: 'pro',
  teamMembers: 'starter',
  analytics: 'pro',
  customBranding: 'pro',
  prioritySupport: 'scale',
}

const PLAN_NAMES: Record<'starter' | 'pro' | 'scale', string> = {
  starter: 'Starter',
  pro: 'Pro',
  scale: 'Scale',
}

/**
 * Assert that the org's plan includes a specific feature.
 * Throws FORBIDDEN with an upgrade message if not allowed.
 */
export async function requireFeature(
  supabase: SupabaseClient,
  orgId: string,
  feature: keyof Plan['features']
): Promise<void> {
  const planId = await getOrgPlan(supabase, orgId)
  if (!planAllows(planId, feature)) {
    const requiredPlan = REQUIRED_PLAN[feature as string] ?? 'starter'
    const featureName = FEATURE_NAMES[feature as string] ?? feature
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `${featureName} requires the ${PLAN_NAMES[requiredPlan]} plan. Please upgrade at /billing.`,
    })
  }
}

/**
 * Assert that the org's current usage of a metric is within the plan limit.
 * currentCount = current number BEFORE the new item is added.
 */
export async function requireLimit(
  supabase: SupabaseClient,
  orgId: string,
  limitKey: keyof Plan['limits'],
  currentCount: number
): Promise<void> {
  const planId = await getOrgPlan(supabase, orgId)
  if (!withinLimit(planId, limitKey, currentCount)) {
    const plan = getPlan(planId)
    const maxVal = plan.limits[limitKey]
    const name = LIMIT_NAMES[limitKey as string] ?? limitKey
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `You've reached the ${maxVal} ${name} limit on your ${plan.name} plan. Upgrade at /billing to add more.`,
    })
  }
}

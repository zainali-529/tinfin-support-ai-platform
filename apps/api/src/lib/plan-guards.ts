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
import { getPlan, planAllows, type Plan } from './plans'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgSubscription } from './subscriptions'
import { assertBillingWritable, requireEffectiveLimit } from './billing-limits'

async function getOrgPlan(supabase: SupabaseClient, orgId: string): Promise<string> {
  const sub = await getOrgSubscription(supabase, orgId)
  return sub.isBillingRestricted ? 'free' : sub.planId
}

const FEATURE_NAMES: Record<string, string> = {
  chatWidget: 'Chat Widget',
  aiResponses: 'AI Responses',
  knowledgeBase: 'Knowledge Base',
  aiActions: 'AI Actions',
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
  aiActions: 'pro',
  emailChannel: 'pro',
  whatsappChannel: 'pro',
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
  const orgSub = await getOrgSubscription(supabase, orgId)
  if (orgSub.isBillingRestricted) {
    assertBillingWritable(orgSub)
  }

  const planId = orgSub.planId
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
  try {
    await requireEffectiveLimit(supabase, orgId, limitKey, currentCount)
  } catch (error) {
    if (error instanceof TRPCError) {
      if (error.message.toLowerCase().includes('restricted billing mode')) {
        throw error
      }

      const planId = await getOrgPlan(supabase, orgId)
      const plan = getPlan(planId)
      const maxVal = plan.limits[limitKey]
      const name = LIMIT_NAMES[limitKey as string] ?? limitKey

      if (error.code === 'FORBIDDEN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `You've reached your ${name} limit for this billing period. Buy an add-on at /billing or upgrade your plan.`,
        })
      }

      throw new TRPCError({
        code: error.code,
        message: error.message || `You've reached the ${maxVal} ${name} limit on your ${plan.name} plan.`,
      })
    }
    throw error
  }
}

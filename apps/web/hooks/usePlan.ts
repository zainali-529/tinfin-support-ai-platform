'use client'

/**
 * apps/web/hooks/usePlan.ts
 *
 * Single hook for plan/subscription info on the frontend.
 * Used everywhere to gate UI and show upgrade prompts.
 *
 * Usage:
 *   const { plan, usage, limits, canUse, isLoading } = usePlan()
 *   if (!canUse('voiceCalls')) return <UpgradePrompt feature="Voice Calls" />
 */

import { trpc } from '@/lib/trpc'

export type FeatureKey =
  | 'chatWidget'
  | 'aiResponses'
  | 'knowledgeBase'
  | 'widgetCustomization'
  | 'voiceCalls'
  | 'teamMembers'
  | 'analytics'
  | 'customBranding'
  | 'prioritySupport'

export type LimitKey =
  | 'conversations'
  | 'voiceMinutes'
  | 'teamMembers'
  | 'knowledgeBases'
  | 'kbChunks'
  | 'organizations'

export function usePlan() {
  const { data: sub, isLoading: subLoading } = trpc.billing.getSubscription.useQuery(undefined, {
    staleTime: 60_000,
  })

  const { data: usageData, isLoading: usageLoading } = trpc.usage.getUsage.useQuery(undefined, {
    staleTime: 30_000,
  })

  /**
   * Check if the current plan includes a feature.
   * Returns true when loading (don't block UI during load).
   */
  function canUse(feature: FeatureKey): boolean {
    if (!sub?.planDetails) return true
    return (sub.planDetails.features as Record<string, boolean>)[feature] ?? false
  }

  /**
   * Check if current usage is within the plan limit.
   * -1 = unlimited → always returns true.
   */
  function withinLimit(key: LimitKey): boolean {
    if (!usageData) return true
    const limit = usageData.limits[key]
    if (limit === -1) return true
    return usageData.usage[key] < limit
  }

  /**
   * Percentage used for a limit (0-100). Returns 0 for unlimited.
   */
  function usagePercent(key: LimitKey): number {
    if (!usageData) return 0
    const limit = usageData.limits[key]
    if (limit === -1 || limit === 0) return 0
    return Math.min(100, Math.round((usageData.usage[key] / limit) * 100))
  }

  /**
   * Get remaining for a limit. Returns Infinity for unlimited.
   */
  function remaining(key: LimitKey): number {
    if (!usageData) return Infinity
    const limit = usageData.limits[key]
    if (limit === -1) return Infinity
    return Math.max(0, limit - usageData.usage[key])
  }

  return {
    planId: sub?.plan ?? 'free',
    planName: sub?.planDetails?.name ?? 'Free',
    planDetails: sub?.planDetails ?? null,
    status: sub?.status ?? 'active',
    isActive: sub?.isActive ?? true,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    usage: usageData?.usage ?? null,
    limits: usageData?.limits ?? null,
    periodStart: usageData?.periodStart ?? null,
    isLoading: subLoading || usageLoading,
    canUse,
    withinLimit,
    usagePercent,
    remaining,
  }
}
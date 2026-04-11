/**
 * apps/api/src/lib/plans.ts
 *
 * Single source of truth for all subscription plan definitions.
 * These constants are shared by the billing router, middleware, and frontend.
 *
 * Plans:
 *   free   — default for new orgs, no credit card
 *   pro    — $29/month — small teams
 *   scale  — $79/month — growing businesses
 */

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started — forever free',
    price: 0,
    stripePriceId: null,
    limits: {
      teamMembers: 1,          // admin only, no agents
      knowledgeBases: 1,
      kbChunks: 100,           // ~200 pages
      conversationsPerMonth: 50,
      voiceMinutesPerMonth: 0, // no voice
      organizations: 1,
    },
    features: {
      chatWidget: true,
      aiResponses: true,
      knowledgeBase: true,
      widgetCustomization: false,
      voiceCalls: false,
      teamMembers: false,
      analytics: false,
      customBranding: false,
      prioritySupport: false,
    },
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For growing support teams',
    price: 29,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? '',
    limits: {
      teamMembers: 5,
      knowledgeBases: 5,
      kbChunks: 2000,
      conversationsPerMonth: 1000,
      voiceMinutesPerMonth: 100,
      organizations: 1,
    },
    features: {
      chatWidget: true,
      aiResponses: true,
      knowledgeBase: true,
      widgetCustomization: true,
      voiceCalls: true,
      teamMembers: true,
      analytics: true,
      customBranding: true,
      prioritySupport: false,
    },
  },

  scale: {
    id: 'scale',
    name: 'Scale',
    description: 'For businesses at scale',
    price: 79,
    stripePriceId: process.env.STRIPE_PRICE_SCALE ?? '',
    limits: {
      teamMembers: 20,
      knowledgeBases: 20,
      kbChunks: 20000,
      conversationsPerMonth: -1,  // unlimited (-1 = no limit)
      voiceMinutesPerMonth: 500,
      organizations: 3,
    },
    features: {
      chatWidget: true,
      aiResponses: true,
      knowledgeBase: true,
      widgetCustomization: true,
      voiceCalls: true,
      teamMembers: true,
      analytics: true,
      customBranding: true,
      prioritySupport: true,
    },
  },
} as const

export type PlanId = keyof typeof PLANS
export type Plan = typeof PLANS[PlanId]

export function getPlan(planId: string | null | undefined): Plan {
  const id = (planId ?? 'free') as PlanId
  return PLANS[id] ?? PLANS.free
}

/**
 * Check if a plan allows a specific feature.
 * Usage: canUsePlan('pro', 'voiceCalls') => true
 */
export function planAllows(planId: string | null | undefined, feature: keyof Plan['features']): boolean {
  return getPlan(planId).features[feature]
}

/**
 * Check if a numeric limit is within the plan's allowed amount.
 * -1 means unlimited.
 */
export function withinLimit(planId: string | null | undefined, limit: keyof Plan['limits'], current: number): boolean {
  const max = getPlan(planId).limits[limit]
  if (max === -1) return true  // unlimited
  return current < max
}
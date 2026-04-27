/**
 * apps/api/src/lib/plans.ts
 *
 * Single source of truth for all subscription plan definitions.
 */

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started - forever free',
    price: 0,
    stripePriceId: null,
    limits: {
      teamMembers: 1,
      knowledgeBases: 1,
      kbChunks: 100,
      conversationsPerMonth: 50,
      voiceMinutesPerMonth: 0,
    },
    features: {
      chatWidget: true,
      aiResponses: true,
      knowledgeBase: true,
      emailChannel: false,
      whatsappChannel: false,
      widgetCustomization: false,
      voiceCalls: false,
      teamMembers: false,
      analytics: false,
      customBranding: false,
      prioritySupport: false,
    },
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For solo operators and early teams',
    price: 19,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? '',
    limits: {
      teamMembers: 2,
      knowledgeBases: 3,
      kbChunks: 750,
      conversationsPerMonth: 300,
      voiceMinutesPerMonth: 0,
    },
    features: {
      chatWidget: true,
      aiResponses: true,
      knowledgeBase: true,
      emailChannel: true,
      whatsappChannel: true,
      widgetCustomization: true,
      voiceCalls: false,
      teamMembers: true,
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
    },
    features: {
      chatWidget: true,
      aiResponses: true,
      knowledgeBase: true,
      emailChannel: true,
      whatsappChannel: true,
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
      conversationsPerMonth: -1,
      voiceMinutesPerMonth: 500,
    },
    features: {
      chatWidget: true,
      aiResponses: true,
      knowledgeBase: true,
      emailChannel: true,
      whatsappChannel: true,
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

export function planAllows(
  planId: string | null | undefined,
  feature: keyof Plan['features']
): boolean {
  return getPlan(planId).features[feature]
}

export function withinLimit(
  planId: string | null | undefined,
  limit: keyof Plan['limits'],
  current: number
): boolean {
  const max = getPlan(planId).limits[limit]
  if (max === -1) return true
  return current < max
}

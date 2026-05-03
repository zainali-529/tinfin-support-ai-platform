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
      aiActions: false,
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
      aiActions: false,
      emailChannel: false,
      whatsappChannel: false,
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
      conversationsPerMonth: 1500,
      voiceMinutesPerMonth: 60,
    },
    features: {
      chatWidget: true,
      aiResponses: true,
      knowledgeBase: true,
      aiActions: true,
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
      conversationsPerMonth: 6000,
      voiceMinutesPerMonth: 250,
    },
    features: {
      chatWidget: true,
      aiResponses: true,
      knowledgeBase: true,
      aiActions: true,
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
export type PlanLimitKey = keyof Plan['limits']
export type PlanFeatureKey = keyof Plan['features']

export const BILLING_ADD_ONS = {
  conversations_1000: {
    id: 'conversations_1000',
    name: 'Extra Conversations',
    description: 'Add a custom number of extra conversations for the current billing period.',
    price: 10,
    priceCents: 1000,
    limitKey: 'conversationsPerMonth',
    unitAmount: 1000,
    unitLabel: 'conversations',
    minUnits: 1000,
    defaultUnits: 1000,
    maxUnits: 100000,
  },
  voice_100: {
    id: 'voice_100',
    name: 'Extra Voice Minutes',
    description: 'Add a custom number of extra voice minutes for the current billing period.',
    price: 12.5,
    priceCents: 1250,
    limitKey: 'voiceMinutesPerMonth',
    unitAmount: 50,
    unitLabel: 'voice minutes',
    minUnits: 50,
    defaultUnits: 50,
    maxUnits: 10000,
    requiresFeature: 'voiceCalls',
  },
  team_seat_1: {
    id: 'team_seat_1',
    name: 'Extra Team Seats',
    description: 'Add a custom number of extra team member seats for the current billing period.',
    price: 8,
    priceCents: 800,
    limitKey: 'teamMembers',
    unitAmount: 1,
    unitLabel: 'team members',
    minUnits: 1,
    defaultUnits: 1,
    maxUnits: 100,
    requiresFeature: 'teamMembers',
  },
  knowledge_base_1: {
    id: 'knowledge_base_1',
    name: 'Extra Knowledge Bases',
    description: 'Add a custom number of extra knowledge bases for the current billing period.',
    price: 5,
    priceCents: 500,
    limitKey: 'knowledgeBases',
    unitAmount: 1,
    unitLabel: 'knowledge bases',
    minUnits: 1,
    defaultUnits: 1,
    maxUnits: 100,
    requiresFeature: 'knowledgeBase',
  },
  kb_chunks_5000: {
    id: 'kb_chunks_5000',
    name: 'Extra Knowledge Storage',
    description: 'Add a custom number of extra indexed KB chunks for the current billing period.',
    price: 5,
    priceCents: 500,
    limitKey: 'kbChunks',
    unitAmount: 2500,
    unitLabel: 'KB chunks',
    minUnits: 2500,
    defaultUnits: 2500,
    maxUnits: 1000000,
    requiresFeature: 'knowledgeBase',
  },
} as const

export type BillingAddOnId = keyof typeof BILLING_ADD_ONS
export type BillingAddOn = typeof BILLING_ADD_ONS[BillingAddOnId]

export function getBillingAddOn(addOnId: string | null | undefined): BillingAddOn | null {
  if (!addOnId) return null
  return BILLING_ADD_ONS[addOnId as BillingAddOnId] ?? null
}

export function getPlan(planId: string | null | undefined): Plan {
  const id = (planId ?? 'free') as PlanId
  return PLANS[id] ?? PLANS.free
}

export function planAllows(
  planId: string | null | undefined,
  feature: PlanFeatureKey
): boolean {
  return getPlan(planId).features[feature]
}

export function withinLimit(
  planId: string | null | undefined,
  limit: PlanLimitKey,
  current: number
): boolean {
  const max: number = getPlan(planId).limits[limit]
  if (max === -1) return true
  return current < max
}

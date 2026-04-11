/**
 * apps/api/src/routers/billing.router.ts
 *
 * Stripe billing integration.
 *
 * Procedures:
 *   getSubscription  — current plan + subscription status for the active org
 *   createCheckout   — Stripe checkout session (upgrade)
 *   createPortal     — Stripe customer portal (manage / cancel)
 *   getPlans         — public plan list for pricing page
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import Stripe from 'stripe'
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc'
import { PLANS, getPlan, type PlanId } from '../lib/plans'

// ─── Stripe client ─────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured.' })
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertAdmin(supabase: any, userId: string, orgId: string) {
  const { data } = await supabase.from('user_organizations').select('role').eq('user_id', userId).eq('org_id', orgId).maybeSingle()
  if (!data || data.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can manage billing.' })
}

async function getOrCreateStripeCustomer(supabase: any, stripe: Stripe, orgId: string, orgName: string): Promise<string> {
  // Check if stripe_customer_id already saved
  const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('org_id', orgId).maybeSingle()

  if (sub?.stripe_customer_id) return sub.stripe_customer_id as string

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    name: orgName,
    metadata: { org_id: orgId },
  })

  // Upsert subscription row with customer id
  await supabase.from('subscriptions').upsert(
    { org_id: orgId, stripe_customer_id: customer.id, plan: 'free', status: 'active' },
    { onConflict: 'org_id' }
  )

  return customer.id
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const billingRouter = router({

  /**
   * Public plan list for the pricing page.
   */
  getPlans: publicProcedure.query(() => {
    return Object.values(PLANS).map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      limits: plan.limits,
      features: plan.features,
    }))
  }),

  /**
   * Current subscription for the active org.
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId

    const { data: sub } = await ctx.supabase
      .from('subscriptions')
      .select('plan, status, stripe_sub_id, stripe_customer_id, current_period_end, cancel_at_period_end')
      .eq('org_id', orgId)
      .maybeSingle()

    const planId = (sub?.plan ?? 'free') as PlanId
    const plan = getPlan(planId)

    return {
      plan: planId,
      planDetails: plan,
      status: (sub?.status ?? 'active') as string,
      stripeSubId: (sub?.stripe_sub_id ?? null) as string | null,
      currentPeriodEnd: (sub?.current_period_end ?? null) as string | null,
      cancelAtPeriodEnd: (sub?.cancel_at_period_end ?? false) as boolean,
      isActive: !sub || sub.status === 'active' || sub.status === 'trialing',
    }
  }),

  /**
   * Invoice history from Stripe for the active org.
   */
  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    await assertAdmin(ctx.supabase, ctx.user.id, orgId)

    const { data: sub } = await ctx.supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('org_id', orgId)
      .maybeSingle()

    if (!sub?.stripe_customer_id) return []

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) return []

    try {
      const res = await fetch(
        `https://api.stripe.com/v1/invoices?customer=${encodeURIComponent(sub.stripe_customer_id as string)}&limit=12`,
        { headers: { Authorization: `Bearer ${stripeKey}` } }
      )

      if (!res.ok) return []

      const data = await res.json() as {
        data: Array<{
          id: string
          amount_paid: number
          currency: string
          status: string
          created: number
          invoice_pdf: string | null
          hosted_invoice_url: string | null
          period_start: number
          period_end: number
          number: string | null
        }>
      }

      return data.data.map((inv) => ({
        id: inv.id,
        number: inv.number ?? inv.id.slice(-8).toUpperCase(),
        amountPaid: inv.amount_paid,
        currency: inv.currency.toUpperCase(),
        status: inv.status,
        createdAt: new Date(inv.created * 1000).toISOString(),
        periodStart: new Date(inv.period_start * 1000).toISOString(),
        periodEnd: new Date(inv.period_end * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf,
        hostedUrl: inv.hosted_invoice_url,
      }))
    } catch {
      return []
    }
  }),

  /**
   * Create a Stripe Checkout session for upgrading.
   * Returns a URL the frontend redirects to.
   */
  createCheckout: protectedProcedure
    .input(z.object({
      planId: z.enum(['pro', 'scale']),
      successUrl: z.string().url().optional(),
      cancelUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertAdmin(ctx.supabase, ctx.user.id, orgId)

      const targetPlan = PLANS[input.planId]
      if (!targetPlan.stripePriceId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This plan is not available for purchase.' })
      }

      const stripe = getStripe()

      const { data: org } = await ctx.supabase.from('organizations').select('name').eq('id', orgId).single()
      const customerId = await getOrCreateStripeCustomer(ctx.supabase, stripe, orgId, org?.name ?? 'Organization')

      // Check if already has a subscription (upgrade scenario)
      const { data: existingSub } = await ctx.supabase.from('subscriptions').select('stripe_sub_id').eq('org_id', orgId).maybeSingle()

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: targetPlan.stripePriceId, quantity: 1 }],
        success_url: input.successUrl ?? `${webUrl}/settings/billing?success=true`,
        cancel_url: input.cancelUrl ?? `${webUrl}/settings/billing?cancelled=true`,
        metadata: { org_id: orgId, plan_id: input.planId },
        subscription_data: {
          metadata: { org_id: orgId, plan_id: input.planId },
        },
        // Allow proration for upgrades
        ...(existingSub?.stripe_sub_id ? { customer_update: { name: 'auto' } } : {}),
      })

      return { url: session.url! }
    }),

  /**
   * Create a Stripe Customer Portal session for managing subscription.
   */
  createPortal: protectedProcedure
    .input(z.object({ returnUrl: z.string().url().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertAdmin(ctx.supabase, ctx.user.id, orgId)

      const stripe = getStripe()

      const { data: sub } = await ctx.supabase.from('subscriptions').select('stripe_customer_id').eq('org_id', orgId).maybeSingle()

      if (!sub?.stripe_customer_id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No billing account found. Please upgrade first.' })
      }

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        return_url: input.returnUrl ?? `${webUrl}/settings/billing`,
      })

      return { url: session.url }
    }),
})
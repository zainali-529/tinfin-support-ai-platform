/**
 * apps/api/src/routers/billing.router.ts
 *
 * Stripe billing integration with per-organization subscriptions.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import Stripe from 'stripe'
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc'
import { PLANS, type PlanId } from '../lib/plans'
import { getOrgSubscription } from '../lib/subscriptions'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured.' })
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

async function assertOrgAdmin(supabase: any, userId: string, orgId: string): Promise<void> {
  const { data: membership, error } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to verify billing permissions: ${error.message}`,
    })
  }

  if (membership?.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only organization admins can manage billing.',
    })
  }
}

async function getOrCreateStripeCustomer(
  supabase: any,
  stripe: Stripe,
  orgId: string,
  orgName: string
): Promise<string> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('org_id', orgId)
    .maybeSingle()

  if (sub?.stripe_customer_id) return sub.stripe_customer_id as string

  const customer = await stripe.customers.create({
    name: orgName,
    metadata: { org_id: orgId },
  })

  await supabase
    .from('subscriptions')
    .upsert(
      {
        org_id: orgId,
        stripe_customer_id: customer.id,
        plan: 'free',
        status: 'active',
      },
      { onConflict: 'org_id' }
    )

  return customer.id
}

export const billingRouter = router({
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

  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const orgSub = await getOrgSubscription(ctx.supabase, ctx.userOrgId)

    return {
      plan: orgSub.planId as PlanId,
      planDetails: orgSub.plan,
      status: orgSub.status,
      stripeSubId: orgSub.stripeSubId,
      currentPeriodEnd: orgSub.currentPeriodEnd,
      cancelAtPeriodEnd: orgSub.cancelAtPeriodEnd,
      isActive: orgSub.status === 'active' || orgSub.status === 'trialing',
      canManageBilling: ctx.userRole === 'admin',
    }
  }),

  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

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

      const data = (await res.json()) as {
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

  createCheckout: protectedProcedure
    .input(
      z.object({
        planId: z.enum(['starter', 'pro', 'scale']),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      const targetPlan = PLANS[input.planId]
      if (!targetPlan.stripePriceId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This plan is not available for purchase.' })
      }

      const stripe = getStripe()

      const { data: org } = await ctx.supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()

      const customerId = await getOrCreateStripeCustomer(
        ctx.supabase,
        stripe,
        orgId,
        org?.name ?? 'Organization'
      )

      const { data: existingSub } = await ctx.supabase
        .from('subscriptions')
        .select('stripe_sub_id,status')
        .eq('org_id', orgId)
        .maybeSingle()

      if (
        existingSub?.stripe_sub_id &&
        existingSub.status &&
        ['active', 'trialing', 'past_due', 'unpaid'].includes(existingSub.status)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This organization already has a Stripe subscription. Use Billing Portal to change plan.',
        })
      }

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: targetPlan.stripePriceId, quantity: 1 }],
        success_url: input.successUrl ?? `${webUrl}/billing?success=true`,
        cancel_url: input.cancelUrl ?? `${webUrl}/billing?cancelled=true`,
        metadata: {
          action: 'org_upgrade',
          org_id: orgId,
          plan_id: input.planId,
        },
        subscription_data: {
          metadata: {
            action: 'org_upgrade',
            org_id: orgId,
            plan_id: input.planId,
          },
        },
      })

      return { url: session.url! }
    }),

  createPortal: protectedProcedure
    .input(z.object({ returnUrl: z.string().url().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      const stripe = getStripe()

      const { data: sub } = await ctx.supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('org_id', orgId)
        .maybeSingle()

      if (!sub?.stripe_customer_id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No billing account found. Please upgrade first.' })
      }

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        return_url: input.returnUrl ?? `${webUrl}/billing`,
      })

      return { url: session.url }
    }),
})

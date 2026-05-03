/**
 * apps/api/src/routers/billing.router.ts
 *
 * Stripe billing integration with per-organization subscriptions.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import Stripe from 'stripe'
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc'
import { BILLING_ADD_ONS, PLANS, getBillingAddOn, planAllows, type BillingAddOnId, type PlanId } from '../lib/plans'
import { getBillingPeriodEnd, getBillingPeriodStart, getOrgSubscription } from '../lib/subscriptions'
import { addOnCatalog, getActiveBillingAddOns } from '../lib/billing-limits'
import {
  checkoutDiscountParams,
  priceSummaryForTarget,
  promotionCodesEnabled,
  trialDaysForPlan,
} from '../lib/billing-pricing'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured.' })
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

function getOptionalStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key, { apiVersion: '2024-06-20' }) : null
}

function calculateCustomUnitAmountCents(params: {
  priceCents: number
  baseUnits: number
  requestedUnits: number
}): number {
  return Math.max(1, Math.ceil((params.priceCents * params.requestedUnits) / params.baseUnits))
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
  getPlans: publicProcedure.query(async () => {
    const stripe = getOptionalStripe()
    return Promise.all(Object.values(PLANS).map(async (plan) => {
      const planId = plan.id as PlanId
      const trialDays = trialDaysForPlan(planId)
      const pricing = planId === 'free'
        ? null
        : await priceSummaryForTarget({
          stripe,
          target: { type: 'plan', planId: planId as Exclude<PlanId, 'free'> },
          subtotalCents: plan.price * 100,
          trialDays,
        })

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        priceCents: plan.price * 100,
        limits: plan.limits,
        features: plan.features,
        trialDays,
        promotionCodesEnabled: promotionCodesEnabled(pricing?.discount?.couponId),
        pricing,
      }
    }))
  }),

  getAddOns: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    const orgSub = await getOrgSubscription(ctx.supabase, orgId)
    const periodStart = getBillingPeriodStart(orgSub.currentPeriodEnd)
    const periodEnd = getBillingPeriodEnd(orgSub.currentPeriodEnd)
    const activeAddOns = await getActiveBillingAddOns(ctx.supabase, orgId, periodStart, periodEnd)
    const stripe = getOptionalStripe()

    return {
      addOns: await Promise.all(addOnCatalog().map(async (addOn) => {
        const pricing = await priceSummaryForTarget({
          stripe,
          target: { type: 'addon', addOnId: addOn.id as BillingAddOnId },
          subtotalCents: addOn.priceCents,
        })

        return {
          id: addOn.id,
          name: addOn.name,
          description: addOn.description,
          price: addOn.price,
          priceCents: addOn.priceCents,
          unitAmount: addOn.unitAmount,
          unitLabel: addOn.unitLabel,
          minUnits: addOn.minUnits,
          defaultUnits: addOn.defaultUnits,
          maxUnits: addOn.maxUnits,
          limitKey: addOn.limitKey,
          requiresFeature: 'requiresFeature' in addOn ? addOn.requiresFeature : null,
          pricing,
        }
      })),
      activeAddOns,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    }
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
      accessMode: orgSub.accessMode,
      isActive: orgSub.isBillingActive,
      isBillingRestricted: orgSub.isBillingRestricted,
      graceEndsAt: orgSub.graceEndsAt,
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

      const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
        metadata: {
          action: 'org_upgrade',
          org_id: orgId,
          plan_id: input.planId,
        },
      }
      const trialDays = trialDaysForPlan(input.planId)
      if (trialDays) {
        subscriptionData.trial_period_days = trialDays
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        ...checkoutDiscountParams({ type: 'plan', planId: input.planId }),
        line_items: [{ price: targetPlan.stripePriceId, quantity: 1 }],
        success_url: input.successUrl ?? `${webUrl}/billing?success=true`,
        cancel_url: input.cancelUrl ?? `${webUrl}/billing?cancelled=true`,
        metadata: {
          action: 'org_upgrade',
          org_id: orgId,
          plan_id: input.planId,
        },
        subscription_data: subscriptionData,
      })

      return { url: session.url! }
    }),

  createAddOnCheckout: protectedProcedure
    .input(
      z.object({
        addOnId: z.enum(Object.keys(BILLING_ADD_ONS) as [BillingAddOnId, ...BillingAddOnId[]]),
        units: z.number().int().min(1).max(1000000).optional(),
        quantity: z.number().int().min(1).max(1000000).optional(),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId
      await assertOrgAdmin(ctx.supabase, ctx.user.id, orgId)

      const addOn = getBillingAddOn(input.addOnId)
      if (!addOn) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown billing add-on.' })
      }

      const orgSub = await getOrgSubscription(ctx.supabase, orgId)
      if (orgSub.isBillingRestricted) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Please update billing before buying add-ons.',
        })
      }

      if (orgSub.planId === 'free') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Add-ons require an active paid plan.',
        })
      }

      if ('requiresFeature' in addOn && addOn.requiresFeature && !planAllows(orgSub.planId, addOn.requiresFeature)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `${addOn.name} requires a plan that includes this feature.`,
        })
      }

      const requestedUnits = input.units ?? (input.quantity ? input.quantity * addOn.unitAmount : addOn.defaultUnits)
      if (requestedUnits < addOn.minUnits || requestedUnits > addOn.maxUnits) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${addOn.name} must be between ${addOn.minUnits.toLocaleString()} and ${addOn.maxUnits.toLocaleString()} ${addOn.unitLabel}.`,
        })
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

      const periodStart = getBillingPeriodStart(orgSub.currentPeriodEnd)
      const periodEnd = getBillingPeriodEnd(orgSub.currentPeriodEnd)
      const amountCents = calculateCustomUnitAmountCents({
        priceCents: addOn.priceCents,
        baseUnits: addOn.unitAmount,
        requestedUnits,
      })

      const insertResult = await ctx.supabase
        .from('billing_addons')
        .insert({
          org_id: orgId,
          addon_id: addOn.id,
          quantity: requestedUnits,
          status: 'pending',
          amount_cents: amountCents,
          currency: 'usd',
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          expires_at: periodEnd.toISOString(),
          metadata: {
            pricingModel: 'custom_units',
            requestedUnits,
            totalUnits: requestedUnits,
            baseUnitAmount: addOn.unitAmount,
            basePriceCents: addOn.priceCents,
            unitLabel: addOn.unitLabel,
            limitKey: addOn.limitKey,
          },
        })
        .select('id')
        .single()

      if (insertResult.error || !insertResult.data?.id) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create add-on order: ${insertResult.error?.message ?? 'Unknown error'}`,
        })
      }

      const webUrl = process.env.WEB_URL || 'http://localhost:3000'
      const billingAddOnId = insertResult.data.id as string
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        ...checkoutDiscountParams({ type: 'addon', addOnId: input.addOnId }),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: amountCents,
              product_data: {
                name: `${addOn.name} - ${requestedUnits.toLocaleString()} ${addOn.unitLabel}`,
                description: `${requestedUnits.toLocaleString()} ${addOn.unitLabel} for the current billing period.`,
                metadata: {
                  addon_id: addOn.id,
                  org_id: orgId,
                  requested_units: String(requestedUnits),
                },
              },
            },
          },
        ],
        success_url: input.successUrl ?? `${webUrl}/billing?addon=success`,
        cancel_url: input.cancelUrl ?? `${webUrl}/billing?addon=cancelled`,
        metadata: {
          action: 'addon_purchase',
          org_id: orgId,
          addon_id: addOn.id,
          quantity: String(requestedUnits),
          requested_units: String(requestedUnits),
          base_unit_amount: String(addOn.unitAmount),
          billing_addon_id: billingAddOnId,
        },
        payment_intent_data: {
          metadata: {
            action: 'addon_purchase',
            org_id: orgId,
            addon_id: addOn.id,
            quantity: String(requestedUnits),
            requested_units: String(requestedUnits),
            base_unit_amount: String(addOn.unitAmount),
            billing_addon_id: billingAddOnId,
          },
        },
      })

      await ctx.supabase
        .from('billing_addons')
        .update({
          stripe_checkout_session_id: session.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', billingAddOnId)
        .eq('org_id', orgId)

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

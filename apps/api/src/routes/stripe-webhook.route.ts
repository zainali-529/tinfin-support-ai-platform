/**
 * apps/api/src/routes/stripe-webhook.route.ts
 *
 * Stripe webhook handler.
 * Events handled:
 *   checkout.session.completed      → activate subscription
 *   customer.subscription.updated   → plan change / renewal
 *   customer.subscription.deleted   → downgrade to free
 *   invoice.payment_failed          → mark past_due
 *
 * IMPORTANT: Must use raw body. Register BEFORE express.json() in index.ts.
 *
 * Register in index.ts:
 *   import { stripeWebhookRoute } from './routes/stripe-webhook.route'
 *   app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookRoute)
 */

import { Router, type Request, type Response } from 'express'
import Stripe from 'stripe'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const stripeWebhookRoute: Router = Router()

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
}

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** Map Stripe price ID → our plan ID */
function priceIdToPlanId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_SCALE) return 'scale'
  return 'free'
}

async function upsertSubscription(
  supabase: SupabaseClient,
  orgId: string,
  data: {
    stripe_sub_id?: string | null
    stripe_customer_id?: string | null
    plan?: string
    status?: string
    current_period_end?: string | null
    cancel_at_period_end?: boolean
  }
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .upsert({ org_id: orgId, ...data }, { onConflict: 'org_id' })

  if (error) console.error('[stripe-webhook] DB upsert error:', error.message)

  // Also update organizations.plan for quick access
  if (data.plan) {
    await supabase.from('organizations').update({ plan: data.plan }).eq('id', orgId)
  }
}

stripeWebhookRoute.post('/', async (req: Request, res: Response) => {
  const stripe = getStripe()
  const supabase = getSupabase()

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    console.warn('[stripe-webhook] Missing signature or webhook secret')
    return res.status(400).json({ error: 'Missing signature' })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', (err as Error).message)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  // Always respond 200 quickly
  res.status(200).json({ received: true })

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const orgId = session.metadata?.org_id
        const planId = session.metadata?.plan_id ?? 'free'
        const customerId = session.customer as string
        const subId = session.subscription as string

        if (!orgId) { console.warn('[stripe-webhook] No org_id in checkout metadata'); break }

        // Fetch subscription to get period_end
        const sub = await stripe.subscriptions.retrieve(subId)
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

        await upsertSubscription(supabase, orgId, {
          stripe_sub_id: subId,
          stripe_customer_id: customerId,
          plan: planId,
          status: 'active',
          current_period_end: periodEnd,
          cancel_at_period_end: false,
        })

        console.log(`[stripe-webhook] checkout.session.completed: org=${orgId} plan=${planId}`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        const priceId = sub.items.data[0]?.price?.id ?? ''
        const planId = priceIdToPlanId(priceId)
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

        await upsertSubscription(supabase, orgId, {
          stripe_sub_id: sub.id,
          stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          plan: sub.status === 'canceled' ? 'free' : planId,
          status: sub.status,
          current_period_end: periodEnd,
          cancel_at_period_end: sub.cancel_at_period_end,
        })

        console.log(`[stripe-webhook] subscription.updated: org=${orgId} plan=${planId} status=${sub.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        await upsertSubscription(supabase, orgId, {
          plan: 'free',
          status: 'canceled',
          stripe_sub_id: null,
          cancel_at_period_end: false,
        })

        console.log(`[stripe-webhook] subscription.deleted: org=${orgId} → downgraded to free`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null
        if (!subId) break

        const sub = await stripe.subscriptions.retrieve(subId)
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        await upsertSubscription(supabase, orgId, { status: 'past_due' })
        console.log(`[stripe-webhook] payment_failed: org=${orgId}`)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[stripe-webhook] Processing error:', err)
  }
})
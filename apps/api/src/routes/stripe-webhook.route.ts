/**
 * apps/api/src/routes/stripe-webhook.route.ts
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

function priceIdToPlanId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter'
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_SCALE) return 'scale'
  return 'free'
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 48)
}

function shortId(): string {
  return Math.random().toString(36).substring(2, 8)
}

async function buildUniqueSlug(
  supabase: SupabaseClient,
  preferredSlug: string | null,
  orgName: string
): Promise<string> {
  const baseSlug = (preferredSlug && preferredSlug.trim()) || slugify(orgName) || 'organization'
  let slug = baseSlug

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) return slug
    slug = `${baseSlug}-${shortId()}`
  }

  return `${baseSlug}-${shortId()}`
}

async function ensureOrganizationForCreateAction(
  supabase: SupabaseClient,
  params: {
    orgId: string
    orgName: string
    orgSlug: string | null
    ownerUserId: string
    planId: string
  }
): Promise<void> {
  const existingOrg = await supabase
    .from('organizations')
    .select('id')
    .eq('id', params.orgId)
    .maybeSingle()

  if (existingOrg.data?.id) {
    await supabase
      .from('organizations')
      .update({ plan: params.planId })
      .eq('id', params.orgId)
  } else {
    const slug = await buildUniqueSlug(supabase, params.orgSlug, params.orgName)

    const orgInsert = await supabase
      .from('organizations')
      .insert({
        id: params.orgId,
        name: params.orgName,
        slug,
        plan: params.planId,
      })
      .select('id')
      .maybeSingle()

    if (orgInsert.error && !orgInsert.error.message.toLowerCase().includes('duplicate key')) {
      console.error('[stripe-webhook] Failed to create organization:', orgInsert.error.message)
      return
    }
  }

  await supabase.from('widget_configs').upsert({ org_id: params.orgId }, { onConflict: 'org_id' })

  await supabase
    .from('user_organizations')
    .upsert(
      {
        user_id: params.ownerUserId,
        org_id: params.orgId,
        role: 'admin',
        is_default: false,
        is_owner: true,
      },
      { onConflict: 'user_id,org_id' }
    )

  await supabase
    .from('users')
    .update({ active_org_id: params.orgId })
    .eq('id', params.ownerUserId)
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

  if (error) {
    console.error('[stripe-webhook] DB upsert error:', error.message)
    return
  }

  if (data.plan) {
    const { error: orgUpdateError } = await supabase
      .from('organizations')
      .update({ plan: data.plan })
      .eq('id', orgId)

    if (orgUpdateError) {
      console.error('[stripe-webhook] Failed to sync organization plan:', orgUpdateError.message)
    }
  }
}

async function resolveOrgIdFromSubscription(stripe: Stripe, sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.org_id
  if (fromMeta) return fromMeta

  if (typeof sub.customer !== 'string') {
    if ('deleted' in sub.customer && sub.customer.deleted) return null
    return sub.customer.metadata?.org_id ?? null
  }

  const customer = await stripe.customers.retrieve(sub.customer)
  if ('deleted' in customer && customer.deleted) return null
  return customer.metadata?.org_id ?? null
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

  res.status(200).json({ received: true })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const orgId = session.metadata?.org_id
        const action = session.metadata?.action ?? 'org_upgrade'
        const planId = session.metadata?.plan_id ?? 'free'
        const customerId = session.customer as string | null
        const subId = session.subscription as string | null

        if (!orgId || !subId) {
          console.warn('[stripe-webhook] Missing org_id or subscription id in checkout metadata')
          break
        }

        if (action === 'org_create') {
          const ownerUserId = session.metadata?.owner_user_id
          const orgName = session.metadata?.org_name ?? 'Organization'
          const orgSlug = session.metadata?.org_slug ?? null

          if (!ownerUserId) {
            console.warn('[stripe-webhook] Missing owner_user_id for org_create checkout')
            break
          }

          await ensureOrganizationForCreateAction(supabase, {
            orgId,
            orgName,
            orgSlug,
            ownerUserId,
            planId,
          })
        }

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

        console.log(`[stripe-webhook] checkout.session.completed: org=${orgId} plan=${planId} action=${action}`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = await resolveOrgIdFromSubscription(stripe, sub)
        if (!orgId) break

        if (sub.metadata?.action === 'org_create' && sub.metadata?.owner_user_id) {
          await ensureOrganizationForCreateAction(supabase, {
            orgId,
            orgName: sub.metadata?.org_name ?? 'Organization',
            orgSlug: sub.metadata?.org_slug ?? null,
            ownerUserId: sub.metadata.owner_user_id,
            planId: sub.metadata?.plan_id ?? 'free',
          })
        }

        const priceId = sub.items.data[0]?.price?.id ?? ''
        const planIdFromPrice = priceIdToPlanId(priceId)
        const planId = planIdFromPrice === 'free'
          ? (sub.metadata?.plan_id ?? 'free')
          : planIdFromPrice
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
        const orgId = await resolveOrgIdFromSubscription(stripe, sub)
        if (!orgId) break

        await upsertSubscription(supabase, orgId, {
          plan: 'free',
          status: 'canceled',
          stripe_sub_id: null,
          cancel_at_period_end: false,
        })

        console.log(`[stripe-webhook] subscription.deleted: org=${orgId} downgraded to free`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null
        if (!subId) break

        const sub = await stripe.subscriptions.retrieve(subId)
        const orgId = await resolveOrgIdFromSubscription(stripe, sub)
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

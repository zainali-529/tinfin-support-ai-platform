/**
 * apps/api/src/routers/usage.router.ts
 *
 * Real-time usage tracking per org per billing period.
 */

import { router, protectedProcedure } from '../trpc/trpc'
import { getOrgSubscription } from '../lib/subscriptions'

function getBillingPeriodStart(currentPeriodEnd: string | null): Date {
  if (currentPeriodEnd) {
    const end = new Date(currentPeriodEnd)
    const start = new Date(end)
    start.setMonth(start.getMonth() - 1)
    return start
  }

  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export const usageRouter = router({
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    const orgSub = await getOrgSubscription(ctx.supabase, orgId)
    const plan = orgSub.plan

    const periodStart = getBillingPeriodStart(orgSub.currentPeriodEnd ?? null)
    const periodStartIso = periodStart.toISOString()

    const [
      conversationsResult,
      voiceResult,
      membersResult,
      kbResult,
      chunksResult,
    ] = await Promise.all([
      ctx.supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('started_at', periodStartIso),

      ctx.supabase
        .from('calls')
        .select('duration_seconds')
        .eq('org_id', orgId)
        .gte('created_at', periodStartIso)
        .not('duration_seconds', 'is', null),

      ctx.supabase
        .from('user_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      ctx.supabase
        .from('knowledge_bases')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      ctx.supabase
        .from('kb_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
    ])

    const conversationsCount = conversationsResult.count ?? 0
    const voiceSeconds = (voiceResult.data ?? []).reduce(
      (sum, call) => sum + ((call.duration_seconds as number) || 0),
      0
    )
    const voiceMinutes = Math.ceil(voiceSeconds / 60)

    return {
      planId: orgSub.planId,
      planName: plan.name,
      periodStart: periodStartIso,
      periodEnd: orgSub.currentPeriodEnd ?? null,
      usage: {
        conversations: conversationsCount,
        voiceMinutes,
        teamMembers: membersResult.count ?? 0,
        knowledgeBases: kbResult.count ?? 0,
        kbChunks: chunksResult.count ?? 0,
      },
      limits: {
        conversations: plan.limits.conversationsPerMonth,
        voiceMinutes: plan.limits.voiceMinutesPerMonth,
        teamMembers: plan.limits.teamMembers,
        knowledgeBases: plan.limits.knowledgeBases,
        kbChunks: plan.limits.kbChunks,
      },
    }
  }),

  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId

    const { data: membership } = await ctx.supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', ctx.user.id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (membership?.role !== 'admin') return []

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
        `https://api.stripe.com/v1/invoices?customer=${encodeURIComponent(
          sub.stripe_customer_id as string
        )}&limit=12`,
        {
          headers: { Authorization: `Bearer ${stripeKey}` },
        }
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
})

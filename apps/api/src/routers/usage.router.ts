/**
 * apps/api/src/routers/usage.router.ts
 *
 * Real-time usage tracking per org per billing period.
 */

import { router, protectedProcedure } from '../trpc/trpc'
import { getOrgSubscription } from '../lib/subscriptions'
import { getBillingLimitSummary, publicLimits } from '../lib/billing-limits'
import { getApiDb, sql } from '../lib/db'

interface UsageAggregateRow {
  conversations: unknown
  voice_seconds: unknown
  team_members: unknown
  knowledge_bases: unknown
  kb_chunks: unknown
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export const usageRouter = router({
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId
    const orgSub = await getOrgSubscription(ctx.supabase, orgId)
    const plan = orgSub.plan
    const billingSummary = await getBillingLimitSummary(ctx.supabase, orgId, orgSub)
    const periodStart = billingSummary.periodStart
    const periodStartIso = periodStart.toISOString()

    const rows = await getApiDb().execute(sql<UsageAggregateRow>`
      WITH params AS (
        SELECT
          CAST(${orgId} AS uuid) AS org_id,
          CAST(${periodStartIso} AS timestamptz) AS period_start
      ),
      conversations_usage AS (
        SELECT COUNT(*) AS conversations
        FROM public.conversations c
        CROSS JOIN params p
        WHERE c.org_id = p.org_id
          AND c.started_at >= p.period_start
      ),
      voice_usage AS (
        SELECT COALESCE(SUM(duration_seconds), 0) AS voice_seconds
        FROM public.calls c
        CROSS JOIN params p
        WHERE c.org_id = p.org_id
          AND c.created_at >= p.period_start
          AND c.duration_seconds IS NOT NULL
      ),
      member_usage AS (
        SELECT COUNT(*) AS team_members
        FROM public.user_organizations uo
        CROSS JOIN params p
        WHERE uo.org_id = p.org_id
      ),
      knowledge_usage AS (
        SELECT COUNT(*) AS knowledge_bases
        FROM public.knowledge_bases kb
        CROSS JOIN params p
        WHERE kb.org_id = p.org_id
      ),
      chunk_usage AS (
        SELECT COUNT(*) AS kb_chunks
        FROM public.kb_chunks kc
        CROSS JOIN params p
        WHERE kc.org_id = p.org_id
      )
      SELECT *
      FROM conversations_usage,
        voice_usage,
        member_usage,
        knowledge_usage,
        chunk_usage
    `)
    const usage = (rows as unknown as UsageAggregateRow[])[0]
    const conversationsCount = toNumber(usage?.conversations)
    const voiceSeconds = toNumber(usage?.voice_seconds)
    const voiceMinutes = Math.ceil(voiceSeconds / 60)

    return {
      planId: orgSub.planId,
      planName: plan.name,
      periodStart: periodStartIso,
      periodEnd: orgSub.currentPeriodEnd ?? null,
      accessMode: orgSub.accessMode,
      isBillingRestricted: orgSub.isBillingRestricted,
      graceEndsAt: orgSub.graceEndsAt,
      usage: {
        conversations: conversationsCount,
        voiceMinutes,
        teamMembers: toNumber(usage?.team_members),
        knowledgeBases: toNumber(usage?.knowledge_bases),
        kbChunks: toNumber(usage?.kb_chunks),
      },
      baseLimits: publicLimits(billingSummary.baseLimits),
      addOnLimits: publicLimits(billingSummary.addOnLimits),
      limits: publicLimits(billingSummary.effectiveLimits),
      activeAddOns: billingSummary.activeAddOns,
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

/**
 * apps/api/src/routers/usage.router.ts
 *
 * Real-time usage tracking per org per billing period.
 * All values computed live from existing tables — no extra tracking table needed.
 *
 * Tracked metrics:
 *   - conversationsThisMonth  → count from conversations where started_at >= period_start
 *   - voiceMinutesThisMonth   → sum(duration_seconds)/60 from calls
 *   - teamMembersCount        → count from user_organizations
 *   - knowledgeBasesCount     → count from knowledge_bases
 *   - kbChunksCount           → count from kb_chunks
 *   - organizationsCount      → count of orgs the user belongs to
 */

import { router, protectedProcedure } from '../trpc/trpc'
import { getPlan } from '../lib/plans'

// ─── Helper: billing period start ────────────────────────────────────────────

function getBillingPeriodStart(currentPeriodEnd: string | null): Date {
  if (currentPeriodEnd) {
    // Billing period is monthly → start = end - 30 days
    const end = new Date(currentPeriodEnd)
    const start = new Date(end)
    start.setMonth(start.getMonth() - 1)
    return start
  }
  // Free plan: always use calendar month start
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const usageRouter = router({

  /**
   * Full usage stats for the active org in the current billing period.
   * Returns both current usage AND plan limits for UI progress bars.
   */
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId

    // Get subscription info (plan + period)
    const { data: sub } = await ctx.supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, stripe_customer_id')
      .eq('org_id', orgId)
      .maybeSingle()

    const planId = (sub?.plan ?? 'free') as string
    const plan = getPlan(planId)
    const periodStart = getBillingPeriodStart(sub?.current_period_end ?? null)
    const periodStartIso = periodStart.toISOString()

    // Run all usage queries in parallel
    const [
      conversationsResult,
      voiceResult,
      membersResult,
      kbResult,
      chunksResult,
      orgsResult,
    ] = await Promise.all([
      // Conversations this billing period
      ctx.supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('started_at', periodStartIso),

      // Voice minutes this billing period (sum duration_seconds from calls)
      ctx.supabase
        .from('calls')
        .select('duration_seconds')
        .eq('org_id', orgId)
        .gte('created_at', periodStartIso)
        .not('duration_seconds', 'is', null),

      // Team members
      ctx.supabase
        .from('user_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      // Knowledge bases
      ctx.supabase
        .from('knowledge_bases')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      // KB chunks
      ctx.supabase
        .from('kb_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      // Organizations this user belongs to (for org limit)
      ctx.supabase
        .from('user_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ctx.user.id),
    ])

    const conversationsCount = conversationsResult.count ?? 0

    // Sum voice seconds and convert to minutes
    const voiceSeconds = (voiceResult.data ?? []).reduce(
      (sum, call) => sum + ((call.duration_seconds as number) || 0), 0
    )
    const voiceMinutes = Math.ceil(voiceSeconds / 60)

    const membersCount = membersResult.count ?? 0
    const kbCount = kbResult.count ?? 0
    const chunksCount = chunksResult.count ?? 0
    const orgsCount = orgsResult.count ?? 0

    return {
      planId,
      planName: plan.name,
      periodStart: periodStartIso,
      periodEnd: sub?.current_period_end ?? null,
      usage: {
        conversations: conversationsCount,
        voiceMinutes,
        teamMembers: membersCount,
        knowledgeBases: kbCount,
        kbChunks: chunksCount,
        organizations: orgsCount,
      },
      limits: {
        conversations: plan.limits.conversationsPerMonth,   // -1 = unlimited
        voiceMinutes: plan.limits.voiceMinutesPerMonth,
        teamMembers: plan.limits.teamMembers,
        knowledgeBases: plan.limits.knowledgeBases,
        kbChunks: plan.limits.kbChunks,
        organizations: plan.limits.organizations,
      },
    }
  }),

  /**
   * Invoice history from Stripe.
   * Returns last 12 invoices with amount, date, status, and PDF link.
   */
  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.userOrgId

    const { data: sub } = await ctx.supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('org_id', orgId)
      .maybeSingle()

    if (!sub?.stripe_customer_id) return []

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) return []

    try {
      // Fetch invoices from Stripe API directly
      const res = await fetch(
        `https://api.stripe.com/v1/invoices?customer=${encodeURIComponent(sub.stripe_customer_id as string)}&limit=12`,
        {
          headers: { Authorization: `Bearer ${stripeKey}` },
        }
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
})
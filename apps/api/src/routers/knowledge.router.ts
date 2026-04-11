/**
 * KNOWLEDGE ROUTER — Multi-Org Fixed
 *
 * Same fix as chat.router.ts: use ctx.userOrgId from middleware instead of
 * requireOrgAccess(ctx.userOrgId, input.orgId) which caused 403 on org switch.
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'
import { requireLimit } from '../lib/plan-guards'

export const knowledgeRouter = router({
  getKnowledgeBases: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(), // kept for backward compat
    }).optional())
    .query(async ({ ctx }) => {
      const orgId = ctx.userOrgId // middleware-validated active org

      const { data } = await ctx.supabase
        .from('knowledge_bases')
        .select('*')
        .eq('org_id', orgId)
      return data ?? []
    }),

  createKnowledgeBase: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(), // kept for backward compat
      name: z.string().min(1),
      sourceType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId

      const { count: kbCount } = await ctx.supabase
        .from('knowledge_bases')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
      await requireLimit(ctx.supabase, orgId, 'knowledgeBases', kbCount ?? 0)

      const { data } = await ctx.supabase
        .from('knowledge_bases')
        .insert({ org_id: orgId, name: input.name, source_type: input.sourceType })
        .select()
        .single()
      return data
    }),

  deleteKnowledgeBase: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.userOrgId

      await ctx.supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', input.id)
        .eq('org_id', orgId) // ensures we only delete from active org
      return { success: true }
    }),
})
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'

function requireOrgAccess(userOrgId: string, requestedOrgId: string) {
  if (requestedOrgId !== userOrgId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization access denied.' })
  }
  return userOrgId
}

export const knowledgeRouter = router({
  getKnowledgeBases: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = requireOrgAccess(ctx.userOrgId, input.orgId)
      const { data } = await ctx.supabase
        .from('knowledge_bases')
        .select('*')
        .eq('org_id', orgId)
      return data ?? []
    }),

  createKnowledgeBase: protectedProcedure
    .input(z.object({ orgId: z.string().uuid(), name: z.string().min(1), sourceType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrgAccess(ctx.userOrgId, input.orgId)
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
      await ctx.supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', input.id)
        .eq('org_id', ctx.userOrgId)
      return { success: true }
    }),
})
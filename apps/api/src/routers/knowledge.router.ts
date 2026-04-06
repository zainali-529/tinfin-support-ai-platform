import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'

export const knowledgeRouter = router({
  getKnowledgeBases: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('knowledge_bases')
        .select('*')
        .eq('org_id', input.orgId)
      return data ?? []
    }),

  createKnowledgeBase: protectedProcedure
    .input(z.object({ orgId: z.string().uuid(), name: z.string().min(1), sourceType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('knowledge_bases')
        .insert({ org_id: input.orgId, name: input.name, source_type: input.sourceType })
        .select()
        .single()
      return data
    }),

  deleteKnowledgeBase: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('knowledge_bases').delete().eq('id', input.id)
      return { success: true }
    }),
})
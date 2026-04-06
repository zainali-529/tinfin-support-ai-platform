import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'

export const chatRouter = router({
  getConversations: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('conversations')
        .select('*, contacts(*), messages(id, role, content, created_at)')
        .eq('org_id', input.orgId)
        .order('started_at', { ascending: false })
        .limit(50)
      return data ?? []
    }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', input.conversationId)
        .order('created_at', { ascending: true })
      return data ?? []
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      status: z.enum(['bot', 'pending', 'open', 'resolved', 'closed']),
      assignedTo: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from('conversations')
        .update({ status: input.status, assigned_to: input.assignedTo ?? null })
        .eq('id', input.conversationId)
        .select()
        .single()
      return data
    }),
})
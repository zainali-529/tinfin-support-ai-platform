import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'

function requireOrgAccess(userOrgId: string, requestedOrgId: string) {
  if (requestedOrgId !== userOrgId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization access denied.' })
  }
  return userOrgId
}

export const chatRouter = router({
  getConversations: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = requireOrgAccess(ctx.userOrgId, input.orgId)
      const { data } = await ctx.supabase
        .from('conversations')
        .select('*, contacts(*), messages(id, role, content, created_at)')
        .eq('org_id', orgId)
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
        .eq('org_id', ctx.userOrgId)
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
        .eq('org_id', ctx.userOrgId)
        .select()
        .single()

      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      return data
    }),
})
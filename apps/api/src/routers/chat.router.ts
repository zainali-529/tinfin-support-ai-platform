/**
 * CHAT ROUTER — Multi-Org Fixed
 *
 * ROOT CAUSE OF BUG: requireOrgAccess(ctx.userOrgId, input.orgId) threw 403 when:
 *   ctx.userOrgId = active_org_id (new org, resolved by middleware)
 *   input.orgId   = org_id        (old org, from stale frontend state)
 *
 * FIX: The tRPC middleware (protectedProcedure) already:
 *   1. Resolves the correct active org from active_org_id ?? org_id
 *   2. Verifies the user is a member of that org via user_organizations
 *   3. Sets ctx.userOrgId to the verified active org ID
 *
 * Therefore ctx.userOrgId IS the authoritative, security-validated org.
 * We use it directly instead of trusting input.orgId.
 * input.orgId is still accepted in the schema for backward compat but
 * is no longer used for access control.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'

export const chatRouter = router({
  getConversations: protectedProcedure
    .input(z.object({
      // orgId kept in input schema for backward compat with existing client code,
      // but ctx.userOrgId (from middleware) is always used for the actual query.
      orgId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx }) => {
      // Use ctx.userOrgId — the middleware already validated org membership
      const orgId = ctx.userOrgId

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
      const orgId = ctx.userOrgId

      const { data } = await ctx.supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', input.conversationId)
        .eq('org_id', orgId)           // enforces org isolation at DB level
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
      const orgId = ctx.userOrgId

      const { data } = await ctx.supabase
        .from('conversations')
        .update({ status: input.status, assigned_to: input.assignedTo ?? null })
        .eq('id', input.conversationId)
        .eq('org_id', orgId)           // scoped to active org
        .select()
        .single()

      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      }

      return data
    }),
})
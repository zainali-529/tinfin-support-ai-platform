/**
 * KNOWLEDGE ROUTER — Multi-Org Fixed
 *
 * Same fix as chat.router.ts: use ctx.userOrgId from middleware instead of
 * requireOrgAccess(ctx.userOrgId, input.orgId) which caused 403 on org switch.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { requireLimit } from '../lib/plan-guards'
import { requirePermissionFromContext } from '../lib/org-permissions'

export const knowledgeRouter = router({
  getKnowledgeBases: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(), // kept for backward compat
    }).optional())
    .query(async ({ ctx }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
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
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
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
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      await ctx.supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', input.id)
        .eq('org_id', orgId) // ensures we only delete from active org
      return { success: true }
    }),

  deleteKnowledgeSource: protectedProcedure
    .input(
      z.object({
        kbId: z.string().uuid(),
        sourceUrl: z.string().nullable().optional(),
        sourceTitle: z.string().nullable().optional(),
        type: z.enum(['url', 'file', 'text']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId
      const sourceUrl = input.sourceUrl?.trim() || null
      const sourceTitle = input.sourceTitle?.trim() || null

      if (!sourceUrl && !sourceTitle) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Source URL or title is required.',
        })
      }

      const { data: kb } = await ctx.supabase
        .from('knowledge_bases')
        .select('id')
        .eq('id', input.kbId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (!kb) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Knowledge base not found.',
        })
      }

      let query = ctx.supabase
        .from('kb_chunks')
        .delete()
        .eq('kb_id', input.kbId)
        .eq('org_id', orgId)

      if (sourceUrl) {
        query = query.eq('source_url', sourceUrl)
      } else {
        query = query.is('source_url', null).eq('source_title', sourceTitle)
      }

      if (input.type === 'url') {
        query = query.filter('metadata->>sourceType', 'eq', 'url')
      } else if (input.type === 'file') {
        query = query.filter('metadata->>sourceType', 'eq', 'file')
      } else if (input.type === 'text') {
        query = query.filter('metadata->>sourceType', 'eq', 'text_note')
      }

      const { error } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete source: ${error.message}`,
        })
      }

      return { success: true }
    }),
})

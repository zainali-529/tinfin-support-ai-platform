/**
 * INGEST ROUTER — Multi-Org Fixed
 *
 * Same fix: use ctx.userOrgId from middleware.
 * Also fixes assertKnowledgeBaseAccess to use ctx.userOrgId for the org scope check.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { ingestUrl, ingestFile, queryRAG } from '@workspace/ai'
import { requireLimit } from '../lib/plan-guards'
import { requirePermissionFromContext } from '../lib/org-permissions'

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

async function assertKnowledgeBaseAccess(
  supabase: any,
  orgId: string,
  kbId: string
) {
  const { data } = await supabase
    .from('knowledge_bases')
    .select('id')
    .eq('id', kbId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!data) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Knowledge base access denied.' })
  }
}

export const ingestRouter = router({
  ingestUrl: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid().optional(), // kept for backward compat
        kbId: z.string().uuid(),
        url: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId // use middleware-resolved org
      await assertKnowledgeBaseAccess(ctx.supabase, orgId, input.kbId)

      const { count: chunkCount } = await ctx.supabase
        .from('kb_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
      await requireLimit(ctx.supabase, orgId, 'kbChunks', chunkCount ?? 0)

      const result = await ingestUrl({
        url: input.url,
        kbId: input.kbId,
        orgId,
      })
      return result
    }),

  ingestFile: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid().optional(), // kept for backward compat
        kbId: z.string().uuid(),
        fileBase64: z.string().min(1),
        mimeType: z.enum(SUPPORTED_MIME_TYPES),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId
      await assertKnowledgeBaseAccess(ctx.supabase, orgId, input.kbId)

      const { count: chunkCount } = await ctx.supabase
        .from('kb_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
      await requireLimit(ctx.supabase, orgId, 'kbChunks', chunkCount ?? 0)

      const buffer = Buffer.from(input.fileBase64, 'base64')

      const result = await ingestFile({
        fileBuffer: buffer,
        mimeType: input.mimeType,
        filename: input.filename,
        kbId: input.kbId,
        orgId,
      })

      return result
    }),

  query: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid().optional(), // kept for backward compat
        query: z.string().min(1).max(1000),
        kbId: z.string().uuid().optional(),
        threshold: z.number().min(0).max(1).optional(),
        maxChunks: z.number().int().min(1).max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      if (input.kbId) {
        await assertKnowledgeBaseAccess(ctx.supabase, orgId, input.kbId)
      }

      const result = await queryRAG({
        query: input.query,
        orgId,
        kbId: input.kbId,
        threshold: input.threshold,
        maxChunks: input.maxChunks,
      })
      return result
    }),
})

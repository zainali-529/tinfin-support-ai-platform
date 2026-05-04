/**
 * INGEST ROUTER — Multi-Org Fixed
 *
 * Same fix: use ctx.userOrgId from middleware.
 * Also fixes assertKnowledgeBaseAccess to use ctx.userOrgId for the org scope check.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { ingestUrl, ingestFile, ingestText, queryRAG } from '@workspace/ai'
import { requireLimit } from '../lib/plan-guards'
import { requirePermissionFromContext } from '../lib/org-permissions'
import {
  assertKnowledgeBaseAccess,
  createIndexingSource,
  deleteChunksForSource,
  findUrlSource,
  normalizeSourceUrl,
  updateSourceAfterIngest,
} from '../services/knowledge-sources.service'

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export const ingestRouter = router({
  ingestUrl: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid().optional(), // kept for backward compat
        kbId: z.string().uuid(),
        url: z.string().url(),
        replaceExisting: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId // use middleware-resolved org
      await assertKnowledgeBaseAccess(ctx.supabase, orgId, input.kbId)
      const normalizedUrl = normalizeSourceUrl(input.url)

      const { count: chunkCount } = await ctx.supabase
        .from('kb_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
      await requireLimit(ctx.supabase, orgId, 'kbChunks', chunkCount ?? 0)

      const existing = await findUrlSource(ctx.supabase, {
        orgId,
        kbId: input.kbId,
        sourceUrl: normalizedUrl,
      })

      if (existing && !input.replaceExisting) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This URL is already indexed. Use Re-index from the source health list to recrawl it.',
        })
      }

      const source = await createIndexingSource(ctx.supabase, {
        orgId,
        kbId: input.kbId,
        sourceType: 'url',
        sourceUrl: normalizedUrl,
        sourceTitle: existing?.source_title ?? null,
        metadata: {
          addedBy: ctx.user.id,
          normalizedUrl,
        },
        existingSourceId: input.replaceExisting ? existing?.id : undefined,
      })

      if (existing && input.replaceExisting) {
        await deleteChunksForSource(ctx.supabase, existing)
      }

      const result = await ingestUrl({
        url: normalizedUrl,
        kbId: input.kbId,
        orgId,
        sourceId: source.id,
      })

      await updateSourceAfterIngest(ctx.supabase, source, {
        success: result.success,
        chunksStored: result.chunksStored,
        error: result.error,
        sourceTitle: result.sourceTitle,
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
      const source = await createIndexingSource(ctx.supabase, {
        orgId,
        kbId: input.kbId,
        sourceType: 'file',
        sourceTitle: input.filename ?? 'Uploaded document',
        metadata: {
          addedBy: ctx.user.id,
          mimeType: input.mimeType,
          originalFilename: input.filename ?? null,
        },
      })

      const result = await ingestFile({
        fileBuffer: buffer,
        mimeType: input.mimeType,
        filename: input.filename,
        kbId: input.kbId,
        orgId,
        sourceId: source.id,
      })

      await updateSourceAfterIngest(ctx.supabase, source, {
        success: result.success,
        chunksStored: result.chunksStored,
        error: result.error,
        sourceTitle: result.sourceTitle,
      })

      return result
    }),

  ingestText: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid().optional(), // kept for backward compat
        kbId: z.string().uuid(),
        content: z.string().min(1).max(200_000),
        title: z.string().max(200).optional(),
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

      const trimmedContent = input.content.trim()
      const source = await createIndexingSource(ctx.supabase, {
        orgId,
        kbId: input.kbId,
        sourceType: 'text_note',
        sourceTitle: input.title?.trim() || 'Text Note',
        metadata: {
          addedBy: ctx.user.id,
          rawText: trimmedContent,
          contentLength: trimmedContent.length,
        },
      })

      const result = await ingestText({
        content: trimmedContent,
        title: input.title,
        kbId: input.kbId,
        orgId,
        sourceId: source.id,
      })

      await updateSourceAfterIngest(ctx.supabase, source, {
        success: result.success,
        chunksStored: result.chunksStored,
        error: result.error,
        sourceTitle: result.sourceTitle,
        contentLength: trimmedContent.length,
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

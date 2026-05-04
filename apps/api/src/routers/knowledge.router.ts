import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { ingestText, ingestUrl } from '@workspace/ai'
import { router, protectedProcedure } from '../trpc/trpc'
import { requireLimit } from '../lib/plan-guards'
import { requirePermissionFromContext } from '../lib/org-permissions'
import {
  assertKnowledgeBaseAccess,
  createIndexingSource,
  decorateDuplicateWarnings,
  deleteChunksForSource,
  getKbSource,
  normalizeSourceRow,
  updateSourceAfterIngest,
  uiSourceType,
} from '../services/knowledge-sources.service'

const sourceTypeInput = z.enum(['url', 'file', 'text']).optional()

function asRawText(metadata: Record<string, unknown>): string | null {
  const value = metadata.rawText
  return typeof value === 'string' && value.trim() ? value : null
}

export const knowledgeRouter = router({
  getKnowledgeBases: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      const { data, error } = await ctx.supabase
        .from('knowledge_bases')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return data ?? []
    }),

  createKnowledgeBase: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid().optional(),
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

      const { data, error } = await ctx.supabase
        .from('knowledge_bases')
        .insert({ org_id: orgId, name: input.name, source_type: input.sourceType })
        .select()
        .single()

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return data
    }),

  deleteKnowledgeBase: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      const { error } = await ctx.supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', input.id)
        .eq('org_id', orgId)

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return { success: true }
    }),

  getKnowledgeSources: protectedProcedure
    .input(z.object({ kbId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      await assertKnowledgeBaseAccess(ctx.supabase, orgId, input.kbId)

      const { data, error } = await ctx.supabase
        .from('kb_sources')
        .select('*')
        .eq('org_id', orgId)
        .eq('kb_id', input.kbId)
        .order('updated_at', { ascending: false })

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      const rows = decorateDuplicateWarnings((data ?? []).map((row: Record<string, unknown>) => normalizeSourceRow(row)))

      return rows.map((row) => ({
        ...row,
        type: uiSourceType(row.source_type),
      }))
    }),

  deleteKnowledgeSource: protectedProcedure
    .input(
      z.object({
        sourceId: z.string().uuid().optional(),
        kbId: z.string().uuid().optional(),
        sourceUrl: z.string().nullable().optional(),
        sourceTitle: z.string().nullable().optional(),
        type: sourceTypeInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId

      if (input.sourceId) {
        const source = await getKbSource(ctx.supabase, orgId, input.sourceId)
        await deleteChunksForSource(ctx.supabase, source)

        const { error } = await ctx.supabase
          .from('kb_sources')
          .delete()
          .eq('id', source.id)
          .eq('org_id', orgId)

        if (error) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to delete source: ${error.message}` })
        }

        return { success: true }
      }

      if (!input.kbId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Knowledge base or source ID is required.' })
      }

      await assertKnowledgeBaseAccess(ctx.supabase, orgId, input.kbId)

      const sourceUrl = input.sourceUrl?.trim() || null
      const sourceTitle = input.sourceTitle?.trim() || null

      if (!sourceUrl && !sourceTitle) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Source URL or title is required.',
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

  reindexKnowledgeSource: protectedProcedure
    .input(z.object({ sourceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'knowledge', 'Knowledge Base access is required.')
      const orgId = ctx.userOrgId
      const source = await getKbSource(ctx.supabase, orgId, input.sourceId)

      if (source.source_type === 'file') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Uploaded files cannot be re-indexed automatically yet. Delete and upload the file again.',
        })
      }

      await createIndexingSource(ctx.supabase, {
        orgId,
        kbId: source.kb_id,
        sourceType: source.source_type,
        sourceUrl: source.source_url,
        sourceTitle: source.source_title,
        metadata: source.metadata,
        existingSourceId: source.id,
      })

      await deleteChunksForSource(ctx.supabase, source)

      if (source.source_type === 'url') {
        if (!source.source_url) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'URL source is missing its URL.' })
        }

        const result = await ingestUrl({
          url: source.source_url,
          kbId: source.kb_id,
          orgId,
          sourceId: source.id,
        })

        await updateSourceAfterIngest(ctx.supabase, source, {
          success: result.success,
          chunksStored: result.chunksStored,
          error: result.error,
          sourceTitle: result.sourceTitle,
        }, { recrawledBy: ctx.user.id })

        return result
      }

      const rawText = asRawText(source.metadata)
      if (!rawText) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This text source cannot be re-indexed because the original text was not stored. Delete and add it again.',
        })
      }

      const result = await ingestText({
        content: rawText,
        title: source.source_title ?? undefined,
        kbId: source.kb_id,
        orgId,
        sourceId: source.id,
      })

      await updateSourceAfterIngest(ctx.supabase, source, {
        success: result.success,
        chunksStored: result.chunksStored,
        error: result.error,
        sourceTitle: result.sourceTitle,
        contentLength: rawText.length,
      }, { reindexedBy: ctx.user.id })

      return result
    }),
})

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import { ingestUrl, ingestFile, queryRAG } from '@workspace/ai'

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

function requireOrgAccess(userOrgId: string, requestedOrgId: string) {
  if (requestedOrgId !== userOrgId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization access denied.' })
  }
  return userOrgId
}

async function assertKnowledgeBaseAccess(
  supabase: {
    from: (table: string) => {
      select: (query: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>
          }
        }
      }
    }
  },
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
  /**
   * Ingest a public URL into a knowledge base.
   * Crawls the page, chunks it, embeds, and stores.
   */
  ingestUrl: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        kbId: z.string().uuid(),
        url: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrgAccess(ctx.userOrgId, input.orgId)
      await assertKnowledgeBaseAccess(ctx.supabase as any, orgId, input.kbId)

      const result = await ingestUrl({
        url: input.url,
        kbId: input.kbId,
        orgId,
      })
      return result
    }),

  /**
   * Ingest a file (PDF or DOCX) provided as base64.
   */
  ingestFile: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        kbId: z.string().uuid(),
        fileBase64: z.string().min(1),
        mimeType: z.enum(SUPPORTED_MIME_TYPES),
        filename: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrgAccess(ctx.userOrgId, input.orgId)
      await assertKnowledgeBaseAccess(ctx.supabase as any, orgId, input.kbId)

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

  /**
   * Query the RAG pipeline directly (for testing / API access).
   */
  query: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        query: z.string().min(1).max(1000),
        kbId: z.string().uuid().optional(),
        threshold: z.number().min(0).max(1).optional(),
        maxChunks: z.number().int().min(1).max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrgAccess(ctx.userOrgId, input.orgId)
      if (input.kbId) {
        await assertKnowledgeBaseAccess(ctx.supabase as any, orgId, input.kbId)
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
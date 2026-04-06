import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'
import { ingestUrl, ingestFile, queryRAG } from '@workspace/ai'

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

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
    .mutation(async ({ input }) => {
      const result = await ingestUrl({
        url: input.url,
        kbId: input.kbId,
        orgId: input.orgId,
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
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, 'base64')

      const result = await ingestFile({
        fileBuffer: buffer,
        mimeType: input.mimeType,
        filename: input.filename,
        kbId: input.kbId,
        orgId: input.orgId,
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
    .mutation(async ({ input }) => {
      const result = await queryRAG({
        query: input.query,
        orgId: input.orgId,
        kbId: input.kbId,
        threshold: input.threshold,
        maxChunks: input.maxChunks,
      })
      return result
    }),
})
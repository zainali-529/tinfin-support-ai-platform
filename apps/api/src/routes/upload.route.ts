/**
 * apps/api/src/routes/upload.route.ts
 *
 * File upload endpoint for chat attachments.
 * Files are stored in Supabase Storage bucket: 'chat-attachments'
 *
 * Security:
 *   - File type whitelist (images, docs, pdfs)
 *   - 10 MB size limit
 *   - orgId + conversationId scoped paths
 *   - Visitor uploads: no auth needed (public chat widget)
 *   - Agent uploads: optional Authorization header for audit trail
 *
 * Flow:
 *   1. Client converts file to base64
 *   2. POST JSON body with { file, filename, mimeType, orgId, conversationId? }
 *   3. Server validates, uploads to Supabase Storage
 *   4. Returns { url, name, size, type }
 *
 * Register in index.ts BEFORE express.json() global middleware:
 *   app.use('/api/upload', express.json({ limit: '15mb' }), uploadRoute)
 */

import { Router, type Request, type Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import cors from 'cors'

export const uploadRoute: Router = Router()

// ── CORS: allow widget to upload from any origin ──────────────────────────────
const uploadCors = cors({ origin: '*', methods: ['POST', 'OPTIONS'], credentials: false })

// ── Constants ─────────────────────────────────────────────────────────────────
const BUCKET = 'chat-attachments'
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/zip': 'zip',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

type UploadBody = {
  file: string         // base64-encoded file data
  filename: string     // original filename
  mimeType: string     // MIME type
  orgId: string        // organization scope
  conversationId?: string
}

type UploadResponse = {
  url: string
  name: string
  size: number
  type: string
  path: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._\-\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 128)
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

// ── Route ─────────────────────────────────────────────────────────────────────

uploadRoute.options('/', uploadCors, (_req, res) => {
  res.sendStatus(204)
})

uploadRoute.post('/', uploadCors, async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<UploadBody>
    const { file, filename, mimeType, orgId, conversationId } = body

    // ── Validation ────────────────────────────────────────────────────────────
    if (!file || !filename || !mimeType || !orgId) {
      return res.status(400).json({ error: 'Missing required fields: file, filename, mimeType, orgId' })
    }

    if (!/^[0-9a-f-]{36}$/i.test(orgId)) {
      return res.status(400).json({ error: 'Invalid orgId format' })
    }

    const ext = ALLOWED_MIME_TYPES[mimeType]
    if (!ext) {
      return res.status(400).json({
        error: `File type "${mimeType}" is not allowed`,
        allowed: Object.keys(ALLOWED_MIME_TYPES),
      })
    }

    // ── Decode base64 ─────────────────────────────────────────────────────────
    let buffer: Buffer
    try {
      // Strip data URI prefix if present: "data:image/png;base64,..."
      const base64Data = file.includes(',') ? file.split(',')[1] : file
      if (!base64Data) throw new Error('Empty base64 data')
      buffer = Buffer.from(base64Data, 'base64')
    } catch {
      return res.status(400).json({ error: 'Invalid base64 file data' })
    }

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'File is empty' })
    }

    if (buffer.length > MAX_SIZE_BYTES) {
      const mb = (buffer.length / 1024 / 1024).toFixed(1)
      return res.status(400).json({ error: `File too large: ${mb}MB (max 10MB)` })
    }

    // ── Build storage path ────────────────────────────────────────────────────
    const safeFilename = sanitizeFilename(filename)
    const uniqueId = crypto.randomUUID()
    const scope = conversationId && /^[0-9a-f-]{36}$/i.test(conversationId)
      ? `${orgId}/${conversationId}`
      : `${orgId}/general`
    const storagePath = `${scope}/${uniqueId}_${safeFilename}`

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    const supabase = getSupabase()

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        cacheControl: '31536000', // 1 year cache for immutable files
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload] Supabase storage error:', uploadError.message)
      return res.status(500).json({ error: 'Upload failed. Please try again.' })
    }

    // ── Get public URL ────────────────────────────────────────────────────────
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath)

    const response: UploadResponse = {
      url: publicUrl,
      name: safeFilename,
      size: buffer.length,
      type: mimeType,
      path: storagePath,
    }

    console.log(
      `[upload] ✓ ${safeFilename} (${(buffer.length / 1024).toFixed(1)}KB) → ${storagePath}`
    )

    return res.status(201).json(response)
  } catch (err) {
    console.error('[upload] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
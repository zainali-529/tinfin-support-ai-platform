import {
  DOMMatrix,
  DOMPoint,
  DOMRect,
  ImageData,
  Path2D,
} from '@napi-rs/canvas'
import mammoth from 'mammoth'

const globalAny = globalThis as typeof globalThis & {
  DOMMatrix?: typeof DOMMatrix
  DOMPoint?: typeof DOMPoint
  DOMRect?: typeof DOMRect
  ImageData?: typeof ImageData
  Path2D?: typeof Path2D
}

// pdfjs-dist (used by pdf-parse) expects DOM classes to exist in Node.
if (!globalAny.DOMMatrix) {
  globalAny.DOMMatrix = DOMMatrix
}
if (!globalAny.DOMPoint) {
  globalAny.DOMPoint = DOMPoint
}
if (!globalAny.DOMRect) {
  globalAny.DOMRect = DOMRect
}
if (ImageData && !globalAny.ImageData) {
  globalAny.ImageData = ImageData
}
if (Path2D && !globalAny.Path2D) {
  globalAny.Path2D = Path2D
}

const pdfParse = require('pdf-parse')

export interface ParseResult {
  content: string
  title?: string
}

export type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Parse a PDF buffer and return clean text.
 */
export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer)

  const content = cleanText(data.text)

  const title: string | undefined =
    typeof data.info?.Title === 'string' && data.info.Title.trim()
      ? (data.info.Title as string).trim()
      : undefined

  if (!content) {
    throw new Error('PDF appears to be empty or contains only images (no extractable text).')
  }

  return { content, title }
}

/**
 * Parse a DOCX buffer and return clean text.
 */
export async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer })

  const content = cleanText(result.value)

  if (!content) {
    throw new Error('DOCX appears to be empty.')
  }

  return { content }
}

/**
 * Auto-detect file type from MIME type and parse accordingly.
 */
export async function parseFile(
  buffer: Buffer,
  mimeType: string
): Promise<ParseResult> {
  const normalized = mimeType.toLowerCase().trim()

  if (normalized === 'application/pdf' || normalized === 'pdf') {
    return parsePdf(buffer)
  }

  if (
    normalized ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalized === 'docx'
  ) {
    return parseDocx(buffer)
  }

  throw new Error(
    `Unsupported file type: "${mimeType}". Supported: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  )
}

/**
 * Parse a base64-encoded file.
 */
export async function parseBase64File(
  base64: string,
  mimeType: string
): Promise<ParseResult> {
  const buffer = Buffer.from(base64, 'base64')
  return parseFile(buffer, mimeType)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
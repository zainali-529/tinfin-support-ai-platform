/**
 * apps/api/src/services/email.service.ts  (UPDATED)
 *
 * FIX: Added `replyTo` parameter to SendEmailParams and sendEmailViaResend.
 * This is critical for:
 *  - Spam prevention: emails with matching Reply-To are less likely to be flagged
 *  - Thread continuity: customer replies land back in our inbound system
 *  - Deliverability: proper Reply-To signals a legitimate transactional email
 */

import crypto from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailParams {
  resendApiKey: string
  from: string
  fromName: string
  /** Reply-To address (set to inbound_address for proper threading + spam prevention) */
  replyTo?: string | null
  to: string[]
  cc?: string[]
  subject: string
  htmlBody?: string | null
  textBody?: string | null
  inReplyTo?: string | null
  references?: string | null
  signature?: string | null
}

export interface SendEmailResult {
  messageId: string
  resendId: string
}

export interface ParsedInboundEmail {
  fromEmail: string
  fromName: string | null
  toEmails: string[]
  ccEmails: string[]
  subject: string
  htmlBody: string | null
  textBody: string | null
  externalMessageId: string | null
  inReplyTo: string | null
  references: string | null
  rawHeaders: Record<string, string>
}

export interface MailgunSignatureParams {
  timestamp: string
  token: string
  signature: string
  signingKey: string
}

interface ResendResponse {
  id: string
}

// ─── Resend Email Sending ─────────────────────────────────────────────────────

const RESEND_API_URL = 'https://api.resend.com/emails'

export async function sendEmailViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  const {
    resendApiKey,
    from,
    fromName,
    replyTo,
    to,
    cc,
    subject,
    htmlBody,
    textBody,
    inReplyTo,
    references,
    signature,
  } = params

  const messageId = `<${crypto.randomUUID()}@mail.tinfin.com>`

  const finalHtml = buildHtmlWithSignature(htmlBody, signature)
  const finalText = buildTextWithSignature(textBody, signature)

  const threadingHeaders: Record<string, string> = { 'Message-ID': messageId }
  if (inReplyTo) threadingHeaders['In-Reply-To'] = inReplyTo
  if (references) threadingHeaders['References'] = references

  const payload: Record<string, unknown> = {
    from: `${fromName} <${from}>`,
    to,
    subject,
    headers: threadingHeaders,
  }

  // FIX: Add Reply-To so customer replies come back to our inbound address
  if (replyTo) payload.reply_to = replyTo

  if (cc && cc.length > 0) payload.cc = cc
  if (finalHtml) payload.html = finalHtml
  if (finalText) payload.text = finalText

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Resend API error (${res.status}): ${errBody}`)
  }

  const data = (await res.json()) as ResendResponse
  return { messageId, resendId: data.id }
}

// ─── Postmark Inbound Parser ──────────────────────────────────────────────────

interface PostmarkInboundHeader {
  Name: string
  Value: string
}

interface PostmarkInboundPayload {
  From?: string
  FromName?: string
  To?: string
  Cc?: string
  Subject?: string
  MessageID?: string
  TextBody?: string
  HtmlBody?: string
  Headers?: PostmarkInboundHeader[]
  Date?: string
}

export function parsePostmarkInbound(body: unknown): ParsedInboundEmail {
  const payload = body as PostmarkInboundPayload

  const headerMap: Record<string, string> = {}
  let inReplyTo: string | null = null
  let references: string | null = null

  for (const h of payload.Headers ?? []) {
    const key = h.Name.toLowerCase()
    headerMap[key] = h.Value
    if (key === 'in-reply-to') inReplyTo = h.Value.trim()
    if (key === 'references') references = h.Value.trim()
  }

  const rawMsgId = payload.MessageID ?? null
  const externalMessageId = rawMsgId
    ? rawMsgId.startsWith('<') ? rawMsgId : `<${rawMsgId}>`
    : null

  return {
    fromEmail: extractEmail(payload.From ?? '') ?? (payload.From ?? ''),
    fromName: payload.FromName?.trim() || extractDisplayName(payload.From ?? ''),
    toEmails: splitAddressList(payload.To ?? ''),
    ccEmails: splitAddressList(payload.Cc ?? ''),
    subject: payload.Subject?.trim() || '(no subject)',
    htmlBody: payload.HtmlBody ?? null,
    textBody: payload.TextBody ?? null,
    externalMessageId,
    inReplyTo,
    references,
    rawHeaders: headerMap,
  }
}

// ─── Mailgun Inbound Parser ───────────────────────────────────────────────────

export function parseMailgunInbound(body: Record<string, string>): ParsedInboundEmail {
  const fromRaw = body['From'] ?? body['from'] ?? body['sender'] ?? ''

  const rawMsgId = body['Message-Id'] ?? body['message-id'] ?? body['Message-ID'] ?? null
  const externalMessageId = rawMsgId
    ? rawMsgId.startsWith('<') ? rawMsgId.trim() : `<${rawMsgId.trim()}>`
    : null

  const inReplyToRaw = body['In-Reply-To'] ?? body['in-reply-to'] ?? null
  const referencesRaw = body['References'] ?? body['references'] ?? null

  const headerMap: Record<string, string> = {}
  for (const [k, v] of Object.entries(body)) {
    headerMap[k.toLowerCase()] = v
  }

  return {
    fromEmail: extractEmail(fromRaw) ?? fromRaw,
    fromName: extractDisplayName(fromRaw),
    toEmails: splitAddressList(body['To'] ?? body['to'] ?? ''),
    ccEmails: splitAddressList(body['Cc'] ?? body['cc'] ?? ''),
    subject: (body['Subject'] ?? body['subject'] ?? '').trim() || '(no subject)',
    htmlBody: body['body-html'] ?? null,
    textBody: body['body-plain'] ?? null,
    externalMessageId,
    inReplyTo: inReplyToRaw?.trim() ?? null,
    references: referencesRaw?.trim() ?? null,
    rawHeaders: headerMap,
  }
}

// ─── Mailgun Signature Verification ──────────────────────────────────────────

export function verifyMailgunSignature(params: MailgunSignatureParams): boolean {
  try {
    const { timestamp, token, signature, signingKey } = params
    const value = `${timestamp}${token}`
    const expected = crypto.createHmac('sha256', signingKey).update(value).digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const sigBuf = Buffer.from(signature, 'hex')
    if (expectedBuf.length !== sigBuf.length) return false
    return crypto.timingSafeEqual(expectedBuf, sigBuf)
  } catch {
    return false
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function generateWebhookToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 3)}****${key.slice(-4)}`
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function buildReplySubject(subject: string): string {
  const trimmed = subject.trim()
  return trimmed.toLowerCase().startsWith('re:') ? trimmed : `Re: ${trimmed}`
}

export function buildReferences(
  existingReferences: string | null,
  inReplyTo: string | null
): string | null {
  const parts: string[] = []
  if (existingReferences) parts.push(existingReferences.trim())
  if (inReplyTo && !parts.join(' ').includes(inReplyTo)) {
    parts.push(inReplyTo.trim())
  }
  return parts.length > 0 ? parts.join(' ') : null
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function extractEmail(raw: string): string | null {
  if (!raw) return null
  const angleMatch = raw.match(/<([^>]+@[^>]+)>/)
  if (angleMatch?.[1]) return angleMatch[1].trim().toLowerCase()
  const plainMatch = raw.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/)
  return plainMatch?.[0]?.toLowerCase() ?? null
}

function extractDisplayName(raw: string): string | null {
  if (!raw) return null
  const angleIndex = raw.indexOf('<')
  if (angleIndex > 0) {
    const name = raw.slice(0, angleIndex).trim().replace(/^"|"$/g, '')
    return name || null
  }
  return null
}

function splitAddressList(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((part) => extractEmail(part.trim()) ?? part.trim())
    .filter((e) => e.includes('@'))
}

function buildHtmlWithSignature(
  html: string | null | undefined,
  signature: string | null | undefined
): string | null {
  if (!html && !signature) return null
  if (!signature) return html ?? null
  const sigHtml = signature.replace(/\n/g, '<br>')
  if (html) return `${html}<br><br>--<br>${sigHtml}`
  return `<p></p><br><br>--<br>${sigHtml}`
}

function buildTextWithSignature(
  text: string | null | undefined,
  signature: string | null | undefined
): string | null {
  if (!text && !signature) return null
  if (!signature) return text ?? null
  if (text) return `${text}\n\n--\n${signature}`
  return `\n\n--\n${signature}`
}
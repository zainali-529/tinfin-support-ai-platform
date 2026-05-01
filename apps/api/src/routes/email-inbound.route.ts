/**
 * apps/api/src/routes/email-inbound.route.ts  (UPDATED)
 *
 * FIXES vs previous version:
 *  1. AI auto-reply: removed overly strict type check — now replies whenever
 *     queryRAG returns a message and type is NOT handoff/ask_handoff
 *  2. Added Reply-To header in outbound emails (fixes spam/threading)
 *  3. Added explicit error logging for AI auto-reply debug
 *  4. Added `replyTo` param threading through to sendEmailViaResend
 */

import { Router, type Request, type Response } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  parsePostmarkInbound,
  parseMailgunInbound,
  verifyMailgunSignature,
  sendEmailViaResend,
  buildReplySubject,
  buildReferences,
  stripHtml,
  type ParsedInboundEmail,
} from '../services/email.service'
import { queryRAG } from '@workspace/ai'
import { planAllows } from '../lib/plans'
import { getOrgPlanId } from '../lib/subscriptions'
import { routePendingConversation } from '../services/inbox-ops.service'

export const emailInboundRoute: Router = Router()

// ─── Supabase admin client ────────────────────────────────────────────────────

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Row types ────────────────────────────────────────────────────────────────

interface EmailAccountRow {
  id: string
  org_id: string
  resend_api_key: string | null
  from_email: string
  from_name: string
  inbound_address: string | null
  is_active: boolean
  ai_auto_reply: boolean
  email_signature: string | null
}

interface ThreadMatch {
  conversation_id: string
}

interface ContactRow {
  id: string
  name: string | null
}

interface NewRow {
  id: string
}

// ─── Token Lookup ─────────────────────────────────────────────────────────────

async function findAccountByToken(
  supabase: SupabaseClient,
  token: string
): Promise<EmailAccountRow | null> {
  const { data } = await supabase
    .from('email_accounts')
    .select('id, org_id, resend_api_key, from_email, from_name, inbound_address, is_active, ai_auto_reply, email_signature')
    .eq('inbound_webhook_token', token)
    .maybeSingle()

  return (data as EmailAccountRow | null)
}

async function isEmailChannelAllowed(
  supabase: SupabaseClient,
  orgId: string
): Promise<boolean> {
  const planId = await getOrgPlanId(supabase, orgId)
  return planAllows(planId, 'emailChannel')
}

// ─── Duplicate Check ──────────────────────────────────────────────────────────

async function isDuplicateEmail(
  supabase: SupabaseClient,
  orgId: string,
  externalMessageId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('email_messages')
    .select('id')
    .eq('org_id', orgId)
    .eq('external_message_id', externalMessageId)
    .maybeSingle()

  return !!data
}

// ─── Conversation Resolution ──────────────────────────────────────────────────

async function resolveConversation(
  supabase: SupabaseClient,
  orgId: string,
  parsed: ParsedInboundEmail
): Promise<{ conversationId: string; isNew: boolean }> {
  // 1. Match by In-Reply-To
  if (parsed.inReplyTo) {
    const { data } = await supabase
      .from('email_messages')
      .select('conversation_id')
      .eq('org_id', orgId)
      .eq('external_message_id', parsed.inReplyTo)
      .maybeSingle()

    const match = data as ThreadMatch | null
    if (match?.conversation_id) {
      return { conversationId: match.conversation_id, isNew: false }
    }
  }

  // 2. Match by References (check each message ID)
  if (parsed.references) {
    const refIds = parsed.references.split(/\s+/).filter(Boolean)

    for (const refId of refIds) {
      const { data } = await supabase
        .from('email_messages')
        .select('conversation_id')
        .eq('org_id', orgId)
        .eq('external_message_id', refId)
        .maybeSingle()

      const match = data as ThreadMatch | null
      if (match?.conversation_id) {
        return { conversationId: match.conversation_id, isNew: false }
      }
    }
  }

  // 3. Create new conversation
  const contactId = await upsertContact(supabase, orgId, parsed)

  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      org_id: orgId,
      contact_id: contactId,
      status: 'pending',
      channel: 'email',
    })
    .select('id')
    .single()

  if (error || !newConv) {
    throw new Error(`Failed to create email conversation: ${error?.message ?? 'unknown'}`)
  }
  const createdConversationId = (newConv as NewRow).id

  try {
    await routePendingConversation({
      supabase,
      orgId,
      conversationId: createdConversationId,
      reason: 'email_inbound',
    })
  } catch (routingError) {
    console.error(
      '[email-inbound] Routing assignment failed:',
      routingError instanceof Error ? routingError.message : routingError
    )
  }

  return { conversationId: createdConversationId, isNew: true }
}

// ─── Contact Upsert ───────────────────────────────────────────────────────────

async function upsertContact(
  supabase: SupabaseClient,
  orgId: string,
  parsed: ParsedInboundEmail
): Promise<string> {
  const email = parsed.fromEmail.toLowerCase().trim()

  const { data: existing } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('email', email)
    .maybeSingle()

  const existingContact = existing as ContactRow | null

  if (existingContact) {
    if (!existingContact.name && parsed.fromName) {
      await supabase
        .from('contacts')
        .update({ name: parsed.fromName })
        .eq('id', existingContact.id)
    }
    return existingContact.id
  }

  const { data: created, error } = await supabase
    .from('contacts')
    .insert({
      org_id: orgId,
      email,
      name: parsed.fromName ?? null,
      meta: { source: 'email' },
    })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error(`Failed to create contact: ${error?.message ?? 'unknown'}`)
  }

  return (created as NewRow).id
}

// ─── Store Inbound Email ──────────────────────────────────────────────────────

async function storeInboundEmail(
  supabase: SupabaseClient,
  orgId: string,
  conversationId: string,
  parsed: ParsedInboundEmail
): Promise<string | null> {
  const textContent =
    parsed.textBody ||
    (parsed.htmlBody ? stripHtml(parsed.htmlBody) : '') ||
    '(email with no text body)'

  const { data: msgData, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      org_id: orgId,
      role: 'user',
      content: textContent,
      attachments: [],
      ai_metadata: { channel: 'email' },
    })
    .select('id')
    .single()

  if (msgError) {
    console.error('[email-inbound] messages insert error:', msgError.message)
    throw new Error(`Failed to insert message: ${msgError.message}`)
  }

  const messageId = (msgData as NewRow | null)?.id ?? null

  const { error: emailMsgError } = await supabase.from('email_messages').insert({
    org_id: orgId,
    conversation_id: conversationId,
    message_id: messageId,
    external_message_id: parsed.externalMessageId,
    in_reply_to: parsed.inReplyTo,
    references_header: parsed.references,
    subject: parsed.subject,
    from_email: parsed.fromEmail,
    from_name: parsed.fromName,
    to_emails: parsed.toEmails.length > 0 ? parsed.toEmails : [],
    cc_emails: parsed.ccEmails.length > 0 ? parsed.ccEmails : [],
    html_body: parsed.htmlBody,
    text_body: parsed.textBody,
    direction: 'inbound',
    status: 'received',
    raw_headers: parsed.rawHeaders,
  })

  if (emailMsgError) {
    console.error('[email-inbound] email_messages insert error:', emailMsgError.message)
    throw new Error(`Failed to insert email_message: ${emailMsgError.message}`)
  }

  return messageId
}

// ─── AI Auto-Reply ────────────────────────────────────────────────────────────

async function triggerAIAutoReply(
  supabase: SupabaseClient,
  orgId: string,
  conversationId: string,
  account: EmailAccountRow,
  parsed: ParsedInboundEmail
): Promise<void> {
  if (!account.ai_auto_reply || !account.resend_api_key) return

  try {
    const userText = parsed.textBody || (parsed.htmlBody ? stripHtml(parsed.htmlBody) : '')
    if (!userText.trim()) {
      console.log('[email-inbound/ai] No text content, skipping auto-reply')
      return
    }

    console.log(`[email-inbound/ai] Querying RAG for org=${orgId}`)
    const ragResult = await queryRAG({ query: userText, orgId })

    console.log(`[email-inbound/ai] RAG result type=${ragResult.type} hasMessage=${!!ragResult.message}`)

    // FIX: Only skip handoff/ask_handoff - attempt reply for all other types
    // Previously was: type !== 'answer' && type !== 'casual' which was too strict
    if (ragResult.type === 'handoff' || ragResult.type === 'ask_handoff') {
      console.log('[email-inbound/ai] Handoff type — leaving for human agent')
      return
    }

    // Safety: ensure we actually have a message to send
    if (!ragResult.message?.trim()) {
      console.log('[email-inbound/ai] No message in RAG result, skipping')
      return
    }

    const replySubject = buildReplySubject(parsed.subject)
    const references = buildReferences(parsed.references, parsed.externalMessageId)

    // FIX: Add Reply-To header pointing to inbound address so customer replies
    // come back to us, not to a no-reply address
    const replyTo = account.inbound_address || account.from_email

    const sendResult = await sendEmailViaResend({
      resendApiKey: account.resend_api_key,
      from: account.from_email,
      fromName: account.from_name,
      replyTo,
      to: [parsed.fromEmail],
      subject: replySubject,
      textBody: ragResult.message,
      inReplyTo: parsed.externalMessageId,
      references,
      signature: account.email_signature,
    })

    const { data: msgData } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        org_id: orgId,
        role: 'assistant',
        content: ragResult.message,
        attachments: [],
        ai_metadata: {
          channel: 'email',
          source: 'auto_reply',
          type: ragResult.type,
          resendId: sendResult.resendId,
        },
      })
      .select('id')
      .single()

    const messageId = (msgData as NewRow | null)?.id ?? null

    await supabase.from('email_messages').insert({
      org_id: orgId,
      conversation_id: conversationId,
      message_id: messageId,
      external_message_id: sendResult.messageId,
      in_reply_to: parsed.externalMessageId,
      references_header: references,
      subject: replySubject,
      from_email: account.from_email,
      from_name: account.from_name,
      to_emails: [parsed.fromEmail],
      cc_emails: [],
      text_body: ragResult.message,
      html_body: null,
      direction: 'outbound',
      status: 'sent',
      raw_headers: { 'resend-id': sendResult.resendId },
    })

    console.log(`[email-inbound/ai] Auto-reply sent for conv=${conversationId}`)
  } catch (err) {
    console.error('[email-inbound/ai] Auto-reply failed:', err instanceof Error ? err.message : err)
  }
}

// ─── Core processing ──────────────────────────────────────────────────────────

async function processInboundEmail(
  supabase: SupabaseClient,
  token: string,
  parsed: ParsedInboundEmail,
  provider: string
): Promise<void> {
  const account = await findAccountByToken(supabase, token)

  if (!account) {
    console.warn(`[email-inbound/${provider}] No account for token prefix: ${token.slice(0, 8)}`)
    return
  }

  if (!account.is_active) {
    console.warn(`[email-inbound/${provider}] Account inactive for org: ${account.org_id}`)
    return
  }

  const emailFeatureAllowed = await isEmailChannelAllowed(supabase, account.org_id)
  if (!emailFeatureAllowed) {
    console.warn(`[email-inbound/${provider}] Email feature locked for org: ${account.org_id}`)
    return
  }

  // Deduplicate
  if (parsed.externalMessageId) {
    const dup = await isDuplicateEmail(supabase, account.org_id, parsed.externalMessageId)
    if (dup) {
      console.log(`[email-inbound/${provider}] Duplicate, skipping: ${parsed.externalMessageId}`)
      return
    }
  }

  const { conversationId, isNew } = await resolveConversation(supabase, account.org_id, parsed)
  await storeInboundEmail(supabase, account.org_id, conversationId, parsed)

  console.log(`[email-inbound/${provider}] org=${account.org_id} conv=${conversationId} isNew=${isNew} from=${parsed.fromEmail}`)

  void triggerAIAutoReply(supabase, account.org_id, conversationId, account, parsed)
}

// ─── Postmark Route ───────────────────────────────────────────────────────────

emailInboundRoute.post('/:token/postmark', async (req: Request, res: Response) => {
  const { token } = req.params as { token: string }
  if (!token) {
    res.status(400).json({ error: 'Missing token' })
    return
  }

  const supabase = getSupabase()
  try {
    const parsed = parsePostmarkInbound(req.body as unknown)
    await processInboundEmail(supabase, token, parsed, 'postmark')
    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[email-inbound/postmark]', err instanceof Error ? err.message : err)
    // Return 500 so Postmark knows delivery failed and can retry later
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

// ─── Mailgun Route ────────────────────────────────────────────────────────────

emailInboundRoute.post('/:token/mailgun', async (req: Request, res: Response) => {
  const { token } = req.params as { token: string }
  if (!token) {
    res.status(400).json({ error: 'Missing token' })
    return
  }

  const supabase = getSupabase()
  try {
    const body = req.body as Record<string, string>

    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY
    if (signingKey) {
      const valid = verifyMailgunSignature({
        timestamp: body['timestamp'] ?? '',
        token: body['token'] ?? '',
        signature: body['signature'] ?? '',
        signingKey,
      })
      if (!valid) {
        console.warn('[email-inbound/mailgun] Invalid HMAC signature')
        res.status(401).json({ error: 'Invalid signature' })
        return
      }
    }

    const parsed = parseMailgunInbound(body)
    await processInboundEmail(supabase, token, parsed, 'mailgun')
    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[email-inbound/mailgun]', err instanceof Error ? err.message : err)
    // Return 500 so Mailgun knows delivery failed and can retry later
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

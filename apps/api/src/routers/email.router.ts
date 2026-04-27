/**
 * apps/api/src/routers/email.router.ts  (UPDATED)
 * FIX: Added replyTo param to sendReply → sendEmailViaResend for spam prevention
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'
import {
  sendEmailViaResend,
  generateWebhookToken,
  maskApiKey,
  buildReplySubject,
  buildReferences,
} from '../services/email.service'
import { requireFeature } from '../lib/plan-guards'
import { requirePermissionFromContext } from '../lib/org-permissions'

interface EmailAccountRow {
  id: string
  org_id: string
  resend_api_key: string | null
  from_email: string
  from_name: string
  inbound_address: string | null
  inbound_provider: string
  inbound_webhook_token: string | null
  is_active: boolean
  ai_auto_reply: boolean
  email_signature: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface EmailMessageRow {
  id: string
  org_id: string
  conversation_id: string
  message_id: string | null
  external_message_id: string | null
  in_reply_to: string | null
  references_header: string | null
  subject: string
  from_email: string
  from_name: string | null
  to_emails: string[]
  cc_emails: string[]
  html_body: string | null
  text_body: string | null
  direction: string
  status: string
  error_message: string | null
  raw_headers: Record<string, unknown>
  created_at: string
}

export const emailRouter = router({

  getAccount: protectedProcedure.query(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'channels', 'Channels access is required.')
    const orgId = ctx.userOrgId

    const { data } = await ctx.supabase
      .from('email_accounts')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    if (!data) return null

    const row = data as EmailAccountRow
    return {
      id: row.id,
      orgId: row.org_id,
      fromEmail: row.from_email,
      fromName: row.from_name,
      inboundAddress: row.inbound_address,
      inboundProvider: row.inbound_provider,
      inboundWebhookToken: row.inbound_webhook_token,
      isActive: row.is_active,
      aiAutoReply: row.ai_auto_reply,
      emailSignature: row.email_signature,
      settings: row.settings ?? {},
      hasResendKey: !!row.resend_api_key,
      resendApiKeyMasked: row.resend_api_key ? maskApiKey(row.resend_api_key) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId

      const { data, error } = await ctx.supabase
        .from('email_messages')
        .select('*')
        .eq('conversation_id', input.conversationId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch email messages: ${error.message}` })
      }

      return (data ?? []).map((row: unknown) => {
        const r = row as EmailMessageRow
        return {
          id: r.id,
          conversationId: r.conversation_id,
          messageId: r.message_id,
          externalMessageId: r.external_message_id,
          inReplyTo: r.in_reply_to,
          referencesHeader: r.references_header,
          subject: r.subject,
          fromEmail: r.from_email,
          fromName: r.from_name,
          toEmails: r.to_emails ?? [],
          ccEmails: r.cc_emails ?? [],
          htmlBody: r.html_body,
          textBody: r.text_body,
          direction: r.direction as 'inbound' | 'outbound',
          status: r.status,
          errorMessage: r.error_message,
          createdAt: r.created_at,
        }
      })
    }),

  upsertAccount: protectedProcedure
    .input(z.object({
      resendApiKey: z.string().min(10).optional(),
      fromEmail: z.string().email().optional(),
      fromName: z.string().min(1).max(80).optional(),
      inboundAddress: z.string().nullable().optional(),
      inboundProvider: z.enum(['postmark', 'mailgun']).optional(),
      isActive: z.boolean().optional(),
      aiAutoReply: z.boolean().optional(),
      emailSignature: z.string().max(1000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'channels', 'Channels access is required.')
      await requireFeature(ctx.supabase, ctx.userOrgId, 'emailChannel')

      const orgId = ctx.userOrgId
      const now = new Date().toISOString()

      const { data: existing } = await ctx.supabase
        .from('email_accounts')
        .select('id, inbound_webhook_token')
        .eq('org_id', orgId)
        .maybeSingle()

      const existingRow = existing as { id: string; inbound_webhook_token: string | null } | null

      const payload: Record<string, unknown> = { org_id: orgId, updated_at: now }

      if (input.resendApiKey !== undefined) payload.resend_api_key = input.resendApiKey
      if (input.fromEmail !== undefined) payload.from_email = input.fromEmail
      if (input.fromName !== undefined) payload.from_name = input.fromName
      if (input.inboundAddress !== undefined) payload.inbound_address = input.inboundAddress
      if (input.inboundProvider !== undefined) payload.inbound_provider = input.inboundProvider
      if (input.isActive !== undefined) payload.is_active = input.isActive
      if (input.aiAutoReply !== undefined) payload.ai_auto_reply = input.aiAutoReply
      if (input.emailSignature !== undefined) payload.email_signature = input.emailSignature

      if (!existingRow) {
        payload.inbound_webhook_token = generateWebhookToken()
      }

      const { error } = await ctx.supabase
        .from('email_accounts')
        .upsert(payload, { onConflict: 'org_id' })

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to save email settings: ${error.message}` })
      }

      return { success: true }
    }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'channels', 'Channels access is required.')

    const { error } = await ctx.supabase
      .from('email_accounts')
      .delete()
      .eq('org_id', ctx.userOrgId)

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return { success: true }
  }),

  regenerateWebhookToken: protectedProcedure.mutation(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'channels', 'Channels access is required.')
    await requireFeature(ctx.supabase, ctx.userOrgId, 'emailChannel')

    const newToken = generateWebhookToken()
    const { error } = await ctx.supabase
      .from('email_accounts')
      .update({ inbound_webhook_token: newToken, updated_at: new Date().toISOString() })
      .eq('org_id', ctx.userOrgId)

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return { token: newToken }
  }),

  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    requirePermissionFromContext(ctx, 'channels', 'Channels access is required.')
    await requireFeature(ctx.supabase, ctx.userOrgId, 'emailChannel')

    const { data } = await ctx.supabase
      .from('email_accounts')
      .select('resend_api_key')
      .eq('org_id', ctx.userOrgId)
      .maybeSingle()

    const row = data as { resend_api_key: string | null } | null
    if (!row?.resend_api_key) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No Resend API key configured.' })
    }

    let res: Response
    try {
      res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${row.resend_api_key}` },
        signal: AbortSignal.timeout(10_000),
      })
    } catch (err) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Cannot reach Resend: ${err instanceof Error ? err.message : 'network error'}` })
    }

    if (res.status === 401) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid Resend API key.' })
    if (!res.ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Resend returned status ${res.status}` })

    return { connected: true }
  }),

  sendReply: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      content: z.string().min(1),
      contentHtml: z.string().optional(),
      subject: z.string().min(1).max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'inbox', 'Inbox access is required.')
      const orgId = ctx.userOrgId
      await requireFeature(ctx.supabase, orgId, 'emailChannel')

      const { data: convData } = await ctx.supabase
        .from('conversations')
        .select('id, status, channel, contact_id')
        .eq('id', input.conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      const conv = convData as { id: string; status: string; channel: string; contact_id: string | null } | null

      if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' })
      if (conv.channel !== 'email') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not an email conversation.' })
      if (conv.status === 'resolved' || conv.status === 'closed') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot reply to a resolved conversation.' })

      const { data: accData } = await ctx.supabase
        .from('email_accounts')
        .select('resend_api_key, from_email, from_name, inbound_address, email_signature, is_active')
        .eq('org_id', orgId)
        .maybeSingle()

      const account = accData as {
        resend_api_key: string | null
        from_email: string
        from_name: string
        inbound_address: string | null
        email_signature: string | null
        is_active: boolean
      } | null

      if (!account) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email channel not configured.' })
      if (!account.is_active) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email channel is disabled.' })
      if (!account.resend_api_key) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No Resend API key configured.' })

      const { data: lastInboundData } = await ctx.supabase
        .from('email_messages')
        .select('external_message_id, references_header, from_email, subject')
        .eq('conversation_id', input.conversationId)
        .eq('org_id', orgId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastInbound = lastInboundData as { external_message_id: string | null; references_header: string | null; from_email: string; subject: string } | null

      let toEmail: string | null = null
      if (conv.contact_id) {
        const { data: contactData } = await ctx.supabase
          .from('contacts')
          .select('email')
          .eq('id', conv.contact_id)
          .eq('org_id', orgId)
          .maybeSingle()
        toEmail = (contactData as { email: string | null } | null)?.email ?? null
      }
      if (!toEmail && lastInbound?.from_email) toEmail = lastInbound.from_email
      if (!toEmail) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot determine recipient email.' })

      const inReplyTo = lastInbound?.external_message_id ?? null
      const references = buildReferences(lastInbound?.references_header ?? null, inReplyTo)
      const rawSubject = input.subject ?? lastInbound?.subject ?? 'Support'
      const emailSubject = buildReplySubject(rawSubject)

      // FIX: reply_to points to the inbound address so customer replies come back to us
      const replyTo = account.inbound_address || account.from_email

      let sendResult: { messageId: string; resendId: string }
      try {
        sendResult = await sendEmailViaResend({
          resendApiKey: account.resend_api_key,
          from: account.from_email,
          fromName: account.from_name,
          replyTo,
          to: [toEmail],
          subject: emailSubject,
          textBody: input.content,
          htmlBody: input.contentHtml ?? null,
          inReplyTo,
          references,
          signature: account.email_signature,
        })
      } catch (err) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to send email: ${err instanceof Error ? err.message : 'Unknown error'}` })
      }

      const { data: msgData, error: msgError } = await ctx.supabase
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          org_id: orgId,
          role: 'agent',
          content: input.content,
          attachments: [],
          ai_metadata: { channel: 'email', resendId: sendResult.resendId },
        })
        .select('id')
        .single()

      if (msgError) console.error('[email.sendReply] messages insert error:', msgError.message)

      const persistedMessageId = (msgData as { id: string } | null)?.id ?? null

      const { error: emailMsgError } = await ctx.supabase
        .from('email_messages')
        .insert({
          org_id: orgId,
          conversation_id: input.conversationId,
          message_id: persistedMessageId,
          external_message_id: sendResult.messageId,
          in_reply_to: inReplyTo,
          references_header: references,
          subject: emailSubject,
          from_email: account.from_email,
          from_name: account.from_name,
          to_emails: [toEmail],
          cc_emails: [],
          text_body: input.content,
          html_body: input.contentHtml ?? null,
          direction: 'outbound',
          status: 'sent',
          raw_headers: { 'resend-id': sendResult.resendId },
        })

      if (emailMsgError) console.error('[email.sendReply] email_messages insert error:', emailMsgError.message)

      if (conv.status === 'pending' || conv.status === 'bot') {
        await ctx.supabase
          .from('conversations')
          .update({ status: 'open', assigned_to: ctx.user.id })
          .eq('id', input.conversationId)
          .eq('org_id', orgId)
      }

      return { success: true, messageId: sendResult.messageId, resendId: sendResult.resendId }
    }),
})

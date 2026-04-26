import crypto from "crypto"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../trpc/trpc"
import { requireFeature } from "../lib/plan-guards"
import { sendWhatsAppMessage } from "../services/whatsapp.service"
import type { Context } from "../trpc/context"

interface WhatsAppAccountRow {
  id: string
  org_id: string
  phone_number_id: string
  whatsapp_business_id: string
  access_token: string
  display_phone_number: string | null
  display_name: string | null
  webhook_verify_token: string
  is_active: boolean
  ai_auto_reply: boolean
  created_at: string
  updated_at: string
}

interface WhatsAppMessageRow {
  id: string
  org_id: string
  conversation_id: string
  message_id: string | null
  wa_message_id: string | null
  wa_contact_id: string | null
  direction: string
  status: string
  message_type: string
  media_url: string | null
  media_mime_type: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
}

interface NewRow {
  id: string
}

function parseMetaAuthErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  const msg = error.message
  if (!msg.includes('OAuthException') && !msg.includes('code\":190')) return null
  return 'WhatsApp authentication failed. Your Meta access token is expired or invalid. Please reconnect WhatsApp channel from Settings > Channels > WhatsApp.'
}

async function assertOrgAdmin(
  supabase: Context["supabase"],
  userId: string,
  orgId: string
): Promise<void> {
  const { data } = await supabase
    .from("user_organizations")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!data || (data as { role: string }).role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only admins can manage WhatsApp channel settings.",
    })
  }
}

function getWebhookBaseUrl(): string {
  return (
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    `http://localhost:${process.env.PORT || 3001}`
  )
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d]/g, "")
}

async function verifyMetaConnection(
  phoneNumberId: string,
  accessToken: string
): Promise<void> {
  let response: Response

  try {
    response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}?access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(10_000) }
    )
  } catch (err) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Cannot reach Meta Graph API: ${err instanceof Error ? err.message : "network error"}`,
    })
  }

  if (response.status === 401 || response.status === 403) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid WhatsApp access token.",
    })
  }

  if (!response.ok) {
    const body = await response.text().catch(() => `HTTP ${response.status}`)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Meta verification failed (${response.status}): ${body}`,
    })
  }
}

export const whatsappRouter = router({
  getAccount: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from("whatsapp_accounts")
      .select(
        "id, display_phone_number, display_name, is_active, ai_auto_reply, webhook_verify_token"
      )
      .eq("org_id", ctx.userOrgId)
      .maybeSingle()

    if (!data) return null

    const row = data as {
      id: string
      display_phone_number: string | null
      display_name: string | null
      is_active: boolean
      ai_auto_reply: boolean
      webhook_verify_token: string
    }
    const webhookUrl = `${getWebhookBaseUrl()}/api/whatsapp-webhook/${row.webhook_verify_token}`

    return {
      id: row.id,
      displayPhoneNumber: row.display_phone_number,
      displayName: row.display_name,
      isActive: row.is_active,
      aiAutoReply: row.ai_auto_reply,
      webhookUrl,
      verifyToken: row.webhook_verify_token,
    }
  }),

  setupAccount: protectedProcedure
    .input(
      z.object({
        phoneNumberId: z.string().min(1),
        whatsappBusinessId: z.string().min(1),
        accessToken: z.string().min(10),
        displayPhoneNumber: z.string().min(5),
        displayName: z.string().min(1).max(80).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)
      await requireFeature(ctx.supabase, ctx.userOrgId, "whatsappChannel")

      await verifyMetaConnection(input.phoneNumberId, input.accessToken)

      const verifyToken = crypto.randomBytes(32).toString("hex")
      const now = new Date().toISOString()

      const { error } = await ctx.supabase.from("whatsapp_accounts").upsert(
        {
          org_id: ctx.userOrgId,
          phone_number_id: input.phoneNumberId,
          whatsapp_business_id: input.whatsappBusinessId,
          access_token: input.accessToken,
          display_phone_number: input.displayPhoneNumber,
          display_name: input.displayName ?? null,
          webhook_verify_token: verifyToken,
          updated_at: now,
        },
        { onConflict: "org_id" }
      )

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to save WhatsApp account: ${error.message}`,
        })
      }

      const webhookUrl = `${getWebhookBaseUrl()}/api/whatsapp-webhook/${verifyToken}`
      return { webhookUrl, verifyToken }
    }),

  updateAccount: protectedProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
        aiAutoReply: z.boolean().optional(),
        displayName: z.string().max(80).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)
      await requireFeature(ctx.supabase, ctx.userOrgId, "whatsappChannel")

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (input.isActive !== undefined) patch["is_active"] = input.isActive
      if (input.aiAutoReply !== undefined) {
        patch["ai_auto_reply"] = input.aiAutoReply
      }
      if (input.displayName !== undefined) patch["display_name"] = input.displayName

      const { error } = await ctx.supabase
        .from("whatsapp_accounts")
        .update(patch)
        .eq("org_id", ctx.userOrgId)

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update WhatsApp account: ${error.message}`,
        })
      }

      return { success: true }
    }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)

    const { error } = await ctx.supabase
      .from("whatsapp_accounts")
      .delete()
      .eq("org_id", ctx.userOrgId)

    if (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      })
    }

    return { success: true }
  }),

  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    await assertOrgAdmin(ctx.supabase, ctx.user.id, ctx.userOrgId)
    await requireFeature(ctx.supabase, ctx.userOrgId, "whatsappChannel")

    const { data } = await ctx.supabase
      .from("whatsapp_accounts")
      .select("phone_number_id, access_token")
      .eq("org_id", ctx.userOrgId)
      .maybeSingle()

    const row = data as
      | {
          phone_number_id: string
          access_token: string
        }
      | null

    if (!row) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "WhatsApp account not configured.",
      })
    }

    await verifyMetaConnection(row.phone_number_id, row.access_token)
    return { connected: true }
  }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("org_id", ctx.userOrgId)
        .eq("conversation_id", input.conversationId)
        .order("created_at", { ascending: true })

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch WhatsApp messages: ${error.message}`,
        })
      }

      return ((data ?? []) as WhatsAppMessageRow[]).map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        messageId: row.message_id,
        waMessageId: row.wa_message_id,
        waContactId: row.wa_contact_id,
        direction: row.direction as "inbound" | "outbound",
        status: row.status as "sent" | "delivered" | "read" | "failed",
        messageType: row.message_type as
          | "text"
          | "image"
          | "audio"
          | "document"
          | "template"
          | "sticker"
          | "unsupported",
        mediaUrl: row.media_url,
        mediaMimeType: row.media_mime_type,
        rawPayload: row.raw_payload ?? null,
        createdAt: row.created_at,
      }))
    }),

  sendReply: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        content: z.string().min(1).max(4096),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireFeature(ctx.supabase, ctx.userOrgId, "whatsappChannel")

      const { data: convData } = await ctx.supabase
        .from("conversations")
        .select("id, status, channel, contact_id")
        .eq("org_id", ctx.userOrgId)
        .eq("id", input.conversationId)
        .maybeSingle()

      const conversation = convData as
        | {
            id: string
            status: string
            channel: string
            contact_id: string | null
          }
        | null

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found.",
        })
      }
      if (conversation.channel !== "whatsapp") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Not a WhatsApp conversation.",
        })
      }
      if (conversation.status === "resolved" || conversation.status === "closed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot reply to a resolved conversation.",
        })
      }

      const { data: accountData } = await ctx.supabase
        .from("whatsapp_accounts")
        .select("phone_number_id, access_token, is_active")
        .eq("org_id", ctx.userOrgId)
        .maybeSingle()

      const account = accountData as
        | {
            phone_number_id: string
            access_token: string
            is_active: boolean
          }
        | null

      if (!account) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "WhatsApp account not configured.",
        })
      }
      if (!account.is_active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "WhatsApp channel is disabled.",
        })
      }

      let toPhone: string | null = null
      if (conversation.contact_id) {
        const { data: contact } = await ctx.supabase
          .from("contacts")
          .select("phone")
          .eq("org_id", ctx.userOrgId)
          .eq("id", conversation.contact_id)
          .maybeSingle()

        toPhone = (contact as { phone: string | null } | null)?.phone ?? null
      }

      if (!toPhone) {
        const { data: lastInbound } = await ctx.supabase
          .from("whatsapp_messages")
          .select("wa_contact_id")
          .eq("org_id", ctx.userOrgId)
          .eq("conversation_id", conversation.id)
          .eq("direction", "inbound")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        toPhone =
          (lastInbound as { wa_contact_id: string | null } | null)?.wa_contact_id ??
          null
      }

      if (!toPhone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot determine recipient phone number.",
        })
      }

      let sendResult: { waMessageId: string }
      try {
        sendResult = await sendWhatsAppMessage({
          phoneNumberId: account.phone_number_id,
          accessToken: account.access_token,
          toPhone: normalizePhone(toPhone),
          text: input.content,
        })
      } catch (err) {
        const authError = parseMetaAuthErrorMessage(err)
        if (authError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: authError,
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to send WhatsApp message.',
        })
      }

      const { data: messageData, error: messageError } = await ctx.supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          org_id: ctx.userOrgId,
          role: "agent",
          content: input.content,
          attachments: [],
          ai_metadata: {
            channel: "whatsapp",
            waMessageId: sendResult.waMessageId,
          },
        })
        .select("id")
        .single()

      if (messageError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to save outbound message: ${messageError.message}`,
        })
      }

      const messageId = (messageData as NewRow | null)?.id ?? null

      const { error: waError } = await ctx.supabase.from("whatsapp_messages").insert({
        org_id: ctx.userOrgId,
        conversation_id: conversation.id,
        message_id: messageId,
        wa_message_id: sendResult.waMessageId,
        wa_contact_id: normalizePhone(toPhone),
        direction: "outbound",
        status: "sent",
        message_type: "text",
        raw_payload: { source: "agent_reply" },
      })

      if (waError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to save WhatsApp metadata: ${waError.message}`,
        })
      }

      if (conversation.status === "bot" || conversation.status === "pending") {
        await ctx.supabase
          .from("conversations")
          .update({ status: "open", assigned_to: ctx.user.id })
          .eq("id", conversation.id)
          .eq("org_id", ctx.userOrgId)
      }

      return { success: true, waMessageId: sendResult.waMessageId }
    }),
})

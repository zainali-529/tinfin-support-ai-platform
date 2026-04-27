import { Router, type Request, type Response } from "express"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { queryRAG } from "@workspace/ai"
import { planAllows } from "../lib/plans"
import { getOrgPlanId } from "../lib/subscriptions"
import {
  parseWhatsAppWebhook,
  sendWhatsAppMessage,
  verifyWebhookSignature,
  type ParsedWAMessage,
} from "../services/whatsapp.service"

export const whatsappWebhookRoute: Router = Router()

interface RequestWithRawBody extends Request {
  rawBody?: string
}

interface WhatsAppAccountRow {
  id: string
  org_id: string
  phone_number_id: string
  whatsapp_business_id: string
  access_token: string
  webhook_verify_token: string
  is_active: boolean
  ai_auto_reply: boolean
}

interface ContactRow {
  id: string
  name: string | null
  phone: string | null
}

interface ConversationRow {
  id: string
}

interface NewRow {
  id: string
}

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d]/g, "")
}

function inboundContent(parsed: ParsedWAMessage): string {
  if (parsed.messageType === "text") {
    return parsed.text.trim() || "(empty WhatsApp message)"
  }

  if (parsed.text.trim()) {
    return parsed.text.trim()
  }

  return `(${parsed.messageType} message)`
}

async function findAccountByToken(
  supabase: SupabaseClient,
  token: string
): Promise<WhatsAppAccountRow | null> {
  const { data } = await supabase
    .from("whatsapp_accounts")
    .select(
      "id, org_id, phone_number_id, whatsapp_business_id, access_token, webhook_verify_token, is_active, ai_auto_reply"
    )
    .eq("webhook_verify_token", token)
    .maybeSingle()

  return (data as WhatsAppAccountRow | null) ?? null
}

async function isWhatsAppChannelAllowed(
  supabase: SupabaseClient,
  orgId: string
): Promise<boolean> {
  const planId = await getOrgPlanId(supabase, orgId)
  return planAllows(planId, "whatsappChannel")
}

async function findContactByPhone(
  supabase: SupabaseClient,
  orgId: string,
  phone: string
): Promise<ContactRow | null> {
  const normalized = normalizePhone(phone)
  const plusPhone = `+${normalized}`

  const { data: exact } = await supabase
    .from("contacts")
    .select("id, name, phone")
    .eq("org_id", orgId)
    .eq("phone", normalized)
    .maybeSingle()

  if (exact) return exact as ContactRow

  const { data: plus } = await supabase
    .from("contacts")
    .select("id, name, phone")
    .eq("org_id", orgId)
    .eq("phone", plusPhone)
    .maybeSingle()

  return (plus as ContactRow | null) ?? null
}

async function upsertContact(
  supabase: SupabaseClient,
  orgId: string,
  parsed: ParsedWAMessage
): Promise<string> {
  const phone = normalizePhone(parsed.fromPhone)
  const existing = await findContactByPhone(supabase, orgId, phone)

  if (existing) {
    const nextPatch: Record<string, unknown> = {}
    if (!existing.name && parsed.fromName) nextPatch["name"] = parsed.fromName
    if (!existing.phone) nextPatch["phone"] = phone

    if (Object.keys(nextPatch).length > 0) {
      await supabase.from("contacts").update(nextPatch).eq("id", existing.id)
    }

    return existing.id
  }

  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      org_id: orgId,
      name: parsed.fromName ?? null,
      phone,
      meta: {
        source: "whatsapp",
        wa_contact_id: parsed.fromPhone,
      },
    })
    .select("id")
    .single()

  if (error || !created) {
    throw new Error(`Failed to create contact: ${error?.message ?? "unknown"}`)
  }

  return (created as NewRow).id
}

async function resolveConversation(
  supabase: SupabaseClient,
  orgId: string,
  contactId: string
): Promise<{ conversationId: string; isNew: boolean }> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("org_id", orgId)
    .eq("contact_id", contactId)
    .eq("channel", "whatsapp")
    .in("status", ["bot", "pending", "open"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = existing as ConversationRow | null
  if (row?.id) {
    return { conversationId: row.id, isNew: false }
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      org_id: orgId,
      contact_id: contactId,
      status: "pending",
      channel: "whatsapp",
    })
    .select("id")
    .single()

  if (error || !created) {
    throw new Error(
      `Failed to create WhatsApp conversation: ${error?.message ?? "unknown"}`
    )
  }

  return { conversationId: (created as NewRow).id, isNew: true }
}

async function isDuplicateMessage(
  supabase: SupabaseClient,
  waMessageId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("wa_message_id", waMessageId)
    .maybeSingle()

  return !!data
}

async function triggerAIAutoReply(params: {
  supabase: SupabaseClient
  account: WhatsAppAccountRow
  parsed: ParsedWAMessage
  conversationId: string
}) {
  const { supabase, account, parsed, conversationId } = params

  if (!account.ai_auto_reply) return

  const userText = parsed.text.trim()
  if (!userText) return

  try {
    const ragResult = await queryRAG({ query: userText, orgId: account.org_id })

    if (ragResult.type === "handoff" || ragResult.type === "ask_handoff") {
      return
    }
    if (!ragResult.message?.trim()) return

    const outbound = await sendWhatsAppMessage({
      phoneNumberId: account.phone_number_id,
      accessToken: account.access_token,
      toPhone: parsed.fromPhone,
      text: ragResult.message,
      replyToWaMessageId: parsed.waMessageId,
    })

    const { data: messageData } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        org_id: account.org_id,
        role: "assistant",
        content: ragResult.message,
        attachments: [],
        ai_metadata: {
          channel: "whatsapp",
          source: "auto_reply",
          type: ragResult.type,
          waMessageId: outbound.waMessageId,
        },
      })
      .select("id")
      .single()

    const messageId = (messageData as NewRow | null)?.id ?? null

    await supabase.from("whatsapp_messages").insert({
      org_id: account.org_id,
      conversation_id: conversationId,
      message_id: messageId,
      wa_message_id: outbound.waMessageId,
      wa_contact_id: parsed.fromPhone,
      direction: "outbound",
      status: "sent",
      message_type: "text",
      raw_payload: { source: "auto_reply" },
    })
  } catch (err) {
    console.error(
      "[whatsapp-webhook/ai] Auto-reply failed:",
      err instanceof Error ? err.message : err
    )
  }
}

async function processInboundMessage(params: {
  supabase: SupabaseClient
  account: WhatsAppAccountRow
  parsed: ParsedWAMessage
  rawPayload: unknown
}) {
  const { supabase, account, parsed, rawPayload } = params

  const duplicate = await isDuplicateMessage(supabase, parsed.waMessageId)
  if (duplicate) {
    console.log(`[whatsapp-webhook] Duplicate message: ${parsed.waMessageId}`)
    return
  }

  const contactId = await upsertContact(supabase, account.org_id, parsed)
  const { conversationId, isNew } = await resolveConversation(
    supabase,
    account.org_id,
    contactId
  )

  const { data: messageData, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      org_id: account.org_id,
      role: "user",
      content: inboundContent(parsed),
      attachments: [],
      ai_metadata: {
        channel: "whatsapp",
        waMessageId: parsed.waMessageId,
        messageType: parsed.messageType,
        mediaId: parsed.mediaId ?? null,
      },
    })
    .select("id")
    .single()

  if (messageError) {
    throw new Error(`Failed to insert message: ${messageError.message}`)
  }

  const messageId = (messageData as NewRow | null)?.id ?? null

  const { error: waError } = await supabase.from("whatsapp_messages").insert({
    org_id: account.org_id,
    conversation_id: conversationId,
    message_id: messageId,
    wa_message_id: parsed.waMessageId,
    wa_contact_id: parsed.fromPhone,
    direction: "inbound",
    status: "sent",
    message_type: parsed.messageType,
    media_url: parsed.mediaId ?? null,
    media_mime_type: parsed.mediaMimeType ?? null,
    raw_payload: rawPayload,
  })

  if (waError) {
    throw new Error(`Failed to insert whatsapp_message: ${waError.message}`)
  }

  console.log(
    `[whatsapp-webhook] org=${account.org_id} conv=${conversationId} isNew=${isNew} from=${parsed.fromPhone}`
  )

  void triggerAIAutoReply({
    supabase,
    account,
    parsed,
    conversationId,
  })
}

whatsappWebhookRoute.get("/:token", async (req: Request, res: Response) => {
  const { token } = req.params as { token: string }
  if (!token) {
    res.status(400).send("Missing token")
    return
  }

  const mode = String(req.query["hub.mode"] ?? "")
  const challenge = String(req.query["hub.challenge"] ?? "")
  const verifyToken = String(req.query["hub.verify_token"] ?? "")
  const supabase = getSupabase()

  try {
    const account = await findAccountByToken(supabase, token)
    if (!account) {
      res.status(404).send("Webhook not found")
      return
    }

    if (
      mode === "subscribe" &&
      challenge &&
      verifyToken === token &&
      verifyToken === account.webhook_verify_token
    ) {
      res.status(200).send(challenge)
      return
    }

    res.status(403).send("Verification failed")
  } catch (err) {
    console.error(
      "[whatsapp-webhook/get]",
      err instanceof Error ? err.message : err
    )
    res.status(500).send("Internal Server Error")
  }
})

whatsappWebhookRoute.post(
  "/:token",
  async (req: RequestWithRawBody, res: Response) => {
    const { token } = req.params as { token: string }
    if (!token) {
      res.status(200).json({ received: true })
      return
    }

    const supabase = getSupabase()

    try {
      const account = await findAccountByToken(supabase, token)
      if (!account || !account.is_active) {
        res.status(200).json({ received: true })
        return
      }

      const allowed = await isWhatsAppChannelAllowed(supabase, account.org_id)
      if (!allowed) {
        console.warn(
          `[whatsapp-webhook] Feature locked for org: ${account.org_id}`
        )
        res.status(200).json({ received: true })
        return
      }

      const rawPayload = req.rawBody ?? JSON.stringify(req.body ?? {})
      if (process.env.NODE_ENV === "production") {
        const signatureHeader = req.headers["x-hub-signature-256"]
        const signature = Array.isArray(signatureHeader)
          ? signatureHeader[0]
          : signatureHeader

        const appSecret = process.env.WHATSAPP_APP_SECRET
        if (!appSecret) {
          console.error(
            "[whatsapp-webhook] Missing WHATSAPP_APP_SECRET in production."
          )
          res.status(200).json({ received: true })
          return
        }

        const valid = verifyWebhookSignature(
          rawPayload,
          signature ?? "",
          appSecret
        )
        if (!valid) {
          console.warn("[whatsapp-webhook] Invalid webhook signature.")
          res.status(200).json({ received: true })
          return
        }
      }

      const parsed = parseWhatsAppWebhook(req.body)
      if (!parsed) {
        res.status(200).json({ received: true })
        return
      }

      if (parsed.phoneNumberId !== account.phone_number_id) {
        console.warn(
          `[whatsapp-webhook] Phone Number ID mismatch for token ${token.slice(
            0,
            8
          )}`
        )
        res.status(200).json({ received: true })
        return
      }

      if (parsed.wabaId !== account.whatsapp_business_id) {
        console.warn(
          `[whatsapp-webhook] WABA ID mismatch (payload=${parsed.wabaId}, account=${account.whatsapp_business_id}). Continuing because phone_number_id matched.`
        )
      }

      res.status(200).json({ received: true })

      void processInboundMessage({
        supabase,
        account,
        parsed,
        rawPayload: req.body,
      }).catch((err) => {
        console.error(
          "[whatsapp-webhook/process]",
          err instanceof Error ? err.message : err
        )
      })
    } catch (err) {
      console.error(
        "[whatsapp-webhook/post]",
        err instanceof Error ? err.message : err
      )
      res.status(200).json({ received: true })
    }
  }
)

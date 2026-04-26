import crypto from "crypto"

type WAMessageType =
  | "text"
  | "image"
  | "audio"
  | "document"
  | "sticker"
  | "unsupported"

export interface ParsedWAMessage {
  fromPhone: string
  fromName: string | null
  waMessageId: string
  messageType: WAMessageType
  text: string
  mediaId?: string
  mediaMimeType?: string
  timestamp: string
  phoneNumberId: string
  wabaId: string
}

interface SendWhatsAppMessageParams {
  phoneNumberId: string
  accessToken: string
  toPhone: string
  text: string
  replyToWaMessageId?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

function normalizePhone(value: string | null): string | null {
  if (!value) return null
  const normalized = value.replace(/[^\d]/g, "")
  return normalized.length > 0 ? normalized : null
}

function parseMessageType(raw: string | null): WAMessageType {
  switch (raw) {
    case "text":
      return "text"
    case "image":
      return "image"
    case "audio":
      return "audio"
    case "document":
      return "document"
    case "sticker":
      return "sticker"
    default:
      return "unsupported"
  }
}

export function parseWhatsAppWebhook(body: unknown): ParsedWAMessage | null {
  const root = asRecord(body)
  if (!root) return null

  const entries = Array.isArray(root["entry"]) ? root["entry"] : []
  for (const entryItem of entries) {
    const entry = asRecord(entryItem)
    if (!entry) continue

    const wabaId = asString(entry["id"])
    const changes = Array.isArray(entry["changes"]) ? entry["changes"] : []

    for (const changeItem of changes) {
      const change = asRecord(changeItem)
      if (!change) continue

      const value = asRecord(change["value"])
      if (!value) continue

      const metadata = asRecord(value["metadata"])
      const phoneNumberId = asString(metadata?.["phone_number_id"])
      if (!phoneNumberId || !wabaId) continue

      const contacts = Array.isArray(value["contacts"]) ? value["contacts"] : []
      const firstContact = asRecord(contacts[0])
      const profile = asRecord(firstContact?.["profile"])
      const fromName = asString(profile?.["name"])

      const messages = Array.isArray(value["messages"]) ? value["messages"] : []
      for (const messageItem of messages) {
        const message = asRecord(messageItem)
        if (!message) continue

        const fromPhone = normalizePhone(asString(message["from"]))
        const waMessageId = asString(message["id"])
        const timestamp = asString(message["timestamp"])
        const typeRaw = asString(message["type"])
        const messageType = parseMessageType(typeRaw)

        if (!fromPhone || !waMessageId || !timestamp) {
          continue
        }

        if (messageType === "text") {
          const textBlock = asRecord(message["text"])
          return {
            fromPhone,
            fromName,
            waMessageId,
            messageType,
            text: asString(textBlock?.["body"]) ?? "",
            timestamp,
            phoneNumberId,
            wabaId,
          }
        }

        if (
          messageType === "image" ||
          messageType === "audio" ||
          messageType === "document" ||
          messageType === "sticker"
        ) {
          const mediaBlock = asRecord(message[messageType])
          const mediaId = asString(mediaBlock?.["id"])
          const mediaMimeType = asString(mediaBlock?.["mime_type"]) ?? undefined
          const caption = asString(mediaBlock?.["caption"]) ?? ""

          return {
            fromPhone,
            fromName,
            waMessageId,
            messageType,
            text: caption,
            mediaId: mediaId ?? undefined,
            mediaMimeType,
            timestamp,
            phoneNumberId,
            wabaId,
          }
        }

        return {
          fromPhone,
          fromName,
          waMessageId,
          messageType: "unsupported",
          text: "",
          timestamp,
          phoneNumberId,
          wabaId,
        }
      }
    }
  }

  return null
}

export async function sendWhatsAppMessage(
  params: SendWhatsAppMessageParams
): Promise<{ waMessageId: string }> {
  const toPhone = normalizePhone(params.toPhone)
  if (!toPhone) {
    throw new Error("Invalid recipient phone number.")
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toPhone,
    type: "text",
    text: { body: params.text },
  }

  if (params.replyToWaMessageId) {
    payload["context"] = { message_id: params.replyToWaMessageId }
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => `HTTP ${response.status}`)
    throw new Error(`WhatsApp send failed (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as {
    messages?: Array<{ id?: string }>
  }
  const waMessageId = data.messages?.[0]?.id

  if (!waMessageId) {
    throw new Error("WhatsApp API did not return a message ID.")
  }

  return { waMessageId }
}

export async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string
): Promise<Buffer> {
  const metadataRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  })

  if (!metadataRes.ok) {
    const body = await metadataRes.text().catch(() => `HTTP ${metadataRes.status}`)
    throw new Error(`Failed to fetch WhatsApp media metadata: ${body}`)
  }

  const metadata = (await metadataRes.json()) as { url?: string }
  if (!metadata.url) {
    throw new Error("WhatsApp media metadata did not include a URL.")
  }

  const mediaRes = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  })

  if (!mediaRes.ok) {
    const body = await mediaRes.text().catch(() => `HTTP ${mediaRes.status}`)
    throw new Error(`Failed to download WhatsApp media: ${body}`)
  }

  const arrayBuffer = await mediaRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  try {
    if (!payload || !signature || !appSecret) return false

    const expectedDigest = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest("hex")
    const expected = `sha256=${expectedDigest}`

    const expectedBuffer = Buffer.from(expected, "utf8")
    const receivedBuffer = Buffer.from(signature, "utf8")
    if (expectedBuffer.length !== receivedBuffer.length) return false

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  } catch {
    return false
  }
}

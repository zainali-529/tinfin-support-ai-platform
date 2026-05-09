import { NextResponse } from "next/server"
import { z } from "zod"

const TOPICS = ["general", "sales", "support", "billing", "partnership", "security"] as const

const contactRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  company: z.string().trim().max(120).optional().default(""),
  topic: z.enum(TOPICS),
  message: z.string().trim().min(10).max(1600),
  botField: z.string().trim().max(120).optional().default(""),
})

type ContactRequestPayload = z.infer<typeof contactRequestSchema>

function buildWebhookPayload(payload: ContactRequestPayload, request: Request) {
  return {
    source: "tinfiz_marketing_contact_page",
    submittedAt: new Date().toISOString(),
    page: "/contact",
    contact: {
      name: payload.name,
      email: payload.email,
      company: payload.company || null,
      topic: payload.topic,
      message: payload.message,
    },
    context: {
      userAgent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
    },
  }
}

export async function POST(request: Request) {
  let rawBody: unknown

  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, message: "Please submit the form again. The request body was not valid JSON." },
      { status: 400 },
    )
  }

  const parsed = contactRequestSchema.safeParse(rawBody)

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Please check the highlighted fields and try again.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }

  if (parsed.data.botField) {
    return NextResponse.json({ ok: true, delivered: true })
  }

  const webhookUrl = process.env.CONTACT_REQUEST_WEBHOOK_URL?.trim()
  const webhookSecret = process.env.CONTACT_REQUEST_WEBHOOK_SECRET?.trim()

  if (!webhookUrl) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, message: "Contact requests are not configured yet. Please email hello@tinfiz.ai." },
        { status: 503 },
      )
    }

    console.info("[contact-request] Validated locally. Set CONTACT_REQUEST_WEBHOOK_URL to receive contact messages.")
    return NextResponse.json({ ok: true, delivered: false })
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(webhookSecret ? { "x-tinfiz-contact-secret": webhookSecret } : {}),
      },
      body: JSON.stringify(buildWebhookPayload(parsed.data, request)),
    })

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`)
    }
  } catch (error) {
    console.error("[contact-request] webhook delivery failed", error)
    return NextResponse.json(
      { ok: false, message: "We could not send your message right now. Please try again in a moment." },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, delivered: true })
}

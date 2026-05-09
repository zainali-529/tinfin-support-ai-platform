import { NextResponse } from "next/server"
import { z } from "zod"

const CHANNELS = ["website_chat", "email", "whatsapp", "voice", "ai_actions"] as const

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  company: z.string().trim().min(2).max(120),
  websiteUrl: z.string().trim().min(3).max(220).transform(normalizeUrl).pipe(z.string().url().max(240)),
  channels: z.array(z.enum(CHANNELS)).min(1).max(CHANNELS.length),
  message: z.string().trim().min(10).max(1200),
  teamSize: z.string().trim().max(80).optional().default(""),
  currentTool: z.string().trim().max(120).optional().default(""),
  botField: z.string().trim().max(120).optional().default(""),
})

type DemoRequestPayload = z.infer<typeof demoRequestSchema>

function buildWebhookPayload(payload: DemoRequestPayload, request: Request) {
  return {
    source: "tinfiz_marketing_demo_page",
    submittedAt: new Date().toISOString(),
    page: "/demo",
    lead: {
      name: payload.name,
      email: payload.email,
      company: payload.company,
      websiteUrl: payload.websiteUrl,
      channels: payload.channels,
      message: payload.message,
      teamSize: payload.teamSize || null,
      currentTool: payload.currentTool || null,
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

  const parsed = demoRequestSchema.safeParse(rawBody)

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

  const webhookUrl = process.env.DEMO_REQUEST_WEBHOOK_URL?.trim()
  const webhookSecret = process.env.DEMO_REQUEST_WEBHOOK_SECRET?.trim()

  if (!webhookUrl) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, message: "Demo requests are not configured yet. Please try again later." },
        { status: 503 },
      )
    }

    console.info("[demo-request] Validated locally. Set DEMO_REQUEST_WEBHOOK_URL to receive demo leads.")
    return NextResponse.json({ ok: true, delivered: false })
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(webhookSecret ? { "x-tinfiz-demo-secret": webhookSecret } : {}),
      },
      body: JSON.stringify(buildWebhookPayload(parsed.data, request)),
    })

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`)
    }
  } catch (error) {
    console.error("[demo-request] webhook delivery failed", error)
    return NextResponse.json(
      { ok: false, message: "We could not send your request right now. Please try again in a moment." },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, delivered: true })
}

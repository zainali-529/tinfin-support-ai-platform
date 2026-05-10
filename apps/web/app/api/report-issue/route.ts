import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const issueTypeSchema = z.enum(['bug', 'slow', 'data', 'billing', 'channel', 'other'])
const issueSeveritySchema = z.enum(['blocker', 'high', 'normal', 'low'])

const reportIssueSchema = z.object({
  type: issueTypeSchema,
  severity: issueSeveritySchema,
  summary: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(4000),
  steps: z.string().trim().max(1600).optional().default(''),
  expected: z.string().trim().max(1000).optional().default(''),
  actual: z.string().trim().max(1000).optional().default(''),
  metadata: z.object({
    page: z.object({
      url: z.string().trim().max(1000).optional().default(''),
      pathname: z.string().trim().max(300).optional().default(''),
      title: z.string().trim().max(300).optional().default(''),
      referrer: z.string().trim().max(1000).optional().default(''),
    }).optional().default({}),
    client: z.record(z.unknown()).optional().default({}),
    org: z.record(z.unknown()).optional().default({}),
    user: z.record(z.unknown()).optional().default({}),
  }).optional().default({}),
})

type IssueReportInput = z.infer<typeof reportIssueSchema>

type DeliveryResult = {
  channel: 'webhook' | 'email' | 'sentry'
  ok: boolean
  detail?: string
}

function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

function cleanClientMetadata(metadata: IssueReportInput['metadata']) {
  const client = metadata.client ?? {}
  return {
    page: metadata.page ?? {},
    client: {
      userAgent: typeof client.userAgent === 'string' ? client.userAgent.slice(0, 500) : null,
      language: typeof client.language === 'string' ? client.language.slice(0, 80) : null,
      timezone: typeof client.timezone === 'string' ? client.timezone.slice(0, 120) : null,
      viewport: typeof client.viewport === 'string' ? client.viewport.slice(0, 40) : null,
      screen: typeof client.screen === 'string' ? client.screen.slice(0, 40) : null,
      devicePixelRatio: typeof client.devicePixelRatio === 'number' ? client.devicePixelRatio : null,
      appVersion: typeof client.appVersion === 'string' ? client.appVersion.slice(0, 120) : null,
    },
  }
}

function buildIssueId(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `ISS-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

function buildTextEmail(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`)
    .join('\n\n')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildHtmlEmail(payload: Record<string, unknown>): string {
  const rows = Object.entries(payload)
    .map(([key, value]) => {
      const formatted = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:600;vertical-align:top;width:180px;">${escapeHtml(key)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap;">${escapeHtml(formatted)}</td>
        </tr>
      `
    })
    .join('')

  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.5;">
      <h2 style="margin:0 0 12px;">New Tinfiz issue report</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        ${rows}
      </table>
    </div>
  `
}

async function deliverWebhook(reportPayload: Record<string, unknown>): Promise<DeliveryResult | null> {
  const webhookUrl = process.env.ISSUE_REPORT_WEBHOOK_URL?.trim()
  if (!webhookUrl) return null

  const webhookSecret = process.env.ISSUE_REPORT_WEBHOOK_SECRET?.trim()

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(webhookSecret ? { 'x-tinfiz-issue-secret': webhookSecret } : {}),
      },
      body: JSON.stringify(reportPayload),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      return { channel: 'webhook', ok: false, detail: `Webhook returned ${response.status}` }
    }

    return { channel: 'webhook', ok: true }
  } catch (error) {
    return {
      channel: 'webhook',
      ok: false,
      detail: error instanceof Error ? error.message : 'Webhook delivery failed.',
    }
  }
}

async function deliverEmail(reportPayload: Record<string, unknown>): Promise<DeliveryResult | null> {
  const to = process.env.ISSUE_REPORT_EMAIL_TO?.trim()
  if (!to) return null

  const apiKey = (
    process.env.ISSUE_REPORT_RESEND_API_KEY ??
    process.env.NOTIFICATION_RESEND_API_KEY ??
    process.env.RESEND_API_KEY ??
    ''
  ).trim()
  const from = (
    process.env.ISSUE_REPORT_EMAIL_FROM ??
    process.env.NOTIFICATION_EMAIL_FROM ??
    ''
  ).trim()
  const fromName = (process.env.ISSUE_REPORT_EMAIL_FROM_NAME ?? 'Tinfiz Issue Reports').trim()
  const replyTo = (
    process.env.ISSUE_REPORT_EMAIL_REPLY_TO ??
    process.env.NOTIFICATION_EMAIL_REPLY_TO ??
    ''
  ).trim()

  if (!apiKey || !from) {
    return {
      channel: 'email',
      ok: false,
      detail: 'Issue report email is missing Resend API key or sender address.',
    }
  }

  const issueId = typeof reportPayload.issueId === 'string' ? reportPayload.issueId : 'issue'
  const summary = typeof reportPayload.summary === 'string' ? reportPayload.summary : 'Issue report'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${from}>`,
        to: to.split(',').map((item) => item.trim()).filter(Boolean),
        reply_to: replyTo || undefined,
        subject: `[${issueId}] ${summary}`,
        text: buildTextEmail(reportPayload),
        html: buildHtmlEmail(reportPayload),
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => `Resend returned ${response.status}`)
      return { channel: 'email', ok: false, detail }
    }

    return { channel: 'email', ok: true }
  } catch (error) {
    return {
      channel: 'email',
      ok: false,
      detail: error instanceof Error ? error.message : 'Email delivery failed.',
    }
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, message: 'Please sign in before reporting an issue.' }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'The issue report body was not valid JSON.' }, { status: 400 })
  }

  const parsed = reportIssueSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Please check the issue report fields and try again.',
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }

  const input = parsed.data
  const issueId = buildIssueId()

  const { data: userRecord } = await supabase
    .from('users')
    .select('name, email, org_id, active_org_id')
    .eq('id', user.id)
    .maybeSingle()

  const activeOrgId = userRecord?.active_org_id ?? userRecord?.org_id ?? null

  const { data: activeOrg } = activeOrgId
    ? await supabase
        .from('organizations')
        .select('id, name, plan')
        .eq('id', activeOrgId)
        .maybeSingle()
    : { data: null }

  const { data: membership } = activeOrgId
    ? await supabase
        .from('user_organizations')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', activeOrgId)
        .maybeSingle()
    : { data: null }

  const trustedUser = {
    id: user.id,
    email: userRecord?.email ?? user.email ?? null,
    name: userRecord?.name ?? (typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null),
  }
  const trustedOrg = activeOrg
    ? {
        id: activeOrg.id,
        name: activeOrg.name,
        plan: activeOrg.plan,
        role: membership?.role ?? null,
      }
    : null
  const clientMetadata = cleanClientMetadata(input.metadata)

  const reportPayload = {
    issueId,
    source: 'tinfiz_dashboard_report_issue',
    submittedAt: new Date().toISOString(),
    type: input.type,
    severity: input.severity,
    summary: input.summary,
    description: input.description,
    steps: input.steps || null,
    expected: input.expected || null,
    actual: input.actual || null,
    user: trustedUser,
    organization: trustedOrg,
    page: clientMetadata.page,
    client: clientMetadata.client,
    server: {
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'unknown',
      release: process.env.SENTRY_RELEASE ?? process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      ip: getRequestIp(request),
      userAgent: request.headers.get('user-agent'),
      referrer: request.headers.get('referer'),
    },
  }

  Sentry.captureMessage('User issue reported', {
    level: input.severity === 'blocker' || input.severity === 'high' ? 'warning' : 'info',
    tags: {
      surface: 'user_issue_report',
      issue_type: input.type,
      severity: input.severity,
      org_id: trustedOrg?.id ?? 'none',
    },
    user: {
      id: trustedUser.id,
      email: trustedUser.email ?? undefined,
    },
    extra: reportPayload,
  })

  const deliveryResults = (
    await Promise.all([
      deliverWebhook(reportPayload),
      deliverEmail(reportPayload),
    ])
  ).filter((item): item is DeliveryResult => Boolean(item))

  const sentryResult: DeliveryResult = { channel: 'sentry', ok: true }
  const allResults = [sentryResult, ...deliveryResults]
  const configuredExternalDelivery = deliveryResults.length > 0
  const successfulExternalDelivery = deliveryResults.some((item) => item.ok)

  if (!configuredExternalDelivery && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        ok: false,
        issueId,
        message: 'Issue reporting delivery is not configured yet.',
        delivery: allResults,
      },
      { status: 503 },
    )
  }

  if (configuredExternalDelivery && !successfulExternalDelivery) {
    return NextResponse.json(
      {
        ok: false,
        issueId,
        message: 'We captured the issue, but could not deliver it to the support inbox.',
        delivery: allResults,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    issueId,
    delivered: successfulExternalDelivery,
    delivery: allResults,
  })
}

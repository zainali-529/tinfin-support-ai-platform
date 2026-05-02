import { TRPCError } from '@trpc/server'
import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { z } from 'zod'
import { protectedProcedure, router } from '../trpc/trpc'
import { requirePermissionFromContext } from '../lib/org-permissions'

type PlatformKey =
  | 'wordpress'
  | 'shopify'
  | 'webflow'
  | 'wix'
  | 'squarespace'
  | 'google_tag_manager'
  | 'segment'
  | 'nextjs'
  | 'react'
  | 'custom'

type CheckStatus = 'pass' | 'warn' | 'fail'

type InstallStatus = 'installed' | 'wrong_org' | 'missing' | 'unreachable'

export interface DetectionSignal {
  key: string
  label: string
  matched: boolean
  detail: string
}

export interface InstallCheck {
  key: string
  label: string
  status: CheckStatus
  detail: string
}

export interface MatchedScript {
  src: string | null
  orgId: string | null
  async: boolean
  type: string | null
}

const urlInput = z.object({
  url: z.string().trim().min(3).max(2048),
})

const verifyInput = urlInput.extend({
  orgId: z.string().uuid().optional(),
})

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  wordpress: 'WordPress',
  shopify: 'Shopify',
  webflow: 'Webflow',
  wix: 'Wix',
  squarespace: 'Squarespace',
  google_tag_manager: 'Google Tag Manager',
  segment: 'Segment',
  nextjs: 'Next.js',
  react: 'React / SPA',
  custom: 'Custom website',
}

const PLATFORM_PRIORITIES: PlatformKey[] = [
  'shopify',
  'wordpress',
  'webflow',
  'wix',
  'squarespace',
  'google_tag_manager',
  'segment',
  'nextjs',
  'react',
  'custom',
]

function normalizeUrl(rawUrl: string): string {
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Please enter a valid website URL.' })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only http and https URLs are supported.' })
  }

  parsed.hash = ''
  return parsed.toString()
}

function safeRequestedUrl(rawUrl: string): string {
  try {
    return normalizeUrl(rawUrl)
  } catch {
    return rawUrl
  }
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false
  const a = parts[0] ?? -1
  const b = parts[1] ?? -1
  if (a === 10 || a === 127 || a === 0 || a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase()
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
}

async function assertPublicUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url)
  const parsed = new URL(normalized)
  const host = parsed.hostname.toLowerCase()

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Local/private URLs cannot be scanned from the server.' })
  }

  if (net.isIP(host)) {
    if ((net.isIP(host) === 4 && isPrivateIPv4(host)) || (net.isIP(host) === 6 && isPrivateIPv6(host))) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Private network addresses cannot be scanned.' })
    }
    return normalized
  }

  try {
    const addresses = await lookup(host, { all: true })
    if (addresses.some((entry) =>
      (entry.family === 4 && isPrivateIPv4(entry.address)) ||
      (entry.family === 6 && isPrivateIPv6(entry.address))
    )) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This URL resolves to a private network address.' })
    }
  } catch (error) {
    if (error instanceof TRPCError) throw error
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not resolve this website URL.' })
  }

  return normalized
}

async function readLimitedText(response: Response, maxBytes = 1_500_000): Promise<string> {
  if (!response.body) return response.text()
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      chunks.push(decoder.decode(value.slice(0, Math.max(0, value.byteLength - (received - maxBytes))), { stream: false }))
      break
    }
    chunks.push(decoder.decode(value, { stream: true }))
  }

  chunks.push(decoder.decode())
  return chunks.join('')
}

async function fetchHtml(rawUrl: string, redirectCount = 0): Promise<{
  requestedUrl: string
  finalUrl: string
  status: number
  contentType: string
  html: string
}> {
  if (redirectCount > 4) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Too many redirects while scanning this site.' })
  }

  const safeUrl = await assertPublicUrl(rawUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(safeUrl, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'TinfinInstallVerifier/1.0 (+https://tinfin.ai)',
        accept: 'text/html,application/xhtml+xml',
      },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Website redirected without a location header.' })
      const nextUrl = new URL(location, safeUrl).toString()
      return fetchHtml(nextUrl, redirectCount + 1)
    }

    const contentType = response.headers.get('content-type') ?? ''
    const html = await readLimitedText(response)
    return {
      requestedUrl: normalizeUrl(rawUrl),
      finalUrl: response.url || safeUrl,
      status: response.status,
      contentType,
      html,
    }
  } catch (error) {
    if (error instanceof TRPCError) throw error
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error instanceof Error && error.name === 'AbortError'
        ? 'Website scan timed out. Please try again.'
        : 'Could not fetch this website. Make sure it is public and reachable.',
    })
  } finally {
    clearTimeout(timeout)
  }
}

function has(html: string, pattern: RegExp): boolean {
  return pattern.test(html)
}

function detectSignals(html: string, finalUrl: string): DetectionSignal[] {
  const source = html.slice(0, 1_500_000)
  const url = finalUrl.toLowerCase()
  return [
    {
      key: 'shopify',
      label: 'Shopify storefront signals',
      matched: has(source, /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i) || url.includes('myshopify.com'),
      detail: 'Shopify CDN, theme object, or myshopify domain found.',
    },
    {
      key: 'wordpress',
      label: 'WordPress signals',
      matched: has(source, /wp-content|wp-includes|generator[^>]+WordPress/i),
      detail: 'WordPress asset paths or generator metadata found.',
    },
    {
      key: 'webflow',
      label: 'Webflow signals',
      matched: has(source, /webflow\.js|data-wf-page|data-wf-site/i),
      detail: 'Webflow runtime or data attributes found.',
    },
    {
      key: 'wix',
      label: 'Wix signals',
      matched: has(source, /wixstatic\.com|wix-code|X-Wix/i),
      detail: 'Wix static assets or runtime markers found.',
    },
    {
      key: 'squarespace',
      label: 'Squarespace signals',
      matched: has(source, /static\.squarespace\.com|Squarespace|squarespace-cdn/i),
      detail: 'Squarespace static assets or globals found.',
    },
    {
      key: 'google_tag_manager',
      label: 'Google Tag Manager installed',
      matched: has(source, /googletagmanager\.com\/gtm\.js\?id=GTM-|GTM-[A-Z0-9]+/i),
      detail: 'GTM container found, so Custom HTML install may be fastest.',
    },
    {
      key: 'segment',
      label: 'Segment analytics installed',
      matched: has(source, /cdn\.segment\.com\/analytics\.js|analytics\.load\(/i),
      detail: 'Segment runtime found, useful for identity handoff guidance.',
    },
    {
      key: 'nextjs',
      label: 'Next.js app signals',
      matched: has(source, /__NEXT_DATA__|\/_next\/static/i),
      detail: 'Next.js server/app-router asset markers found.',
    },
    {
      key: 'react',
      label: 'Single-page app signals',
      matched: has(source, /data-reactroot|react-refresh|vite\/client|root"><\/div>/i),
      detail: 'SPA-style markers found.',
    },
  ]
}

function pickPlatform(signals: DetectionSignal[]) {
  const matched = new Set(signals.filter((signal) => signal.matched).map((signal) => signal.key as PlatformKey))
  const key = PLATFORM_PRIORITIES.find((candidate) => matched.has(candidate)) ?? 'custom'
  const confidence = key === 'custom' ? 0.45 : Math.min(0.95, 0.65 + signals.filter((signal) => signal.matched).length * 0.05)
  const reasons = signals.filter((signal) => signal.matched).map((signal) => signal.detail)

  return {
    key,
    label: PLATFORM_LABELS[key],
    confidence,
    reasons: reasons.length ? reasons : ['No known CMS marker was found, so use the universal JavaScript snippet.'],
    recommendedMethod: getRecommendedMethod(key),
  }
}

function getRecommendedMethod(platform: PlatformKey): string {
  switch (platform) {
    case 'shopify': return 'Use Theme App Embed when available, otherwise paste the script before </body> in theme.liquid.'
    case 'wordpress': return 'Use a header/footer code plugin or your theme footer.php before </body>.'
    case 'webflow': return 'Paste the snippet in Project Settings > Custom Code > Footer Code, then publish.'
    case 'wix': return 'Use Settings > Custom Code and load it on all pages in Body end.'
    case 'squarespace': return 'Use Settings > Advanced > Code Injection > Footer.'
    case 'google_tag_manager': return 'Use a GTM Custom HTML tag with All Pages trigger.'
    case 'segment': return 'Install script normally, then pass identified user data through Tinfin("update").'
    case 'nextjs': return 'Use next/script in app/layout.tsx with strategy="lazyOnload".'
    case 'react': return 'Load once in your app shell and use Tinfin("update") on route/user changes.'
    default: return 'Paste the universal script before the closing body tag.'
  }
}

function parseAttributes(rawAttrs: string): Record<string, string | true> {
  const attrs: Record<string, string | true> = {}
  const attrPattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let match: RegExpExecArray | null
  while ((match = attrPattern.exec(rawAttrs)) !== null) {
    const key = match[1]?.toLowerCase()
    if (!key) continue
    attrs[key] = match[2] ?? match[3] ?? match[4] ?? true
  }
  return attrs
}

function extractScriptTags(html: string): MatchedScript[] {
  const scripts: MatchedScript[] = []
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html)) !== null) {
    const attrs = parseAttributes(match[1] ?? '')
    const body = match[2] ?? ''
    const src = typeof attrs.src === 'string' ? attrs.src : null
    const orgId = typeof attrs['data-org-id'] === 'string'
      ? attrs['data-org-id']
      : typeof attrs['data-organization-id'] === 'string'
        ? attrs['data-organization-id']
        : null
    const looksLikeTinfin =
      /tinfin/i.test(src ?? '') ||
      /Tinfin\(|tinfinSettings|data-tinfin-widget/i.test(body) ||
      Boolean(orgId && /tinfin|widget/i.test(src ?? body))

    if (looksLikeTinfin) {
      scripts.push({
        src,
        orgId,
        async: attrs.async === true || attrs.async === 'true',
        type: typeof attrs.type === 'string' ? attrs.type : null,
      })
    }
  }

  return scripts
}

function buildInstallChecks(params: {
  status: number
  contentType: string
  expectedOrgId: string
  scripts: MatchedScript[]
  signals: DetectionSignal[]
}): { status: InstallStatus; checks: InstallCheck[] } {
  const hasTinfinScript = params.scripts.length > 0
  const correctOrg = params.scripts.some((script) => script.orgId === params.expectedOrgId)
  const hasWrongOrg = params.scripts.some((script) => script.orgId && script.orgId !== params.expectedOrgId)
  const hasGtm = params.signals.some((signal) => signal.key === 'google_tag_manager' && signal.matched)

  const checks: InstallCheck[] = [
    {
      key: 'reachable',
      label: 'Website is reachable',
      status: params.status >= 200 && params.status < 400 ? 'pass' : 'fail',
      detail: `HTTP ${params.status}${params.contentType ? ` (${params.contentType})` : ''}`,
    },
    {
      key: 'script_found',
      label: 'Tinfin script found',
      status: hasTinfinScript ? 'pass' : hasGtm ? 'warn' : 'fail',
      detail: hasTinfinScript
        ? `${params.scripts.length} Tinfin script tag(s) found.`
        : hasGtm
          ? 'Direct script was not visible in HTML. If installed through GTM, preview the tag or publish the container.'
          : 'No Tinfin widget script was found in the page HTML.',
    },
    {
      key: 'org_match',
      label: 'Organization ID matches',
      status: correctOrg ? 'pass' : hasWrongOrg ? 'fail' : 'warn',
      detail: correctOrg
        ? 'data-org-id matches this workspace.'
        : hasWrongOrg
          ? 'A Tinfin script exists but uses a different organization ID.'
          : 'No data-org-id was found on the detected script.',
    },
    {
      key: 'async',
      label: 'Script loads asynchronously',
      status: params.scripts.length === 0 || params.scripts.some((script) => script.async) ? 'pass' : 'warn',
      detail: params.scripts.some((script) => script.async)
        ? 'The script uses async loading.'
        : 'Add async to avoid blocking page rendering.',
    },
  ]

  const status: InstallStatus = !hasTinfinScript
    ? 'missing'
    : correctOrg
      ? 'installed'
      : hasWrongOrg
        ? 'wrong_org'
        : 'missing'

  return { status, checks }
}

export const widgetInstallRouter = router({
  detectPlatform: protectedProcedure
    .input(urlInput)
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'embedding', 'Embedding access is required.')
      const result = await fetchHtml(input.url)
      const signals = detectSignals(result.html, result.finalUrl)
      return {
        requestedUrl: result.requestedUrl,
        finalUrl: result.finalUrl,
        httpStatus: result.status,
        contentType: result.contentType,
        platform: pickPlatform(signals),
        signals,
      }
    }),

  verifyInstall: protectedProcedure
    .input(verifyInput)
    .query(async ({ ctx, input }) => {
      requirePermissionFromContext(ctx, 'embedding', 'Embedding access is required.')
      const expectedOrgId = input.orgId ?? ctx.userOrgId
      try {
        const result = await fetchHtml(input.url)
        const signals = detectSignals(result.html, result.finalUrl)
        const scripts = extractScriptTags(result.html)
        const install = buildInstallChecks({
          status: result.status,
          contentType: result.contentType,
          expectedOrgId,
          scripts,
          signals,
        })

        return {
          requestedUrl: result.requestedUrl,
          finalUrl: result.finalUrl,
          httpStatus: result.status,
          status: install.status,
          checks: install.checks,
          scripts,
          platform: pickPlatform(signals),
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          return {
            requestedUrl: safeRequestedUrl(input.url),
            finalUrl: null,
            httpStatus: null,
            status: 'unreachable' as InstallStatus,
            checks: [{
              key: 'reachable',
              label: 'Website is reachable',
              status: 'fail' as CheckStatus,
              detail: error.message,
            }],
            scripts: [],
            platform: null,
          }
        }
        throw error
      }
    }),
})

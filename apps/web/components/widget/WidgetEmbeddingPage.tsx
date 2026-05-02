'use client'

import { useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Separator } from '@workspace/ui/components/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import {
  AlertTriangleIcon,
  CheckIcon,
  Code2Icon,
  CopyIcon,
  GlobeIcon,
  Loader2Icon,
  RefreshCwIcon,
  RocketIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TerminalSquareIcon,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'

type SnippetKey =
  | 'basic'
  | 'loader'
  | 'next'
  | 'react'
  | 'gtm'
  | 'wordpress'
  | 'shopify'
  | 'webflow'
  | 'identity'
  | 'dev'

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

const SCRIPT_SRC = 'https://cdn.tinfin.com/widget.js'
const LOCAL_SCRIPT_SRC = 'http://localhost:3002/src/main.ts'

const SNIPPETS: Array<{ key: SnippetKey; label: string; hint: string; lang: 'html' | 'tsx' | 'js' }> = [
  { key: 'basic', label: 'Universal', hint: 'Any website', lang: 'html' },
  { key: 'loader', label: 'JS API', hint: 'Intercom-style boot', lang: 'html' },
  { key: 'next', label: 'Next.js', hint: 'app/layout.tsx', lang: 'tsx' },
  { key: 'react', label: 'React SPA', hint: 'Route-aware update', lang: 'tsx' },
  { key: 'gtm', label: 'GTM', hint: 'Custom HTML tag', lang: 'html' },
  { key: 'wordpress', label: 'WordPress', hint: 'Footer/custom code', lang: 'html' },
  { key: 'shopify', label: 'Shopify', hint: 'theme.liquid/app embed', lang: 'html' },
  { key: 'webflow', label: 'Webflow', hint: 'Footer code', lang: 'html' },
  { key: 'identity', label: 'Identity', hint: 'Logged-in users', lang: 'js' },
  { key: 'dev', label: 'Local Dev', hint: 'Vite widget', lang: 'html' },
]

const PLATFORM_SNIPPET_MAP: Partial<Record<PlatformKey, SnippetKey>> = {
  wordpress: 'wordpress',
  shopify: 'shopify',
  webflow: 'webflow',
  wix: 'basic',
  squarespace: 'basic',
  google_tag_manager: 'gtm',
  segment: 'identity',
  nextjs: 'next',
  react: 'react',
  custom: 'basic',
}

const PLATFORM_STEPS: Partial<Record<PlatformKey, string[]>> = {
  wordpress: [
    'WordPress admin mein login karein.',
    'WPCode, Insert Headers and Footers, ya theme footer.php mein Footer/Body End area open karein.',
    'Universal snippet paste karein, save karein, phir cache/CDN purge karein.',
  ],
  shopify: [
    'Online Store > Themes > Edit code open karein.',
    'layout/theme.liquid mein closing body tag se pehle snippet paste karein.',
    'Agar app embed later banayen to isi script ko app embed block mein move kar sakte hain.',
  ],
  webflow: [
    'Project Settings > Custom Code open karein.',
    'Footer Code area mein snippet paste karein.',
    'Save Changes ke baad site publish karein.',
  ],
  wix: [
    'Settings > Custom Code open karein.',
    'Add Custom Code mein snippet paste karein.',
    'Load on all pages aur Body end select karein.',
  ],
  squarespace: [
    'Settings > Advanced > Code Injection open karein.',
    'Footer area mein universal snippet paste karein.',
    'Save karein aur live site verify karein.',
  ],
  google_tag_manager: [
    'GTM container mein New Tag create karein.',
    'Tag Type Custom HTML select karein aur GTM snippet paste karein.',
    'Trigger All Pages lagayen, Preview test karein, phir Publish karein.',
  ],
  nextjs: [
    'app/layout.tsx ya root layout mein next/script import karein.',
    'Script component ko body ke andar children ke baad place karein.',
    'Logged-in user change par Tinfin("update") call karein.',
  ],
  react: [
    'App shell/root component mein loader useEffect add karein.',
    'Route change ya login change par Tinfin("update") call karein.',
    'Logout par Tinfin("shutdown") call karna na bhoolen.',
  ],
  custom: [
    'Universal snippet ko closing body tag se pehle paste karein.',
    'Deploy/publish ke baad verifier run karein.',
    'Console se Tinfin("show") run karke widget open test karein.',
  ],
}

function CodePanel({
  lang,
  code,
  copied,
  onCopy,
}: {
  lang: string
  code: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">{lang}</span>
        <Button variant="ghost" size="icon-sm" onClick={onCopy} className="text-zinc-300 hover:text-white">
          {copied ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
        </Button>
      </div>
      <pre className="max-h-[430px] overflow-auto px-4 py-3 text-xs leading-relaxed text-zinc-100">{code}</pre>
    </div>
  )
}

function CopyButton({ text, id, copiedKey, onCopy }: {
  text: string
  id: string
  copiedKey: string | null
  onCopy: (key: string, value: string) => void
}) {
  return (
    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onCopy(id, text)}>
      {copiedKey === id ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
      {copiedKey === id ? 'Copied' : 'Copy'}
    </Button>
  )
}

function CheckBadge({ status }: { status: 'pass' | 'warn' | 'fail' | string }) {
  if (status === 'pass') return <Badge className="bg-emerald-600 text-white">Pass</Badge>
  if (status === 'warn') return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">Warn</Badge>
  return <Badge variant="destructive">Fail</Badge>
}

function InstallStatusBadge({ status }: { status?: string }) {
  if (status === 'installed') return <Badge className="bg-emerald-600 text-white">Installed</Badge>
  if (status === 'wrong_org') return <Badge variant="destructive">Wrong org</Badge>
  if (status === 'unreachable') return <Badge variant="destructive">Unreachable</Badge>
  return <Badge variant="outline">Not found</Badge>
}

function normalizeConfidence(value: number | undefined) {
  if (!value) return '45%'
  return `${Math.round(value * 100)}%`
}

interface Props {
  orgId: string
}

export function WidgetEmbeddingPage({ orgId }: Props) {
  const [active, setActive] = useState<SnippetKey>('basic')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [siteUrl, setSiteUrl] = useState('')
  const [scanUrl, setScanUrl] = useState<string | null>(null)
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null)

  const detectionQuery = trpc.widgetInstall.detectPlatform.useQuery(
    { url: scanUrl ?? '' },
    { enabled: Boolean(scanUrl), retry: false, staleTime: 30_000 }
  )
  const verifyQuery = trpc.widgetInstall.verifyInstall.useQuery(
    { url: verifyUrl ?? '', orgId },
    { enabled: Boolean(verifyUrl), retry: false, staleTime: 10_000 }
  )

  const snippets = useMemo<Record<SnippetKey, string>>(() => {
    const basic = `<!-- Tinfin Widget -->\n<script\n  src="${SCRIPT_SRC}"\n  data-org-id="${orgId}"\n  async\n></script>`

    const loader = `<script>\n  window.tinfinSettings = {\n    orgId: '${orgId}',\n    companyName: 'Your Company'\n  };\n\n  (function () {\n    var w = window;\n    if (typeof w.Tinfin === 'function') {\n      w.Tinfin('update', w.tinfinSettings);\n      return;\n    }\n\n    var tinfin = function () {\n      tinfin.q.push(Array.prototype.slice.call(arguments));\n    };\n    tinfin.q = [];\n    w.Tinfin = tinfin;\n\n    var script = document.createElement('script');\n    script.async = true;\n    script.src = '${SCRIPT_SRC}';\n    script.setAttribute('data-auto-boot', 'false');\n    document.head.appendChild(script);\n\n    tinfin('boot', w.tinfinSettings);\n  })();\n</script>`

    const next = `// app/layout.tsx\nimport Script from 'next/script'\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script\n          src="${SCRIPT_SRC}"\n          data-org-id="${orgId}"\n          strategy="lazyOnload"\n        />\n      </body>\n    </html>\n  )\n}`

    const react = `// src/TinfinWidget.tsx\nimport { useEffect } from 'react'\n\ndeclare global {\n  interface Window {\n    Tinfin?: (command: string, ...args: unknown[]) => void\n  }\n}\n\nexport function TinfinWidget({ user }: { user?: { id: string; email: string; name: string } }) {\n  useEffect(() => {\n    if (document.getElementById('tinfin-widget-loader')) return\n\n    const script = document.createElement('script')\n    script.id = 'tinfin-widget-loader'\n    script.src = '${SCRIPT_SRC}'\n    script.dataset.orgId = '${orgId}'\n    script.async = true\n    document.body.appendChild(script)\n  }, [])\n\n  useEffect(() => {\n    if (!user || !window.Tinfin) return\n    window.Tinfin('update', {\n      user: { id: user.id, email: user.email, name: user.name },\n      page: { url: window.location.href, title: document.title },\n    })\n  }, [user])\n\n  return null\n}`

    const gtm = `<!-- Google Tag Manager > Custom HTML tag -->\n<script>\n  window.tinfinSettings = { orgId: '${orgId}' };\n  (function () {\n    var t = function () { t.q.push(Array.prototype.slice.call(arguments)); };\n    t.q = [];\n    window.Tinfin = window.Tinfin || t;\n\n    var s = document.createElement('script');\n    s.async = true;\n    s.src = '${SCRIPT_SRC}';\n    s.setAttribute('data-auto-boot', 'false');\n    document.head.appendChild(s);\n\n    window.Tinfin('boot', window.tinfinSettings);\n  })();\n</script>`

    const platformHtml = `${basic}\n\n<!-- Optional visual overrides -->\n<!--\n<script\n  src="${SCRIPT_SRC}"\n  data-org-id="${orgId}"\n  data-color="#2563eb"\n  data-company="Your Company"\n  data-position="bottom-right"\n  async\n></script>\n-->`

    const identity = `// Logged-in user boot/update example\nTinfin('boot', {\n  orgId: '${orgId}',\n  user: {\n    id: 'user_123',\n    email: 'customer@example.com',\n    name: 'Customer Name',\n    // userHash should be generated on your backend if identity verification is enabled later.\n    userHash: 'hmac_sha256_from_backend',\n    traits: { plan: 'pro', signupDate: '2026-05-02' },\n  },\n  company: {\n    id: 'company_123',\n    name: 'Acme Inc',\n    plan: 'business',\n  },\n  customAttributes: { source: 'app_dashboard' },\n})\n\n// On route/user changes\nTinfin('update', {\n  page: { url: window.location.href, title: document.title },\n})\n\n// On logout\nTinfin('shutdown')`

    const dev = `<!-- Local Development -->\n<script\n  type="module"\n  src="${LOCAL_SCRIPT_SRC}"\n  data-org-id="${orgId}"\n></script>`

    return {
      basic,
      loader,
      next,
      react,
      gtm,
      wordpress: platformHtml,
      shopify: platformHtml,
      webflow: platformHtml,
      identity,
      dev,
    }
  }, [orgId])

  const recommendedSnippet = detectionQuery.data?.platform.key
    ? PLATFORM_SNIPPET_MAP[detectionQuery.data.platform.key as PlatformKey] ?? 'basic'
    : 'basic'

  const developerBrief = useMemo(() => {
    return `Install Tinfin widget for org ${orgId}\n\n1. Add this script before </body> on every page.\n\n${snippets.basic}\n\n2. Publish the site.\n3. Open the Tinfin dashboard > Embedding > Verify install.\n4. Test from console:\n   Tinfin('show')\n   Tinfin('openNewMessage', 'I need help')\n   Tinfin('shutdown')`
  }, [orgId, snippets.basic])

  const handleCopy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  const runDetect = () => {
    const clean = siteUrl.trim()
    if (!clean) return
    setScanUrl(clean)
    if (scanUrl === clean) void detectionQuery.refetch()
  }

  const runVerify = () => {
    const clean = siteUrl.trim()
    if (!clean) return
    setVerifyUrl(clean)
    if (verifyUrl === clean) void verifyQuery.refetch()
  }

  const platform = detectionQuery.data?.platform
  const platformSteps = platform?.key ? PLATFORM_STEPS[platform.key as PlatformKey] ?? PLATFORM_STEPS.custom! : PLATFORM_STEPS.custom!

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <Card className="border-border/80 bg-background shadow-none">
        <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <Badge variant="outline" className="gap-1.5 border-foreground/15 bg-muted/40">
              <RocketIcon className="size-3" />
              Installation Studio
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Install Tinfin widget anywhere</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Universal script, JS API boot flow, platform instructions, and live install verification in one place.
              </p>
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
            <div className="text-xs text-muted-foreground">Organization ID</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="max-w-[220px] truncate font-mono text-xs">{orgId}</code>
              <CopyButton text={orgId} id="org-id" copiedKey={copiedKey} onCopy={handleCopy} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="size-4" />
              Smart Installer
            </CardTitle>
            <CardDescription>
              Website URL add karein. System platform detect karega aur install verify bhi karega.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={siteUrl}
                onChange={(event) => setSiteUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runDetect()
                }}
                placeholder="https://example.com"
                className="h-10"
              />
              <Button onClick={runDetect} disabled={!siteUrl.trim() || detectionQuery.isFetching} className="gap-2">
                {detectionQuery.isFetching ? <Loader2Icon className="size-4 animate-spin" /> : <GlobeIcon className="size-4" />}
                Detect
              </Button>
              <Button variant="outline" onClick={runVerify} disabled={!siteUrl.trim() || verifyQuery.isFetching} className="gap-2">
                {verifyQuery.isFetching ? <Loader2Icon className="size-4 animate-spin" /> : <ShieldCheckIcon className="size-4" />}
                Verify
              </Button>
            </div>

            {detectionQuery.error && (
              <Alert variant="destructive">
                <AlertTriangleIcon className="size-4" />
                <AlertDescription>{detectionQuery.error.message}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Detected platform</div>
                <div className="mt-1 text-sm font-medium">{platform?.label ?? 'Not scanned yet'}</div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="mt-1 text-sm font-medium">{normalizeConfidence(platform?.confidence)}</div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Verifier</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                  <InstallStatusBadge status={verifyQuery.data?.status} />
                </div>
              </div>
            </div>

            {platform && (
              <div className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium">Recommended path: {platform.label}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{platform.recommendedMethod}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setActive(recommendedSnippet)}>
                    Open snippet
                  </Button>
                </div>
                <Separator className="my-4" />
                <div className="space-y-2">
                  {platformSteps.map((step, index) => (
                    <div key={step} className="flex gap-2 text-sm">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detectionQuery.data?.signals && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detection signals</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {detectionQuery.data.signals.map((signal) => (
                    <div key={signal.key} className="flex items-start justify-between gap-3 rounded-lg border p-2.5 text-xs">
                      <div>
                        <div className="font-medium">{signal.label}</div>
                        <div className="mt-0.5 text-muted-foreground">{signal.detail}</div>
                      </div>
                      {signal.matched ? <Badge className="bg-emerald-600 text-white">Found</Badge> : <Badge variant="outline">No</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2Icon className="size-4" />
              Production Snippets
            </CardTitle>
            <CardDescription>
              Basic embed se lekar logged-in identity aur SPA commands tak ready snippets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={active} onValueChange={(value) => setActive(value as SnippetKey)}>
              <TabsList variant="line" className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-none p-0">
                {SNIPPETS.map((item) => (
                  <TabsTrigger key={item.key} value={item.key} className="h-8 flex-none px-2.5 text-xs">
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {SNIPPETS.map((item) => (
                <TabsContent key={item.key} value={item.key} className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.hint}</div>
                    </div>
                    <CopyButton
                      text={snippets[item.key]}
                      id={`snippet-${item.key}`}
                      copiedKey={copiedKey}
                      onCopy={handleCopy}
                    />
                  </div>
                  <CodePanel
                    lang={item.lang}
                    code={snippets[item.key]}
                    copied={copiedKey === `snippet-${item.key}`}
                    onCopy={() => handleCopy(`snippet-${item.key}`, snippets[item.key])}
                  />
                </TabsContent>
              ))}
            </Tabs>

            <Alert>
              <SparklesIcon className="size-4" />
              <AlertDescription>
                JS API commands: <code>Tinfin('boot')</code>, <code>Tinfin('update')</code>, <code>Tinfin('show')</code>, <code>Tinfin('hide')</code>, <code>Tinfin('openNewMessage')</code>, and <code>Tinfin('shutdown')</code>.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4" />
              Install Verification
            </CardTitle>
            <CardDescription>
              Publish ke baad yahan se confirm karein ke right org ID ke sath script live hai.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {verifyQuery.data ? (
              <>
                <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium">{verifyQuery.data.finalUrl ?? verifyQuery.data.requestedUrl}</div>
                    <div className="text-xs text-muted-foreground">HTTP {verifyQuery.data.httpStatus ?? 'not reachable'}</div>
                  </div>
                  <InstallStatusBadge status={verifyQuery.data.status} />
                </div>

                <div className="space-y-2">
                  {verifyQuery.data.checks.map((check) => (
                    <div key={check.key} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                      <div>
                        <div className="font-medium">{check.label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{check.detail}</div>
                      </div>
                      <CheckBadge status={check.status} />
                    </div>
                  ))}
                </div>

                {verifyQuery.data.scripts.length > 0 && (
                  <div className="rounded-xl border p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detected Tinfin scripts</div>
                    <div className="mt-2 space-y-2">
                      {verifyQuery.data.scripts.map((script, index) => (
                        <div key={`${script.src ?? 'inline'}-${index}`} className="rounded-lg bg-muted/30 p-2 font-mono text-xs">
                          <div className="truncate">src: {script.src ?? 'inline script'}</div>
                          <div>org: {script.orgId ?? 'not found'} | async: {script.async ? 'yes' : 'no'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <ShieldCheckIcon className="mx-auto size-7 text-muted-foreground" />
                <div className="mt-2 text-sm font-medium">No verification run yet</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Website URL enter karke Verify press karein. GTM unpublished tags source HTML mein visible nahi hotay, is liye GTM Preview bhi test karein.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TerminalSquareIcon className="size-4" />
              QA Console Tests
            </CardTitle>
            <CardDescription>
              Install ke baad browser console mein ye commands run karke runtime API verify karein.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodePanel
              lang="js"
              code={`Tinfin('show')\nTinfin('hide')\nTinfin('openNewMessage', 'I need help with pricing')\nTinfin('update', { user: { id: 'test_1', email: 'test@example.com', name: 'Test User' } })\nTinfin('newChat')\nTinfin('shutdown')\nTinfin('boot', { orgId: '${orgId}' })`}
              copied={copiedKey === 'qa-console'}
              onCopy={() => handleCopy('qa-console', `Tinfin('show')\nTinfin('hide')\nTinfin('openNewMessage', 'I need help with pricing')\nTinfin('update', { user: { id: 'test_1', email: 'test@example.com', name: 'Test User' } })\nTinfin('newChat')\nTinfin('shutdown')\nTinfin('boot', { orgId: '${orgId}' })`)}
            />

            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium">Send to developer</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Non-technical customer ke liye yeh brief developer ko forward kar sakte hain.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={developerBrief} id="developer-brief" copiedKey={copiedKey} onCopy={handleCopy} />
                <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
                  <a href={`mailto:?subject=${encodeURIComponent('Install Tinfin widget')}&body=${encodeURIComponent(developerBrief)}`}>
                    Email brief
                  </a>
                </Button>
              </div>
            </div>

            <Alert>
              <RefreshCwIcon className="size-4" />
              <AlertDescription>
                SPA apps mein logout par <code>Tinfin('shutdown')</code> zaroor call karein, warna previous logged-in user ka widget context browser mein reh sakta hai.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

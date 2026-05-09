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

const SCRIPT_SRC = 'https://cdn.Tinfiz.com/widget.js'
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
    'Log in to your WordPress admin.',
    'Open WPCode, Insert Headers and Footers, or your theme footer.php Footer/Body End area.',
    'Paste the universal snippet, save, then purge cache/CDN.',
  ],
  shopify: [
    'Open Online Store > Themes > Edit code.',
    'Paste the snippet before the closing body tag in layout/theme.liquid.',
    'If you add an app embed later, you can move this script into the app embed block.',
  ],
  webflow: [
    'Open Project Settings > Custom Code.',
    'Paste the snippet in the Footer Code area.',
    'Save changes and publish the site.',
  ],
  wix: [
    'Open Settings > Custom Code.',
    'Paste the snippet in Add Custom Code.',
    'Select Load on all pages and Body end.',
  ],
  squarespace: [
    'Open Settings > Advanced > Code Injection.',
    'Paste the universal snippet in the Footer area.',
    'Save and verify on the live site.',
  ],
  google_tag_manager: [
    'Create a New Tag in your GTM container.',
    'Select Tag Type: Custom HTML and paste the GTM snippet.',
    'Use the All Pages trigger, test in Preview, then Publish.',
  ],
  nextjs: [
    'Import next/script in app/layout.tsx or your root layout.',
    'Place the Script component inside body after children.',
    'Call Tinfiz("update") when logged-in user details change.',
  ],
  react: [
    'Add the loader useEffect in your app shell/root component.',
    'Call Tinfiz("update") on route changes or login state changes.',
    'Do not forget to call Tinfiz("shutdown") on logout.',
  ],
  custom: [
    'Paste the universal snippet before the closing body tag.',
    'Run verification after deploy/publish.',
    'Run Tinfiz("show") in console to test widget open behavior.',
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
    <div className="overflow-hidden rounded-xl border border-border bg-muted/25 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-border bg-background/45 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground dark:text-zinc-400">{lang}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCopy}
          className="text-muted-foreground hover:text-foreground dark:text-zinc-300 dark:hover:text-white"
        >
          {copied ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
        </Button>
      </div>
      <pre className="max-h-[430px] overflow-auto px-4 py-3 text-xs leading-relaxed text-foreground dark:text-zinc-100">{code}</pre>
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

function ProductionSnippetsCard({
  active,
  snippets,
  copiedKey,
  onActiveChange,
  onCopy,
}: {
  active: SnippetKey
  snippets: Record<SnippetKey, string>
  copiedKey: string | null
  onActiveChange: (value: SnippetKey) => void
  onCopy: (key: string, value: string) => void
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2Icon className="size-4" />
          Production Snippets
        </CardTitle>
        <CardDescription>
          Ready snippets for basic embed, logged-in identity, and SPA runtime commands.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={active} onValueChange={(value) => onActiveChange(value as SnippetKey)}>
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
                  onCopy={onCopy}
                />
              </div>
              <CodePanel
                lang={item.lang}
                code={snippets[item.key]}
                copied={copiedKey === `snippet-${item.key}`}
                onCopy={() => onCopy(`snippet-${item.key}`, snippets[item.key])}
              />
            </TabsContent>
          ))}
        </Tabs>

        <Alert>
          <SparklesIcon className="size-4" />
          <AlertDescription>
            JS API commands: <code>Tinfiz('boot')</code>, <code>Tinfiz('update')</code>, <code>Tinfiz('show')</code>, <code>Tinfiz('hide')</code>, <code>Tinfiz('openNewMessage')</code>, and <code>Tinfiz('shutdown')</code>.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
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
    const basic = `<!-- Tinfiz Widget -->\n<script\n  src="${SCRIPT_SRC}"\n  data-org-id="${orgId}"\n  async\n></script>`

    const loader = `<script>\n  window.tinfizSettings = {\n    orgId: '${orgId}',\n    companyName: 'Your Company'\n  };\n\n  (function () {\n    var w = window;\n    if (typeof w.Tinfiz === 'function') {\n      w.Tinfiz('update', w.tinfizSettings);\n      return;\n    }\n\n    var Tinfiz = function () {\n      Tinfiz.q.push(Array.prototype.slice.call(arguments));\n    };\n    Tinfiz.q = [];\n    w.Tinfiz = Tinfiz;\n\n    var script = document.createElement('script');\n    script.async = true;\n    script.src = '${SCRIPT_SRC}';\n    script.setAttribute('data-auto-boot', 'false');\n    document.head.appendChild(script);\n\n    Tinfiz('boot', w.tinfizSettings);\n  })();\n</script>`

    const next = `// app/layout.tsx\nimport Script from 'next/script'\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script\n          src="${SCRIPT_SRC}"\n          data-org-id="${orgId}"\n          strategy="lazyOnload"\n        />\n      </body>\n    </html>\n  )\n}`

    const react = `// src/TinfizWidget.tsx\nimport { useEffect } from 'react'\n\ndeclare global {\n  interface Window {\n    Tinfiz?: (command: string, ...args: unknown[]) => void\n  }\n}\n\nexport function TinfizWidget({ user }: { user?: { id: string; email: string; name: string } }) {\n  useEffect(() => {\n    if (document.getElementById('Tinfiz-widget-loader')) return\n\n    const script = document.createElement('script')\n    script.id = 'Tinfiz-widget-loader'\n    script.src = '${SCRIPT_SRC}'\n    script.dataset.orgId = '${orgId}'\n    script.async = true\n    document.body.appendChild(script)\n  }, [])\n\n  useEffect(() => {\n    if (!user || !window.Tinfiz) return\n    window.Tinfiz('update', {\n      user: { id: user.id, email: user.email, name: user.name },\n      page: { url: window.location.href, title: document.title },\n    })\n  }, [user])\n\n  return null\n}`

    const gtm = `<!-- Google Tag Manager > Custom HTML tag -->\n<script>\n  window.tinfizSettings = { orgId: '${orgId}' };\n  (function () {\n    var t = function () { t.q.push(Array.prototype.slice.call(arguments)); };\n    t.q = [];\n    window.Tinfiz = window.Tinfiz || t;\n\n    var s = document.createElement('script');\n    s.async = true;\n    s.src = '${SCRIPT_SRC}';\n    s.setAttribute('data-auto-boot', 'false');\n    document.head.appendChild(s);\n\n    window.Tinfiz('boot', window.tinfizSettings);\n  })();\n</script>`

    const platformHtml = `${basic}\n\n<!-- Optional visual overrides -->\n<!--\n<script\n  src="${SCRIPT_SRC}"\n  data-org-id="${orgId}"\n  data-color="#2563eb"\n  data-company="Your Company"\n  data-position="bottom-right"\n  async\n></script>\n-->`

    const identity = `// Logged-in user boot/update example\nTinfiz('boot', {\n  orgId: '${orgId}',\n  user: {\n    id: 'user_123',\n    email: 'customer@example.com',\n    name: 'Customer Name',\n    // userHash should be generated on your backend if identity verification is enabled later.\n    userHash: 'hmac_sha256_from_backend',\n    traits: { plan: 'pro', signupDate: '2026-05-02' },\n  },\n  company: {\n    id: 'company_123',\n    name: 'Acme Inc',\n    plan: 'business',\n  },\n  customAttributes: { source: 'app_dashboard' },\n})\n\n// On route/user changes\nTinfiz('update', {\n  page: { url: window.location.href, title: document.title },\n})\n\n// On logout\nTinfiz('shutdown')`

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
    return `Install Tinfiz widget for org ${orgId}\n\n1. Add this script before </body> on every page.\n\n${snippets.basic}\n\n2. Publish the site.\n3. Open the Tinfiz dashboard > Embedding > Verify install.\n4. Test from console:\n   Tinfiz('show')\n   Tinfiz('openNewMessage', 'I need help')\n   Tinfiz('shutdown')`
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
              <h1 className="text-2xl font-semibold tracking-tight">Install Tinfiz widget anywhere</h1>
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

      <ProductionSnippetsCard
        active={active}
        snippets={snippets}
        copiedKey={copiedKey}
        onActiveChange={setActive}
        onCopy={handleCopy}
      />

      <div className="grid grid-cols-1 gap-6">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="size-4" />
              Smart Installer
            </CardTitle>
            <CardDescription>
              Enter your website URL. The system detects the platform and verifies the installation.
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
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4" />
              Install Verification
            </CardTitle>
            <CardDescription>
              After publishing, confirm the script is live with the correct organization ID.
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
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detected Tinfiz scripts</div>
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
                  Enter a website URL and click Verify. Unpublished GTM tags are not visible in source HTML, so also test with GTM Preview mode.
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
              Run these commands in browser console after install to validate runtime API behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodePanel
              lang="js"
              code={`Tinfiz('show')\nTinfiz('hide')\nTinfiz('openNewMessage', 'I need help with pricing')\nTinfiz('update', { user: { id: 'test_1', email: 'test@example.com', name: 'Test User' } })\nTinfiz('newChat')\nTinfiz('shutdown')\nTinfiz('boot', { orgId: '${orgId}' })`}
              copied={copiedKey === 'qa-console'}
              onCopy={() => handleCopy('qa-console', `Tinfiz('show')\nTinfiz('hide')\nTinfiz('openNewMessage', 'I need help with pricing')\nTinfiz('update', { user: { id: 'test_1', email: 'test@example.com', name: 'Test User' } })\nTinfiz('newChat')\nTinfiz('shutdown')\nTinfiz('boot', { orgId: '${orgId}' })`)}
            />

            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium">Send to developer</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Forward this brief to a developer for faster setup when needed.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={developerBrief} id="developer-brief" copiedKey={copiedKey} onCopy={handleCopy} />
                <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
                  <a href={`mailto:?subject=${encodeURIComponent('Install Tinfiz widget')}&body=${encodeURIComponent(developerBrief)}`}>
                    Email brief
                  </a>
                </Button>
              </div>
            </div>

            <Alert>
              <RefreshCwIcon className="size-4" />
              <AlertDescription>
                In SPA apps, always call <code>Tinfiz('shutdown')</code> on logout to prevent previous user context from persisting in browser state.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}



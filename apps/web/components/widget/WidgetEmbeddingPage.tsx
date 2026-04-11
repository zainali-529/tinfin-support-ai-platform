'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { cn } from '@workspace/ui/lib/utils'
import {
  CheckIcon,
  CopyIcon,
  RocketIcon,
  Code2Icon,
  GlobeIcon,
  TerminalSquareIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from 'lucide-react'

type SnippetKey = 'html' | 'next' | 'react' | 'dev'

const SCRIPT_SRC = 'https://cdn.tinfin.com/widget.js'

type SnippetConfig = {
  key: SnippetKey
  label: string
  hint: string
  lang: 'html' | 'tsx'
}

const SNIPPETS: SnippetConfig[] = [
  { key: 'html', label: 'HTML', hint: 'Any website', lang: 'html' },
  { key: 'next', label: 'Next.js', hint: 'Root layout', lang: 'tsx' },
  { key: 'react', label: 'React', hint: 'useEffect loader', lang: 'tsx' },
  { key: 'dev', label: 'Dev', hint: 'Local preview', lang: 'html' },
]

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
        <span className="text-[11px] font-mono uppercase tracking-wide text-zinc-400">{lang}</span>
        <Button variant="ghost" size="icon-sm" onClick={onCopy} className="text-zinc-300 hover:text-white">
          {copied ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
        </Button>
      </div>
      <pre className="max-h-[360px] overflow-auto px-4 py-3 text-xs leading-relaxed text-zinc-200">{code}</pre>
    </div>
  )
}

function TinyCopy({ text, done, onCopy }: { text: string; done: boolean; onCopy: (text: string) => void }) {
  return (
    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onCopy(text)}>
      {done ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
      {done ? 'Copied' : 'Copy'}
    </Button>
  )
}

interface Props {
  orgId: string
}

export function WidgetEmbeddingPage({ orgId }: Props) {
  const [active, setActive] = useState<SnippetKey>('html')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const snippets = useMemo(() => {
    return {
      html: `<!-- Tinfin Widget -->\n<script\n  src="${SCRIPT_SRC}"\n  data-org-id="${orgId}"\n  async\n></script>`,
      next: `// app/layout.tsx\nimport Script from 'next/script'\n\nexport default function RootLayout({ children }) {\n  return (\n    <html>\n      <body>\n        {children}\n        <Script\n          src="${SCRIPT_SRC}"\n          data-org-id="${orgId}"\n          strategy="lazyOnload"\n        />\n      </body>\n    </html>\n  )\n}`,
      react: `// src/App.tsx\nimport { useEffect } from 'react'\n\nexport default function App() {\n  useEffect(() => {\n    const s = document.createElement('script')\n    s.src = '${SCRIPT_SRC}'\n    s.dataset.orgId = '${orgId}'\n    s.async = true\n    document.body.appendChild(s)\n    return () => s.remove()\n  }, [])\n\n  return <div>{/* your app */}</div>\n}`,
      dev: `<!-- Local Development -->\n<script\n  type="module"\n  src="http://localhost:3002/src/main.ts"\n  data-org-id="${orgId}"\n></script>`,
    }
  }, [orgId])

  const advancedExample = useMemo(() => {
    return `<!-- Optional advanced attributes -->\n<script\n  src="${SCRIPT_SRC}"\n  data-org-id="${orgId}"\n  data-color="#2563eb"\n  data-company="Tinfin Support"\n  data-position="bottom-right"\n  async\n></script>`
  }, [orgId])

  const handleCopy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  const activeConfig = SNIPPETS.find((item) => item.key === active) ?? SNIPPETS[0]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <Card className="overflow-hidden border-primary/25 bg-gradient-to-r from-primary/10 via-background to-emerald-500/10">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="gap-1 border-primary/30 bg-white/60 text-primary dark:bg-primary/10">
                <RocketIcon className="size-3" />
                Embedding Studio
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Deploy Your Widget Anywhere</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Copy, paste, and launch your widget in minutes with production-ready snippets.
            </p>
          </div>
          <div className="rounded-xl border bg-background/70 px-4 py-3 text-sm shadow-sm backdrop-blur">
            <div className="text-xs text-muted-foreground">Organization ID</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="max-w-[200px] truncate font-mono text-xs">{orgId}</code>
              <TinyCopy text={orgId} done={copiedKey === 'org-id'} onCopy={(v) => handleCopy('org-id', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Code2Icon className="size-4" />
              Install Snippets
            </CardTitle>
            <CardDescription className="text-xs">
              Pick your stack and copy the exact code snippet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {SNIPPETS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActive(item.key)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left transition-all',
                    active === item.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <div className="text-xs font-semibold">{item.label}</div>
                  <div className="text-[11px] text-muted-foreground">{item.hint}</div>
                </button>
              ))}
            </div>

            <CodePanel
              lang={activeConfig.lang}
              code={snippets[active]}
              copied={copiedKey === `snippet-${active}`}
              onCopy={() => handleCopy(`snippet-${active}`, snippets[active])}
            />

            <Alert>
              <SparklesIcon className="size-4" />
              <AlertDescription className="text-xs">
                Place the script near the closing body tag for fastest page rendering.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheckIcon className="size-4" />
                Launch Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 size-3.5 text-emerald-500" />
                <span>Add one install snippet to your site layout.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 size-3.5 text-emerald-500" />
                <span>Confirm data-org-id matches this workspace.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 size-3.5 text-emerald-500" />
                <span>Publish and open your site in an incognito tab.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 size-3.5 text-emerald-500" />
                <span>Send a test message and verify delivery in Inbox.</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <GlobeIcon className="size-4" />
                Script Attributes
              </CardTitle>
              <CardDescription className="text-xs">Optional controls you can add on the script tag.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="rounded-lg border p-2">
                <div className="font-mono">data-org-id</div>
                <div className="mt-1 text-muted-foreground">Required. Workspace identifier for loading config.</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-mono">data-color</div>
                <div className="mt-1 text-muted-foreground">Optional launcher and accent color override.</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-mono">data-company</div>
                <div className="mt-1 text-muted-foreground">Optional fallback label for company name.</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="font-mono">data-position</div>
                <div className="mt-1 text-muted-foreground">Optional: bottom-right, bottom-left, top-right, top-left.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TerminalSquareIcon className="size-4" />
            Advanced Embed Example
          </CardTitle>
          <CardDescription className="text-xs">Use this if you want custom script attributes from day one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CodePanel
            lang="html"
            code={advancedExample}
            copied={copiedKey === 'advanced'}
            onCopy={() => handleCopy('advanced', advancedExample)}
          />
          <div className="text-xs text-muted-foreground">
            Legacy support is also available with data-organization-id if you are migrating old embeds.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

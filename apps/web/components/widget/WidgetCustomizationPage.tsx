'use client'

import { useState, useEffect, useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { Switch } from '@workspace/ui/components/switch'
import { Badge } from '@workspace/ui/components/badge'
import { Separator } from '@workspace/ui/components/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import {
  PaletteIcon, LayoutIcon, MessageSquareIcon, CodeIcon,
  CheckIcon, CopyIcon, SaveIcon, EyeIcon, ZapIcon,
  GlobeIcon, InfoIcon,
} from 'lucide-react'
import { WidgetPreview } from './WidgetPreview'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WidgetSettings {
  primaryColor: string
  welcomeMessage: string
  companyName: string
  logoUrl: string
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  showBranding: boolean
}

const DEFAULT_SETTINGS: WidgetSettings = {
  primaryColor: '#6366f1',
  welcomeMessage: 'Hi 👋 How can we help you today?',
  companyName: '',
  logoUrl: '',
  position: 'bottom-right',
  showBranding: true,
}

const POSITIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' },
] as const

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#1e293b', '#18181b',
]

// ─── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [hexInput, setHexInput] = useState(value)

  useEffect(() => setHexInput(value), [value])

  const handleHexChange = (v: string) => {
    setHexInput(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
  }

  return (
    <div className="space-y-3">
      {/* Preset swatches */}
      <div className="grid grid-cols-6 gap-1.5">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            className="relative w-full aspect-square rounded-md border-2 transition-all hover:scale-110"
            style={{
              background: c,
              borderColor: value === c ? '#000' : 'transparent',
              outline: value === c ? `2px solid ${c}` : 'none',
              outlineOffset: 2,
            }}
            onClick={() => onChange(c)}
          >
            {value === c && (
              <CheckIcon className="absolute inset-0 m-auto w-3 h-3 text-white drop-shadow" />
            )}
          </button>
        ))}
      </div>

      {/* Custom hex + native picker */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <div
            className="w-9 h-9 rounded-lg border border-border cursor-pointer"
            style={{ background: value }}
          />
        </div>
        <Input
          value={hexInput}
          onChange={e => handleHexChange(e.target.value)}
          placeholder="#6366f1"
          className="h-9 font-mono text-sm flex-1"
        />
      </div>
    </div>
  )
}

// ─── Copy Code Button ──────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="icon-sm" onClick={copy}>
      {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
    </Button>
  )
}

// ─── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = 'html' }: { code: string; lang?: string }) {
  return (
    <div className="relative rounded-lg bg-zinc-950 border border-zinc-800">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wide">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="px-4 py-3 text-xs text-zinc-300 overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  orgId: string
}

export function WidgetCustomizationPage({ orgId }: Props) {
  const [settings, setSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [activeTab, setActiveTab] = useState('appearance')

  const { data: existingConfig, isLoading } = trpc.org.getWidgetConfig.useQuery(
    { orgId },
    { retry: false }
  )
  const updateConfig = trpc.org.updateWidgetConfig.useMutation()

  // Load existing config into form
  useEffect(() => {
    if (existingConfig) {
      setSettings({
        primaryColor: existingConfig.primary_color ?? DEFAULT_SETTINGS.primaryColor,
        welcomeMessage: existingConfig.welcome_message ?? DEFAULT_SETTINGS.welcomeMessage,
        companyName: existingConfig.company_name ?? DEFAULT_SETTINGS.companyName,
        logoUrl: existingConfig.logo_url ?? DEFAULT_SETTINGS.logoUrl,
        position: (existingConfig.position as WidgetSettings['position']) ?? DEFAULT_SETTINGS.position,
        showBranding: existingConfig.show_branding ?? DEFAULT_SETTINGS.showBranding,
      })
      setIsDirty(false)
    }
  }, [existingConfig])

  const update = useCallback((patch: Partial<WidgetSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
    setIsDirty(true)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateConfig.mutateAsync({
        orgId,
        primaryColor: settings.primaryColor,
        welcomeMessage: settings.welcomeMessage,
        companyName: settings.companyName,
        logoUrl: settings.logoUrl,
        position: settings.position,
        showBranding: settings.showBranding,
      })
      setSaved(true)
      setIsDirty(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('[widget save]', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Embed code strings ────────────────────────────────────────────────────

  const prodEmbedCode = `<!-- Tinfin Widget -->
<script
  src="https://cdn.tinfin.com/widget.js"
  data-org-id="${orgId}"
  async
></script>`

  const devEmbedCode = `<!-- Tinfin Widget (Development) -->
<script
  type="module"
  src="http://localhost:3002/src/main.ts"
  data-org-id="${orgId}"
></script>`

  const nextjsCode = `// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://cdn.tinfin.com/widget.js"
          data-org-id="${orgId}"
          strategy="lazyOnload"
        />
      </body>
    </html>
  )
}`

  const reactCode = `// src/App.tsx
import { useEffect } from 'react'

export default function App() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.tinfin.com/widget.js'
    script.dataset.orgId = '${orgId}'
    script.async = true
    document.body.appendChild(script)
    return () => script.remove()
  }, [])

  return <div>{/* your app */}</div>
}`

  const wordpressCode = `// Add to your theme's functions.php
function tinfin_widget() {
  echo '<script
    src="https://cdn.tinfin.com/widget.js"
    data-org-id="${orgId}"
    async
  ></script>';
}
add_action('wp_footer', 'tinfin_widget');`

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ZapIcon className="size-6 text-primary" />
            Widget
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize your chat widget and get the install code.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && !saved && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
              Unsaved changes
            </Badge>
          )}
          {saved && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
              <CheckIcon className="size-3 mr-1" /> Saved
            </Badge>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="gap-1.5"
          >
            <SaveIcon className="size-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex gap-6 items-start">
        {/* Left: Settings */}
        <div className="w-[380px] shrink-0 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3 h-8">
              <TabsTrigger value="appearance" className="text-xs gap-1">
                <PaletteIcon className="size-3" />
                Style
              </TabsTrigger>
              <TabsTrigger value="content" className="text-xs gap-1">
                <MessageSquareIcon className="size-3" />
                Content
              </TabsTrigger>
              <TabsTrigger value="install" className="text-xs gap-1">
                <CodeIcon className="size-3" />
                Install
              </TabsTrigger>
            </TabsList>

            {/* ── Appearance Tab ── */}
            <TabsContent value="appearance" className="mt-4 space-y-4">
              {/* Brand Color */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Brand Color</CardTitle>
                  <CardDescription className="text-xs">
                    Applied to the launcher button, header, and sent messages.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ColorPicker
                    value={settings.primaryColor}
                    onChange={v => update({ primaryColor: v })}
                  />
                </CardContent>
              </Card>

              {/* Position */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Widget Position</CardTitle>
                  <CardDescription className="text-xs">
                    Where the launcher button appears on the page.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {POSITIONS.map(pos => (
                      <button
                        key={pos.value}
                        onClick={() => update({ position: pos.value })}
                        className={`relative h-16 rounded-lg border-2 text-xs font-medium transition-all hover:border-primary/50 ${
                          settings.position === pos.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {/* Dot indicator showing position */}
                        <div className="absolute inset-2">
                          <div
                            className="absolute w-3 h-3 rounded-full"
                            style={{
                              background: settings.position === pos.value ? settings.primaryColor : '#d1d5db',
                              bottom: pos.value.startsWith('bottom') ? 0 : 'auto',
                              top: pos.value.startsWith('top') ? 0 : 'auto',
                              right: pos.value.endsWith('right') ? 0 : 'auto',
                              left: pos.value.endsWith('left') ? 0 : 'auto',
                            }}
                          />
                        </div>
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Branding */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Show "Powered by Tinfin"</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Display the Tinfin branding in the widget footer.</p>
                    </div>
                    <Switch
                      checked={settings.showBranding}
                      onCheckedChange={v => update({ showBranding: v })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Content Tab ── */}
            <TabsContent value="content" className="mt-4 space-y-4">
              {/* Company Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Company Info</CardTitle>
                  <CardDescription className="text-xs">
                    Shown in the widget header.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Company Name</Label>
                    <Input
                      placeholder="Acme Support"
                      value={settings.companyName}
                      onChange={e => update({ companyName: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Logo URL</Label>
                    <Input
                      placeholder="https://example.com/logo.png"
                      value={settings.logoUrl}
                      onChange={e => update({ logoUrl: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Square image recommended. Leave empty to use the default 💬 icon.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Welcome Message */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Welcome Message</CardTitle>
                  <CardDescription className="text-xs">
                    Shown on the pre-chat form before the visitor starts chatting.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={settings.welcomeMessage}
                    onChange={e => update({ welcomeMessage: e.target.value })}
                    placeholder="Hi 👋 How can we help you today?"
                    className="min-h-[80px] text-sm resize-none"
                    maxLength={200}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5 text-right">
                    {settings.welcomeMessage.length}/200
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Install Tab ── */}
            <TabsContent value="install" className="mt-4 space-y-4">
              <Alert>
                <InfoIcon className="size-4" />
                <AlertDescription className="text-xs">
                  Your <strong>Org ID</strong> is already embedded in the snippets below. Just copy and paste.
                </AlertDescription>
              </Alert>

              {/* Org ID display */}
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-medium">Your Organization ID</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono text-foreground truncate">
                        {orgId}
                      </code>
                      <CopyButton text={orgId} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Install code sections */}
              <Tabs defaultValue="html">
                <TabsList className="w-full grid grid-cols-4 h-7">
                  {['html', 'nextjs', 'react', 'wp'].map(f => (
                    <TabsTrigger key={f} value={f} className="text-[10px]">
                      {f === 'wp' ? 'WordPress' : f === 'nextjs' ? 'Next.js' : f === 'html' ? 'HTML' : 'React'}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="html" className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">Add before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag:</p>
                  <CodeBlock code={prodEmbedCode} />
                  <Separator />
                  <p className="text-xs text-muted-foreground">For local development:</p>
                  <CodeBlock code={devEmbedCode} />
                </TabsContent>
                <TabsContent value="nextjs" className="mt-3">
                  <CodeBlock code={nextjsCode} lang="tsx" />
                </TabsContent>
                <TabsContent value="react" className="mt-3">
                  <CodeBlock code={reactCode} lang="tsx" />
                </TabsContent>
                <TabsContent value="wp" className="mt-3">
                  <CodeBlock code={wordpressCode} lang="php" />
                </TabsContent>
              </Tabs>

              {/* Live deployment note */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex gap-3">
                    <GlobeIcon className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Going Live</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Deploy your widget app (<code className="bg-muted px-1 rounded">apps/widget</code>) to Vercel or Cloudflare Pages.
                        Then update the <code className="bg-muted px-1 rounded">src</code> in your embed code to the deployed URL.
                        See the <strong>WIDGET_GUIDE.md</strong> in your repo for step-by-step instructions.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Live Preview */}
        <div className="flex-1 min-w-0 sticky top-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <EyeIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Live Preview</span>
            </div>
            <Badge variant="outline" className="text-[10px]">Updates instantly</Badge>
          </div>
          <WidgetPreview
            config={{
              primaryColor: settings.primaryColor,
              welcomeMessage: settings.welcomeMessage,
              companyName: settings.companyName,
              logoUrl: settings.logoUrl,
              position: settings.position,
              showBranding: settings.showBranding,
            }}
          />
          <p className="text-center text-xs text-muted-foreground mt-2">
            Click the launcher button to toggle the widget panel
          </p>
        </div>
      </div>
    </div>
  )
}
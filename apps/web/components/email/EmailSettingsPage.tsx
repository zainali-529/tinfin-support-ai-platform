'use client'

/**
 * apps/web/components/email/EmailSettingsPage.tsx
 *
 * Full email channel configuration UI.
 * Admin-only page for setting up inbound + outbound email.
 */

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useEmailAccount } from '@/hooks/useEmail'
import { usePlan } from '@/hooks/usePlan'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { Switch } from '@workspace/ui/components/switch'
import { Badge } from '@workspace/ui/components/badge'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Separator } from '@workspace/ui/components/separator'
import { Spinner } from '@workspace/ui/components/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import { cn } from '@workspace/ui/lib/utils'
import {
  MailIcon,
  KeyIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CopyIcon,
  CheckIcon,
  RefreshCwIcon,
  Trash2Icon,
  SaveIcon,
  ZapIcon,
  SendIcon,
  WebhookIcon,
  GlobeIcon,
  PenLineIcon,
  ShieldCheckIcon,
  LockIcon,
} from 'lucide-react'

// ─── Provider selector ────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    value: 'postmark' as const,
    label: 'Postmark',
    description: 'JSON webhook, high deliverability',
    docsUrl: 'https://postmarkapp.com/developer/webhooks/inbound-webhook',
  },
  {
    value: 'mailgun' as const,
    label: 'Mailgun',
    description: 'Form webhook with HMAC signature',
    docsUrl: 'https://documentation.mailgun.com/en/latest/user_manual.html#receiving-messages',
  },
]

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      data-free-allow="true"
      className="gap-1.5 h-7 text-xs shrink-0"
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-emerald-500" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
      {copied ? 'Copied!' : label}
    </Button>
  )
}

// ─── Section row helper ───────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmailSettingsPage() {
  const { account, isLoading, upsertAccount, deleteAccount, regenerateToken, testConnection } =
    useEmailAccount()
  const { canUse } = usePlan()
  const isReadOnly = !canUse('emailChannel')

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  // ── Form state ──────────────────────────────────────────────────────────────
  const [resendKey, setResendKey] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')
  const [provider, setProvider] = useState<'postmark' | 'mailgun'>('postmark')
  const [inboundAddress, setInboundAddress] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [aiAutoReply, setAiAutoReply] = useState(false)
  const [signature, setSignature] = useState('')
  const [savedOk, setSavedOk] = useState(false)
  const [connectedOk, setConnectedOk] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [regenDialogOpen, setRegenDialogOpen] = useState(false)
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false)
  const [syncedAccountVersion, setSyncedAccountVersion] = useState<string | null>(null)

  // Sync form from loaded account
  useEffect(() => {
    if (!account) return

    const version = `${account.id}:${account.updatedAt}`
    if (syncedAccountVersion === version) return

    setFromEmail(account.fromEmail)
    setFromName(account.fromName)
    setProvider((account.inboundProvider as 'postmark' | 'mailgun') ?? 'postmark')
    setInboundAddress(account.inboundAddress ?? '')
    setIsActive(account.isActive)
    setAiAutoReply(account.aiAutoReply)
    setSignature(account.emailSignature ?? '')
    setSyncedAccountVersion(version)
  }, [account, syncedAccountVersion])

  // ── Webhook URL ─────────────────────────────────────────────────────────────
  const webhookToken = account?.inboundWebhookToken
  const webhookUrl = webhookToken
    ? `${apiBaseUrl}/api/email-inbound/${webhookToken}/${provider}`
    : null

  const openUpgradeDialog = useCallback(() => {
    setIsUpgradeDialogOpen(true)
  }, [])

  const handleRestrictedInteractCapture = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!isReadOnly) return

    const target = event.target as HTMLElement | null
    if (!target) return

    const editableTarget = target.closest('input, textarea, select, button, [role="switch"], [role="slider"], [role="button"]')
    if (!editableTarget) return
    if (editableTarget.closest('[data-free-allow="true"]')) return

    event.preventDefault()
    event.stopPropagation()
    openUpgradeDialog()
  }, [isReadOnly, openUpgradeDialog])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (isReadOnly) {
      openUpgradeDialog()
      return
    }

    const payload: Parameters<typeof upsertAccount.mutateAsync>[0] = {
      fromEmail: fromEmail || undefined,
      fromName: fromName || undefined,
      inboundProvider: provider,
      inboundAddress: inboundAddress || null,
      isActive,
      aiAutoReply,
      emailSignature: signature || null,
    }
    if (resendKey.trim()) payload.resendApiKey = resendKey.trim()

    await upsertAccount.mutateAsync(payload)
    setResendKey('')
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 3000)
  }, [
    aiAutoReply,
    fromEmail,
    fromName,
    inboundAddress,
    isActive,
    isReadOnly,
    openUpgradeDialog,
    provider,
    resendKey,
    signature,
    upsertAccount,
  ])

  // ── Test connection ─────────────────────────────────────────────────────────
  const handleTest = useCallback(async () => {
    if (isReadOnly) {
      openUpgradeDialog()
      return
    }

    await testConnection.mutateAsync()
    setConnectedOk(true)
    setTimeout(() => setConnectedOk(false), 5000)
  }, [isReadOnly, openUpgradeDialog, testConnection])

  // ── Regen token ─────────────────────────────────────────────────────────────
  const handleRegenToken = useCallback(async () => {
    if (isReadOnly) {
      setRegenDialogOpen(false)
      openUpgradeDialog()
      return
    }

    await regenerateToken.mutateAsync()
    setRegenDialogOpen(false)
  }, [isReadOnly, openUpgradeDialog, regenerateToken])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  const isConfigured = !!account
  const hasKey = account?.hasResendKey ?? false

  return (
    <div
      className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
      onPointerDownCapture={handleRestrictedInteractCapture}
    >

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MailIcon className="size-6 text-primary" />
            Email Channel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receive and reply to customer emails directly from the inbox.
          </p>
        </div>
        {isReadOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={openUpgradeDialog}
            data-free-allow="true"
            className="gap-1.5"
          >
            <LockIcon className="size-3.5" />
            Unlock Editing
          </Button>
        )}
      </div>

      {isReadOnly && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <LockIcon className="size-4 text-amber-600" />
          <AlertDescription className="flex flex-col gap-2 text-xs text-amber-800 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Preview mode on Free plan: email settings are visible for review, but editing and saving are locked.
            </span>
            <Button size="sm" className="h-7" asChild data-free-allow="true">
              <Link href="/billing">Upgrade to Pro</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Status banner */}
      <div className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        isConfigured && account.isActive
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
          : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
      )}>
        {isConfigured && account.isActive ? (
          <CheckCircleIcon className="size-4 text-emerald-600 shrink-0" />
        ) : (
          <AlertCircleIcon className="size-4 text-amber-600 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium',
            isConfigured && account.isActive
              ? 'text-emerald-800 dark:text-emerald-200'
              : 'text-amber-800 dark:text-amber-200'
          )}>
            {isConfigured && account.isActive
              ? `Email channel active — replies sent from ${account.fromEmail}`
              : isConfigured
              ? 'Email channel configured but currently disabled'
              : 'Email channel not yet configured'}
          </p>
          <p className={cn(
            'text-xs mt-0.5',
            isConfigured && account.isActive
              ? 'text-emerald-700/80 dark:text-emerald-300/80'
              : 'text-amber-700/80 dark:text-amber-300/80'
          )}>
            {isConfigured && account.isActive
              ? 'Inbound emails will appear as conversations in the Inbox.'
              : 'Fill in the settings below and enable the channel to start receiving emails.'}
          </p>
        </div>
        {isConfigured && account.isActive && (
          <Badge variant="outline" className="border-emerald-300 text-emerald-700 shrink-0">
            <CheckCircleIcon className="size-3 mr-1" /> Active
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">

          {/* ── Outbound (Resend) ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <SendIcon className="size-4 text-primary" />
                Outbound — Sending via Resend
              </CardTitle>
              <CardDescription className="text-xs">
                Resend is used to send replies. Your domain must be verified in Resend.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Resend API Key
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="password"
                      placeholder={hasKey ? account!.resendApiKeyMasked! : 're_your_key_here…'}
                      value={resendKey}
                      onChange={(e) => setResendKey(e.target.value)}
                      className="h-8 pl-8 text-sm font-mono"
                    />
                  </div>
                  {hasKey && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testConnection.isPending || connectedOk}
                      onClick={handleTest}
                      className="gap-1.5 h-8 text-xs shrink-0"
                    >
                      {testConnection.isPending ? (
                        <Spinner className="size-3.5" />
                      ) : connectedOk ? (
                        <CheckCircleIcon className="size-3.5 text-emerald-500" />
                      ) : (
                        <ZapIcon className="size-3.5" />
                      )}
                      {connectedOk ? 'Connected!' : testConnection.isPending ? 'Testing…' : 'Test'}
                    </Button>
                  )}
                </div>
                {testConnection.isError && (
                  <p className="text-xs text-destructive">{testConnection.error?.message}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {hasKey ? 'Key stored. Leave blank to keep existing key.' : 'Required to send email replies.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">From Email</Label>
                  <Input
                    type="email"
                    placeholder="support@acme.com"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Must be a Resend verified sender.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">From Name</Label>
                  <Input
                    placeholder="Acme Support"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Inbound ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <GlobeIcon className="size-4 text-primary" />
                Inbound — Receiving Emails
              </CardTitle>
              <CardDescription className="text-xs">
                Configure your email provider to forward incoming emails to the webhook below.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-4">

              {/* Provider selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Inbound Provider</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setProvider(p.value)}
                      className={cn(
                        'flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-all hover:border-primary/40',
                        provider === p.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-muted/20'
                      )}
                    >
                      <span className={cn('text-xs font-semibold', provider === p.value ? 'text-primary' : 'text-foreground')}>
                        {p.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{p.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Inbound address */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Inbound Email Address
                </Label>
                <Input
                  type="email"
                  placeholder={
                    provider === 'postmark'
                      ? 'support@inbound.postmarkapp.com'
                      : 'support@yourdomain.com'
                  }
                  value={inboundAddress}
                  onChange={(e) => setInboundAddress(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  {provider === 'postmark'
                    ? 'Your Postmark inbound email (e.g. xyz@inbound.postmarkapp.com).'
                    : 'Your Mailgun receiving address (the address customers email).'}
                </p>
              </div>

              {/* Webhook URL */}
              {webhookUrl ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <WebhookIcon className="size-3.5" />
                    Webhook URL — paste this in {provider === 'postmark' ? 'Postmark' : 'Mailgun'}
                  </Label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
                      {webhookUrl}
                    </div>
                    <CopyButton value={webhookUrl} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This URL authenticates the webhook via the embedded token. Keep it private.
                  </p>
                </div>
              ) : (
                <Alert>
                  <AlertCircleIcon className="size-4" />
                  <AlertDescription className="text-xs">
                    Save your settings once to generate the webhook URL.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* ── Behavior ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ZapIcon className="size-4 text-primary" />
                Behaviour
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              <SettingRow
                label="Enable Email Channel"
                description="Receive and process inbound emails. Disable to pause without losing config."
              >
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </SettingRow>
              <SettingRow
                label="AI Auto-Reply"
                description="Automatically reply to inbound emails using your knowledge base. Only confident answers are sent — uncertain queries route to agents."
              >
                <Switch checked={aiAutoReply} onCheckedChange={setAiAutoReply} />
              </SettingRow>
            </CardContent>
          </Card>

          {/* ── Signature ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <PenLineIcon className="size-4 text-primary" />
                Email Signature
              </CardTitle>
              <CardDescription className="text-xs">
                Appended to every outbound email reply below a separator line.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <Textarea
                placeholder={`Best regards,\nSupport Team\nAcme Inc.`}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="min-h-[80px] text-sm resize-none font-mono"
                maxLength={1000}
              />
              <p className="text-[11px] text-muted-foreground text-right mt-1">{signature.length}/1000</p>
            </CardContent>
          </Card>

          {/* ── Save button ── */}
          <div className="flex items-center justify-end gap-3 pt-1">
            {upsertAccount.isError && (
              <p className="text-xs text-destructive flex-1">{upsertAccount.error?.message}</p>
            )}
            {savedOk && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircleIcon className="size-3 mr-1" /> Saved
              </Badge>
            )}
            {isReadOnly ? (
              <Button
                size="sm"
                variant="outline"
                onClick={openUpgradeDialog}
                data-free-allow="true"
                className="gap-1.5"
              >
                <LockIcon className="size-3.5" />
                Unlock Editing
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={upsertAccount.isPending}
                onClick={handleSave}
                className="gap-1.5"
              >
                {upsertAccount.isPending ? <Spinner className="size-3.5" /> : <SaveIcon className="size-3.5" />}
                {isConfigured ? 'Save Changes' : 'Create Email Account'}
              </Button>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Security */}
          {isConfigured && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheckIcon className="size-4 text-muted-foreground" />
                  Webhook Security
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Webhook Token</Label>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
                    {account!.inboundWebhookToken?.slice(0, 16)}…
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => {
                    if (isReadOnly) {
                      openUpgradeDialog()
                      return
                    }
                    setRegenDialogOpen(true)
                  }}
                  disabled={regenerateToken.isPending}
                >
                  {regenerateToken.isPending ? <Spinner className="size-3.5" /> : <RefreshCwIcon className="size-3.5" />}
                  Rotate Token
                </Button>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Rotating the token invalidates the old webhook URL. Update your provider immediately after.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Quick setup guide */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Setup</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-xs">
              {[
                { n: 1, text: 'Add your Resend API key and verify your domain in Resend' },
                { n: 2, text: 'Choose inbound provider (Postmark or Mailgun)' },
                { n: 3, text: 'Configure inbound route in your provider, paste the webhook URL' },
                { n: 4, text: 'Enable the channel and send a test email' },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-start gap-2.5">
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0 mt-0.5">
                    {n}
                  </span>
                  <span className="text-muted-foreground">{text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Danger zone */}
          {isConfigured && (
            <Card className="border-destructive/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
                  onClick={() => {
                    if (isReadOnly) {
                      openUpgradeDialog()
                      return
                    }
                    setDeleteDialogOpen(true)
                  }}
                >
                  <Trash2Icon className="size-3.5" />
                  Remove Email Configuration
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Email Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the Resend API key, webhook token, and all email settings. Existing email conversations and messages are preserved. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (isReadOnly) {
                  setDeleteDialogOpen(false)
                  openUpgradeDialog()
                  return
                }
                deleteAccount.mutate()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccount.isPending ? <><Spinner className="mr-1.5 size-3.5" /> Removing…</> : 'Remove Configuration'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate Webhook Token?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new webhook URL. Your current webhook URL will stop working immediately. You must update the webhook URL in Postmark or Mailgun before any new emails will be received.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenToken}>
              {regenerateToken.isPending ? <><Spinner className="mr-1.5 size-3.5" /> Rotating…</> : 'Rotate Token'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upgrade Required for Email Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              You're currently in preview mode on the Free plan. Upgrade to Pro to configure and save email channel settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Maybe Later</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link href="/billing">Upgrade to Pro</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
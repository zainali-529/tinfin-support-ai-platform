'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useWhatsAppAccount } from '@/hooks/useWhatsApp'
import { usePlan } from '@/hooks/usePlan'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Switch } from '@workspace/ui/components/switch'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Spinner } from '@workspace/ui/components/spinner'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CopyIcon,
  LockIcon,
  MessageCircleIcon,
  PlugZapIcon,
  Trash2Icon,
} from 'lucide-react'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      <CopyIcon className="size-3.5" />
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export function WhatsAppSetupPage() {
  const { canUse } = usePlan()
  const isReadOnly = !canUse('whatsappChannel')

  const {
    account,
    isLoading,
    setupAccount,
    updateAccount,
    deleteAccount,
    testConnection,
  } = useWhatsAppAccount()

  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [whatsappBusinessId, setWhatsappBusinessId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [setupMeta, setSetupMeta] = useState<{
    webhookUrl: string
    verifyToken: string
  } | null>(null)

  const webhookUrl = setupMeta?.webhookUrl ?? account?.webhookUrl ?? null
  const verifyToken = setupMeta?.verifyToken ?? account?.verifyToken ?? null

  const handleConnect = async () => {
    if (isReadOnly) return

    const result = await setupAccount.mutateAsync({
      phoneNumberId: phoneNumberId.trim(),
      whatsappBusinessId: whatsappBusinessId.trim(),
      accessToken: accessToken.trim(),
      displayPhoneNumber: displayPhoneNumber.trim(),
      displayName: displayName.trim() || undefined,
    })
    setSetupMeta(result)
    setAccessToken('')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessageCircleIcon className="size-6 text-emerald-500" />
          WhatsApp Channel
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Meta WhatsApp Business account and handle conversations
          in the unified inbox.
        </p>
      </div>

      {isReadOnly && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20">
          <LockIcon className="size-4 text-amber-700 dark:text-amber-300" />
          <AlertDescription className="flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
            <span>
              WhatsApp channel setup is available on Pro and Scale plans.
            </span>
            <Button size="sm" className="h-7" asChild>
              <Link href="/billing">Upgrade</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!account ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect WhatsApp</CardTitle>
            <CardDescription className="text-xs">
              Enter your Meta credentials to activate WhatsApp conversations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
              <Input
                value={phoneNumberId}
                onChange={(event) => setPhoneNumberId(event.target.value)}
                placeholder="e.g. 123456789012345"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                WhatsApp Business Account ID
              </Label>
              <Input
                value={whatsappBusinessId}
                onChange={(event) => setWhatsappBusinessId(event.target.value)}
                placeholder="e.g. 109876543210987"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Access Token</Label>
              <Input
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                placeholder="Permanent Meta token"
                type="password"
                className="h-9 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Display Phone Number
                </Label>
                <Input
                  value={displayPhoneNumber}
                  onChange={(event) => setDisplayPhoneNumber(event.target.value)}
                  placeholder="+923001234567"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Display Name (optional)
                </Label>
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Tinfin Support"
                  className="h-9"
                />
              </div>
            </div>

            {setupAccount.isError && (
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertDescription className="text-xs">
                  {setupAccount.error?.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleConnect}
                disabled={
                  isReadOnly ||
                  setupAccount.isPending ||
                  !phoneNumberId.trim() ||
                  !whatsappBusinessId.trim() ||
                  !accessToken.trim() ||
                  !displayPhoneNumber.trim()
                }
                className="gap-1.5"
              >
                {setupAccount.isPending ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <PlugZapIcon className="size-3.5" />
                )}
                {setupAccount.isPending ? 'Connecting...' : 'Connect WhatsApp'}
              </Button>
            </div>

            {webhookUrl && verifyToken && (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircleIcon className="size-4" />
                  WhatsApp connected
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  Configure these values in Meta dashboard.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border bg-background px-3 py-2 text-[11px]">
                      {webhookUrl}
                    </div>
                    <CopyButton value={webhookUrl} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Verify Token</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border bg-background px-3 py-2 text-[11px] font-mono">
                      {verifyToken}
                    </div>
                    <CopyButton value={verifyToken} />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Subscribe to events: <strong>messages</strong>,{' '}
                  <strong>message_deliveries</strong>, and{' '}
                  <strong>message_reads</strong>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connected Account</CardTitle>
            <CardDescription className="text-xs">
              Manage status, auto replies, and webhook configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">
                  {account.displayPhoneNumber ?? 'Unknown number'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {account.displayName ?? 'No display name'}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  account.isActive
                    ? 'border-emerald-300 text-emerald-700'
                    : 'border-amber-300 text-amber-700'
                }
              >
                {account.isActive ? 'Active' : 'Disabled'}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">AI Auto Reply</p>
                <p className="text-xs text-muted-foreground">
                  Automatically answer inbound WhatsApp messages.
                </p>
              </div>
              <Switch
                checked={account.aiAutoReply}
                onCheckedChange={(checked) => {
                  if (isReadOnly) return
                  updateAccount.mutate({ aiAutoReply: checked })
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending || isReadOnly}
              >
                {testConnection.isPending ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <PlugZapIcon className="size-3.5" />
                )}
                Test Connection
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  updateAccount.mutate({ isActive: !account.isActive })
                }
                disabled={updateAccount.isPending || isReadOnly}
              >
                {account.isActive ? 'Disable Channel' : 'Enable Channel'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={() => deleteAccount.mutate()}
                disabled={deleteAccount.isPending || isReadOnly}
              >
                {deleteAccount.isPending ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Trash2Icon className="size-3.5" />
                )}
                Disconnect
              </Button>
            </div>

            {testConnection.isSuccess && (
              <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20">
                <CheckCircleIcon className="size-4 text-emerald-600 dark:text-emerald-300" />
                <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
                  Connection successful.
                </AlertDescription>
              </Alert>
            )}

            {webhookUrl && verifyToken && (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircleIcon className="size-4" />
                  Webhook Configuration
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  In values ko Meta dashboard mein paste karo.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border bg-background px-3 py-2 text-[11px]">
                      {webhookUrl}
                    </div>
                    <CopyButton value={webhookUrl} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Verify Token</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border bg-background px-3 py-2 text-[11px] font-mono">
                      {verifyToken}
                    </div>
                    <CopyButton value={verifyToken} />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Subscribe events: <strong>messages</strong>,{' '}
                  <strong>message_deliveries</strong>, <strong>message_reads</strong>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Meta Business Setup Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <details className="rounded-lg border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Show setup steps
            </summary>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-muted-foreground">
              <li>Go to developers.facebook.com.</li>
              <li>Create app with Business type.</li>
              <li>Add the WhatsApp product.</li>
              <li>
                In WhatsApp Getting Started, copy Phone Number ID, WABA ID, and
                create a permanent access token.
              </li>
              <li>Paste those values in this setup form and connect.</li>
              <li>Copy webhook URL and verify token from Tinfin.</li>
              <li>
                In Meta WhatsApp Configuration, paste webhook URL + verify token,
                verify, and save.
              </li>
              <li>
                Subscribe to messages, message_deliveries, and message_reads.
              </li>
              <li>Send a test WhatsApp message to confirm.</li>
            </ol>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}

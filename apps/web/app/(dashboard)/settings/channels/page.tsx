'use client'

import Link from 'next/link'
import { useHasOrgPermission } from '@/components/org/OrgContext'
import { useEmailAccount } from '@/hooks/useEmail'
import { useWhatsAppAccount } from '@/hooks/useWhatsApp'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { MailIcon, MessageCircleIcon, LockIcon } from 'lucide-react'

function statusBadge(active: boolean) {
  return (
    <Badge
      variant="outline"
      className={
        active ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700'
      }
    >
      {active ? 'Connected' : 'Not connected'}
    </Badge>
  )
}

export default function ChannelsSettingsPage() {
  const canManageChannels = useHasOrgPermission('channels')
  const { account: emailAccount, isLoading: emailLoading } = useEmailAccount()
  const { account: whatsappAccount, isLoading: whatsappLoading } =
    useWhatsAppAccount()

  if (!canManageChannels) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10">
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <LockIcon className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You do not have permission to manage channel settings.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage all communication channels used by your unified inbox.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MailIcon className="size-4 text-blue-500" />
                Email
              </CardTitle>
              {emailLoading
                ? statusBadge(false)
                : statusBadge(Boolean(emailAccount?.isActive))}
            </div>
            <CardDescription className="text-xs">
              Inbound and outbound support email channel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/email-settings">Manage Email</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircleIcon className="size-4 text-emerald-500" />
                WhatsApp
              </CardTitle>
              {whatsappLoading
                ? statusBadge(false)
                : statusBadge(Boolean(whatsappAccount))}
            </div>
            <CardDescription className="text-xs">
              Meta Cloud API based WhatsApp messaging channel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/channels/whatsapp">Manage WhatsApp</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

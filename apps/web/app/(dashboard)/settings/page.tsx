import Link from 'next/link'
import type { ComponentType } from 'react'
import { redirect } from 'next/navigation'
import {
  ArrowRightIcon,
  Building2Icon,
  CreditCardIcon,
  MailIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  getEffectiveTeamPermissions,
  type TeamPermissionKey,
} from '@workspace/types'

type SettingsCard = {
  title: string
  description: string
  href: string
  icon: ComponentType<{ className?: string }>
  requiresAdmin?: boolean
  requiresPermission?: TeamPermissionKey
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  const message = (error?.message ?? '').toLowerCase()
  return message.includes('column') && message.includes(column.toLowerCase())
}

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('org_id, active_org_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.org_id) redirect('/dashboard')

  const activeOrgId = userRecord.active_org_id ?? userRecord.org_id

  let membership = await supabase
    .from('user_organizations')
    .select('role, permissions')
    .eq('user_id', user.id)
    .eq('org_id', activeOrgId)
    .maybeSingle()

  if (membership.error && isMissingColumnError(membership.error, 'permissions')) {
    membership = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', activeOrgId)
      .maybeSingle()
  }

  if (membership.error || !membership.data) redirect('/dashboard')

  const membershipRow = membership.data as { role?: string | null; permissions?: unknown } | null
  const role = membershipRow?.role === 'admin' ? 'admin' : 'agent'
  const permissions = getEffectiveTeamPermissions(role, membershipRow?.permissions ?? null)

  const cards: SettingsCard[] = [
    {
      title: 'Channels',
      description: 'Configure email and WhatsApp channels connected to your inbox.',
      href: '/settings/channels',
      icon: MailIcon,
      requiresPermission: 'channels',
    },
    {
      title: 'Email Setup',
      description: 'Manage sender identity, SMTP, and reply behavior for support email.',
      href: '/email-settings',
      icon: Settings2Icon,
      requiresPermission: 'channels',
    },
    {
      title: 'Organizations',
      description: 'Switch workspaces and create additional organizations on your account.',
      href: '/organizations',
      icon: Building2Icon,
    },
    {
      title: 'Team Access',
      description: 'Invite members, assign roles, and customize agent module permissions.',
      href: '/team',
      icon: UsersIcon,
      requiresAdmin: true,
    },
    {
      title: 'Billing',
      description: 'Review plan details, invoices, and subscription lifecycle for this org.',
      href: '/billing',
      icon: CreditCardIcon,
      requiresAdmin: true,
    },
    {
      title: 'Usage',
      description: 'Track consumption and limits for conversations, storage, and seats.',
      href: '/usage',
      icon: ZapIcon,
    },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage workspace configuration, channels, team operations, and organization controls.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {role}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Access follows your active organization role and permissions.
            </span>
          </div>
          <ShieldCheckIcon className="size-4 text-muted-foreground" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const lockedByRole = card.requiresAdmin === true && role !== 'admin'
          const lockedByPermission =
            card.requiresPermission && role !== 'admin' && permissions[card.requiresPermission] !== true
          const locked = Boolean(lockedByRole || lockedByPermission)

          return (
            <Card key={card.href}>
              <CardHeader>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <card.icon className="size-4" />
                  </div>
                  {locked ? (
                    <Badge variant="outline" className="text-[10px]">
                      No access
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Available
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription className="text-xs">{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {locked ? (
                  <Button size="sm" variant="outline" disabled>
                    Access restricted
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link href={card.href}>
                      Open
                      <ArrowRightIcon className="size-3.5" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}


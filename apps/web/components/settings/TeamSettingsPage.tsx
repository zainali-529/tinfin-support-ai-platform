'use client'

import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertCircleIcon,
  CheckIcon,
  CopyIcon,
  CrownIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  XCircleIcon,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useActiveOrg } from '@/components/org/OrgContext'
import { cn } from '@workspace/ui/lib/utils'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Spinner } from '@workspace/ui/components/spinner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@workspace/ui/components/card'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@workspace/ui/components/dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  TEAM_PERMISSION_META,
  type TeamPermissionKey,
  type TeamPermissions,
} from '@workspace/types'

type OrgRole = 'admin' | 'agent'

type Member = {
  membershipId: string
  role: OrgRole
  permissions: TeamPermissions
  isOwner: boolean
  joinedAt: string
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  isCurrentUser: boolean
}

type Invitation = {
  id: string
  email: string
  role: OrgRole
  permissions: TeamPermissions
  status: string
  expires_at: string
  created_at: string
}

const EMPTY_PERMISSIONS: TeamPermissions = TEAM_PERMISSION_META.reduce(
  (acc, item) => {
    acc[item.key] = item.defaultAgent
    return acc
  },
  {} as TeamPermissions
)

function countEnabledPermissions(permissions: TeamPermissions): number {
  return TEAM_PERMISSION_META.reduce(
    (count, item) => (permissions[item.key] ? count + 1 : count),
    0
  )
}

function RolePill({ role }: { role: OrgRole }) {
  const isAdmin = role === 'admin'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        isAdmin
          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      )}
    >
      {isAdmin ? <ShieldIcon className="size-2.5" /> : <UserIcon className="size-2.5" />}
      {role}
    </span>
  )
}

function RoleSelector({
  value,
  onChange,
  disabled,
}: {
  value: OrgRole
  onChange: (next: OrgRole) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['agent', 'admin'] as const).map((role) => (
        <button
          key={role}
          type="button"
          disabled={disabled}
          onClick={() => onChange(role)}
          className={cn(
            'rounded-xl border px-3 py-2.5 text-left transition',
            value === role
              ? role === 'admin'
                ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-300 dark:border-violet-600 dark:bg-violet-900/20 dark:ring-violet-700'
                : 'border-blue-400 bg-blue-50 ring-1 ring-blue-300 dark:border-blue-600 dark:bg-blue-900/20 dark:ring-blue-700'
              : 'border-border bg-muted/20',
            'disabled:opacity-60 disabled:cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-1.5">
            {role === 'admin' ? (
              <ShieldIcon className="size-3.5 text-violet-600 dark:text-violet-400" />
            ) : (
              <UserIcon className="size-3.5 text-blue-600 dark:text-blue-400" />
            )}
            <span className="text-xs font-semibold capitalize">{role}</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {role === 'admin'
              ? 'Full access to all modules'
              : 'Customizable module permissions'}
          </p>
        </button>
      ))}
    </div>
  )
}

function PermissionEditor({
  value,
  onChange,
  disabled,
}: {
  value: TeamPermissions
  onChange: (next: TeamPermissions) => void
  disabled?: boolean
}) {
  function togglePermission(key: TeamPermissionKey, checked: boolean) {
    onChange({
      ...value,
      [key]: checked,
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Module permissions</Label>
        <span className="text-[11px] text-muted-foreground">
          {countEnabledPermissions(value)} enabled
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {TEAM_PERMISSION_META.map((permission) => (
          <label
            key={permission.key}
            className={cn(
              'flex items-start gap-2 rounded-lg border p-2.5',
              disabled && 'opacity-60'
            )}
          >
            <Checkbox
              checked={value[permission.key]}
              onCheckedChange={(next) => togglePermission(permission.key, Boolean(next))}
              disabled={disabled}
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block text-xs font-semibold">{permission.label}</span>
              <span className="block text-[11px] text-muted-foreground">{permission.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

function PermissionSummary({ permissions }: { permissions: TeamPermissions }) {
  const enabled = TEAM_PERMISSION_META.filter((item) => permissions[item.key])
  if (enabled.length === TEAM_PERMISSION_META.length) {
    return (
      <Badge variant="outline" className="text-[10px]">
        Full access
      </Badge>
    )
  }
  if (enabled.length === 0) {
    return (
      <Badge variant="outline" className="text-[10px]">
        No modules
      </Badge>
    )
  }

  const primary = enabled.slice(0, 2)
  const extraCount = enabled.length - primary.length

  return (
    <div className="flex flex-wrap gap-1">
      {primary.map((entry) => (
        <Badge key={entry.key} variant="outline" className="text-[10px]">
          {entry.label}
        </Badge>
      ))}
      {extraCount > 0 && (
        <Badge variant="outline" className="text-[10px]">
          +{extraCount} more
        </Badge>
      )}
    </div>
  )
}

function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const utils = trpc.useUtils()

  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<OrgRole>('agent')
  const [permissions, setPermissions] = React.useState<TeamPermissions>(EMPTY_PERMISSIONS)
  const [inviteLink, setInviteLink] = React.useState<string | null>(null)
  const [errorMsg, setErrorMsg] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  const inviteMutation = trpc.team.inviteMember.useMutation({
    onSuccess: (data) => {
      setInviteLink(data.inviteLink)
      void utils.team.getPendingInvitations.invalidate()
    },
    onError: (error) => {
      setErrorMsg(error.message)
    },
  })

  function resetState() {
    setEmail('')
    setRole('agent')
    setPermissions(EMPTY_PERMISSIONS)
    setInviteLink(null)
    setErrorMsg('')
    setCopied(false)
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  function submitInvite(event: React.FormEvent) {
    event.preventDefault()
    setErrorMsg('')
    inviteMutation.mutate({
      email: email.trim().toLowerCase(),
      role,
      permissions: role === 'agent' ? permissions : undefined,
    })
  }

  async function copyInviteLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Choose role and module permissions before generating an invite link.
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <form onSubmit={submitInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="agent@company.com"
                required
                disabled={inviteMutation.isPending}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <RoleSelector value={role} onChange={setRole} disabled={inviteMutation.isPending} />
            </div>

            {role === 'agent' ? (
              <PermissionEditor
                value={permissions}
                onChange={setPermissions}
                disabled={inviteMutation.isPending}
              />
            ) : (
              <Alert>
                <AlertCircleIcon className="size-4" />
                <AlertDescription className="text-xs">
                  Admin invites always receive full module access.
                </AlertDescription>
              </Alert>
            )}

            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={inviteMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending || !email.trim()}>
                {inviteMutation.isPending && <Spinner className="mr-1.5 size-3.5" />}
                {inviteMutation.isPending ? 'Creating...' : 'Create Invite'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription className="text-xs">
                Invite link generated. Share it with <strong>{email}</strong>. It expires in 7 days.
              </AlertDescription>
            </Alert>
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs break-all font-mono">
              {inviteLink}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={copyInviteLink} className="gap-1.5">
                {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MemberRow({
  member,
  onRoleChange,
  onEditPermissions,
  onRemove,
}: {
  member: Member
  onRoleChange: (userId: string, role: OrgRole) => void
  onEditPermissions: (member: Member) => void
  onRemove: (member: Member) => void
}) {
  const displayName = member.name || member.email
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-3 py-3.5">
      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold truncate">{displayName}</span>
          {member.isOwner && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <CrownIcon className="size-2.5" />
              Owner
            </span>
          )}
          {member.isCurrentUser && (
            <Badge variant="outline" className="text-[10px]">
              You
            </Badge>
          )}
        </div>

        {member.name && <p className="text-xs text-muted-foreground truncate">{member.email}</p>}
        <p className="text-[11px] text-muted-foreground">
          Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
        </p>
        {member.role === 'agent' && <PermissionSummary permissions={member.permissions} />}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <RolePill role={member.role} />

        {!member.isOwner && !member.isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {member.role === 'agent' ? (
                <DropdownMenuItem className="gap-2" onClick={() => onRoleChange(member.id, 'admin')}>
                  <ShieldIcon className="size-3.5" />
                  Promote to admin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="gap-2" onClick={() => onRoleChange(member.id, 'agent')}>
                  <UserIcon className="size-3.5" />
                  Demote to agent
                </DropdownMenuItem>
              )}
              {member.role === 'agent' && (
                <DropdownMenuItem className="gap-2" onClick={() => onEditPermissions(member)}>
                  <UsersIcon className="size-3.5" />
                  Edit permissions
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="gap-2" onClick={() => onRemove(member)}>
                <Trash2Icon className="size-3.5" />
                Remove member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

function InvitationRow({
  invitation,
  onCancel,
}: {
  invitation: Invitation
  onCancel: (id: string) => void
}) {
  const [copied, setCopied] = React.useState(false)
  const [cachedLink, setCachedLink] = React.useState<string | null>(null)
  const isExpired = new Date(invitation.expires_at) < new Date()
  const utils = trpc.useUtils()

  const getLinkQuery = trpc.team.getInviteLink.useQuery(
    { invitationId: invitation.id },
    { enabled: false }
  )

  const resendInvitation = trpc.team.resendInvitation.useMutation({
    onSuccess: (data) => {
      setCachedLink(data.inviteLink)
      void utils.team.getPendingInvitations.invalidate()
    },
  })

  async function copyLink() {
    let link = cachedLink
    if (!link) {
      const result = await getLinkQuery.refetch()
      link = result.data?.inviteLink ?? null
      if (link) setCachedLink(link)
    }
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted/60 text-sm font-semibold text-muted-foreground">
        {invitation.email.slice(0, 2).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium truncate">{invitation.email}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <RolePill role={invitation.role} />
          {invitation.role === 'agent' && (
            <Badge variant="outline" className="text-[10px]">
              {countEnabledPermissions(invitation.permissions)} modules
            </Badge>
          )}
          <span className={cn('text-[11px]', isExpired ? 'text-red-500' : 'text-muted-foreground')}>
            {isExpired
              ? 'Expired'
              : `Expires ${formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}`}
          </span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={copyLink} disabled={getLinkQuery.isFetching} className="gap-2">
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => resendInvitation.mutate({ invitationId: invitation.id })}
            disabled={resendInvitation.isPending}
          >
            {resendInvitation.isPending ? <Spinner className="size-3.5" /> : <LinkIcon className="size-3.5" />}
            Resend
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="gap-2" onClick={() => onCancel(invitation.id)}>
            <XCircleIcon className="size-3.5" />
            Cancel invite
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function TeamSettingsPage() {
  const activeOrg = useActiveOrg()
  const utils = trpc.useUtils()

  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false)
  const [removeTarget, setRemoveTarget] = React.useState<Member | null>(null)
  const [permissionsTarget, setPermissionsTarget] = React.useState<Member | null>(null)
  const [permissionsDraft, setPermissionsDraft] = React.useState<TeamPermissions>(EMPTY_PERMISSIONS)
  const [errorMsg, setErrorMsg] = React.useState('')

  const { data: members = [], isLoading: membersLoading } = trpc.team.getMembers.useQuery(undefined, {
    staleTime: 30_000,
  })
  const { data: invitations = [], isLoading: invitesLoading } = trpc.team.getPendingInvitations.useQuery(undefined, {
    staleTime: 30_000,
  })

  const updateRole = trpc.team.updateMemberRole.useMutation({
    onSuccess: () => {
      void utils.team.getMembers.invalidate()
    },
    onError: (error) => setErrorMsg(error.message),
  })

  const updatePermissions = trpc.team.updateMemberPermissions.useMutation({
    onSuccess: () => {
      void utils.team.getMembers.invalidate()
      setPermissionsTarget(null)
    },
    onError: (error) => setErrorMsg(error.message),
  })

  const removeMember = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      void utils.team.getMembers.invalidate()
      setRemoveTarget(null)
    },
    onError: (error) => setErrorMsg(error.message),
  })

  const cancelInvite = trpc.team.cancelInvitation.useMutation({
    onSuccess: () => {
      void utils.team.getPendingInvitations.invalidate()
    },
    onError: (error) => setErrorMsg(error.message),
  })

  const adminCount = members.filter((member) => member.role === 'admin').length

  function openPermissionsDialog(member: Member) {
    setPermissionsTarget(member)
    setPermissionsDraft(member.permissions ?? EMPTY_PERMISSIONS)
  }

  function savePermissions() {
    if (!permissionsTarget) return
    setErrorMsg('')
    updatePermissions.mutate({
      userId: permissionsTarget.id,
      permissions: permissionsDraft,
    })
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UsersIcon className="size-6 text-primary" />
            Team
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage members and invitations for <strong>{activeOrg.name}</strong>.
          </p>
        </div>
        <Button size="sm" onClick={() => setInviteDialogOpen(true)} className="gap-1.5">
          <PlusIcon className="size-3.5" />
          Invite member
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{errorMsg}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Members
                    {!membersLoading && (
                      <Badge variant="outline" className="text-[10px]">
                        {members.length} total | {adminCount} admin{adminCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Roles plus module-level access per organization.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => void utils.team.getMembers.invalidate()}>
                  <RefreshCwIcon className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0">
              {membersLoading ? (
                <div className="space-y-2 py-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2.5">
                      <Skeleton className="size-10 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-52" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No members found.</div>
              ) : (
                <div className="divide-y">
                  {members.map((member) => (
                    <MemberRow
                      key={member.membershipId}
                      member={member}
                      onRoleChange={(userId, role) => {
                        setErrorMsg('')
                        updateRole.mutate({ userId, role })
                      }}
                      onEditPermissions={openPermissionsDialog}
                      onRemove={setRemoveTarget}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(invitesLoading || invitations.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pending invitations</CardTitle>
                <CardDescription className="text-xs">
                  Invite links waiting to be accepted.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-0">
                {invitesLoading ? (
                  <div className="space-y-2 py-3">
                    {Array.from({ length: 2 }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2.5">
                        <Skeleton className="size-10 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-40" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y">
                    {(invitations as Invitation[]).map((invitation) => (
                      <InvitationRow
                        key={invitation.id}
                        invitation={invitation}
                        onCancel={(id) => cancelInvite.mutate({ invitationId: id })}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Permission model</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Admins always have full access in this organization. Agent access is module-based and can be edited at any time.
              </p>
              <div className="space-y-2">
                {TEAM_PERMISSION_META.map((permission) => (
                  <div key={permission.key} className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {permission.label}
                    </Badge>
                    <p className="text-[11px] text-muted-foreground">{permission.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick actions</CardTitle>
              <CardDescription className="text-xs">
                Invite teammates and set module access in one flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button size="sm" className="w-full gap-1.5" onClick={() => setInviteDialogOpen(true)}>
                <PlusIcon className="size-3.5" />
                Invite member
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <InviteDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />

      <Dialog open={Boolean(permissionsTarget)} onOpenChange={(open) => !open && setPermissionsTarget(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit agent permissions</DialogTitle>
            <DialogDescription>
              Update module access for {permissionsTarget?.name || permissionsTarget?.email}.
            </DialogDescription>
          </DialogHeader>
          <PermissionEditor
            value={permissionsDraft}
            onChange={setPermissionsDraft}
            disabled={updatePermissions.isPending}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsTarget(null)} disabled={updatePermissions.isPending}>
              Cancel
            </Button>
            <Button onClick={savePermissions} disabled={updatePermissions.isPending}>
              {updatePermissions.isPending && <Spinner className="mr-1.5 size-3.5" />}
              Save permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name || removeTarget?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access to <strong>{activeOrg.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeTarget && removeMember.mutate({ userId: removeTarget.id })}
            >
              {removeMember.isPending ? <Spinner className="mr-1.5 size-3.5" /> : null}
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

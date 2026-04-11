'use client'

import { useState, useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import { useActiveOrg } from '@/components/org/OrgContext'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Separator } from '@workspace/ui/components/separator'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@workspace/ui/components/dialog'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'
import {
  UsersIcon, PlusIcon, MoreHorizontalIcon, ShieldIcon, UserIcon,
  CopyIcon, CheckIcon, Trash2Icon, XCircleIcon, RefreshCwIcon,
  MailIcon, ClockIcon, OctagonXIcon, AlertCircleIcon, LinkIcon,
  CheckCircleIcon, CrownIcon,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Member = {
  membershipId: string
  role: 'admin' | 'agent'
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
  role: 'admin' | 'agent'
  status: string
  expires_at: string
  created_at: string
}

// ─── Role Selector ────────────────────────────────────────────────────────────

function RoleSelector({
  value,
  onChange,
  disabled,
}: {
  value: 'admin' | 'agent'
  onChange: (v: 'admin' | 'agent') => void
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
            'flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-all duration-100',
            'hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed',
            value === role
              ? role === 'admin'
                ? 'border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-900/20 ring-1 ring-violet-300 dark:ring-violet-700'
                : 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700'
              : 'border-border bg-muted/20'
          )}
        >
          <div className="flex items-center gap-1.5">
            {role === 'admin'
              ? <ShieldIcon className={cn('size-3.5', value === role ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground')} />
              : <UserIcon className={cn('size-3.5', value === role ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground')} />
            }
            <span className={cn(
              'text-xs font-semibold capitalize',
              value === role
                ? role === 'admin' ? 'text-violet-700 dark:text-violet-300' : 'text-blue-700 dark:text-blue-300'
                : 'text-foreground'
            )}>
              {role}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {role === 'admin' ? 'Full access + settings' : 'Inbox, calls & KB'}
          </p>
        </button>
      ))}
    </div>
  )
}

// ─── Invite Dialog ────────────────────────────────────────────────────────────

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'agent'>('agent')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const inviteMutation = trpc.team.inviteMember.useMutation({
    onSuccess: (data) => {
      setInviteLink(data.inviteLink)
      void utils.team.getPendingInvitations.invalidate()
    },
    onError: (err) => setError(err.message),
  })

  function handleClose() {
    setEmail('')
    setRole('agent')
    setInviteLink(null)
    setCopied(false)
    setError('')
    onOpenChange(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    inviteMutation.mutate({ email: email.trim().toLowerCase(), role })
  }

  function handleCopy() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Invite Team Member</DialogTitle>
          <DialogDescription className="text-sm">
            Generate an invite link to add someone to your organization.
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-sm font-medium">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={inviteMutation.isPending}
                autoFocus
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Role</Label>
              <RoleSelector value={role} onChange={setRole} disabled={inviteMutation.isPending} />
            </div>

            {error && (
              <Alert variant="destructive">
                <OctagonXIcon className="size-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={inviteMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={inviteMutation.isPending || !email.trim()}>
                {inviteMutation.isPending && <Spinner className="mr-1.5 size-3.5" />}
                {inviteMutation.isPending ? 'Creating…' : 'Create Invite Link'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 p-3.5 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="size-4 text-emerald-600 shrink-0" />
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Invite link created!</p>
              </div>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 pl-6">
                Share with <strong>{email}</strong> · expires in 7 days
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Invite Link</Label>
              {/* Fixed: wrap-anywhere prevents overflow */}
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs font-mono text-muted-foreground break-all leading-relaxed">
                {inviteLink}
              </div>
              <Button size="sm" variant="outline" onClick={handleCopy} className="w-full gap-1.5">
                {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                {copied ? 'Copied to clipboard!' : 'Copy Link'}
              </Button>
            </div>

            <Alert>
              <AlertCircleIcon className="size-4" />
              <AlertDescription className="text-xs">
                Share this link via email, Slack, or any messaging app. Anyone with this link can join.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  onRoleChange,
  onRemove,
}: {
  member: Member
  onRoleChange: (userId: string, role: 'admin' | 'agent') => void
  onRemove: (userId: string, name: string) => void
}) {
  const initials = (member.name || member.email).slice(0, 2).toUpperCase()
  const displayName = member.name || member.email

  return (
    <div className="flex items-center gap-3 py-3.5">
      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{displayName}</span>
          {member.isOwner && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <CrownIcon className="size-2.5" /> Owner
            </span>
          )}
          {member.isCurrentUser && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              You
            </span>
          )}
        </div>
        {member.name && (
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        )}
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
          Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          member.role === 'admin'
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        )}>
          {member.role === 'admin' ? <ShieldIcon className="size-2.5" /> : <UserIcon className="size-2.5" />}
          {member.role}
        </span>

        {/* No actions for owner or self */}
        {!member.isOwner && !member.isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {member.role === 'agent' ? (
                <DropdownMenuItem className="gap-2" onClick={() => onRoleChange(member.id, 'admin')}>
                  <ShieldIcon className="size-3.5" /> Promote to Admin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="gap-2" onClick={() => onRoleChange(member.id, 'agent')}>
                  <UserIcon className="size-3.5" /> Demote to Agent
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="gap-2" onClick={() => onRemove(member.id, displayName)}>
                <Trash2Icon className="size-3.5" /> Remove Member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

// ─── Invitation Row ───────────────────────────────────────────────────────────

export function InvitationRow({
  invite,
  onCancel,
}: {
  invite: Invitation
  onCancel: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [fetchedLink, setFetchedLink] = useState<string | null>(null)
  const isExpired = new Date(invite.expires_at) < new Date()
 
  // Lazy-fetch the link when user opens the dropdown
  const getLinkQuery = trpc.team.getInviteLink.useQuery(
    { invitationId: invite.id },
    { enabled: false } // only fetch on demand
  )
 
  async function handleCopyLink() {
    let link = fetchedLink
 
    if (!link) {
      // Fetch link on demand if not yet loaded
      const result = await getLinkQuery.refetch()
      link = result.data?.inviteLink ?? null
      if (link) setFetchedLink(link)
    }
 
    if (link) {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }
 
  const resendMutation = trpc.team.resendInvitation.useMutation({
    onSuccess: (data) => {
      setFetchedLink(data.inviteLink)
    },
  })
 
  const utils = trpc.useUtils()
 
  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <span className="text-muted-foreground text-sm font-medium">
          {invite.email.slice(0, 2).toUpperCase()}
        </span>
      </div>
 
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{invite.email}</p>
        <span className={cn(
          'inline-flex items-center gap-1 text-[11px] mt-0.5',
          isExpired ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'
        )}>
          <ClockIcon className="size-3" />
          {isExpired ? 'Expired' : `Expires ${formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}`}
        </span>
      </div>
 
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn(
          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
          invite.role === 'admin'
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        )}>
          {invite.role}
        </span>
 
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Copy Link — fetches on demand */}
            <DropdownMenuItem
              className="gap-2"
              disabled={getLinkQuery.isFetching}
              onClick={handleCopyLink}
            >
              {getLinkQuery.isFetching ? (
                <Spinner className="size-3.5" />
              ) : copied ? (
                <CheckIcon className="size-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </DropdownMenuItem>
 
            {/* Resend — generates new token */}
            <DropdownMenuItem
              className="gap-2"
              disabled={resendMutation.isPending}
              onClick={() => {
                resendMutation.mutate({ invitationId: invite.id })
                void utils.team.getPendingInvitations.invalidate()
              }}
            >
              {resendMutation.isPending ? <Spinner className="size-3.5" /> : <LinkIcon className="size-3.5" />}
              Resend (new link)
            </DropdownMenuItem>
 
            <DropdownMenuSeparator />
 
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onClick={() => onCancel(invite.id)}
            >
              <XCircleIcon className="size-3.5" />
              Cancel Invite
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
 

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TeamSettingsPage() {
  const activeOrg = useActiveOrg()
  const utils = trpc.useUtils()

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const { data: members = [], isLoading: membersLoading } = trpc.team.getMembers.useQuery(undefined, { staleTime: 30_000 })
  const { data: invitations = [], isLoading: invitesLoading } = trpc.team.getPendingInvitations.useQuery(undefined, { staleTime: 30_000 })

  const updateRole = trpc.team.updateMemberRole.useMutation({
    onSuccess: () => utils.team.getMembers.invalidate(),
    onError: (err) => setErrorMsg(err.message),
  })

  const removeMember = trpc.team.removeMember.useMutation({
    onSuccess: () => { void utils.team.getMembers.invalidate(); setRemoveTarget(null) },
    onError: (err) => setErrorMsg(err.message),
  })

  const cancelInvite = trpc.team.cancelInvitation.useMutation({
    onSuccess: () => utils.team.getPendingInvitations.invalidate(),
    onError: (err) => setErrorMsg(err.message),
  })

  const adminCount = members.filter((m) => m.role === 'admin').length

  return (
    // Full-width layout — no max-w constraint so it fills the page
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">

      {/* Header */}
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
        <Button size="sm" onClick={() => setInviteDialogOpen(true)} className="gap-1.5 shrink-0">
          <PlusIcon className="size-3.5" />
          Invite Member
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <OctagonXIcon className="size-4" />
          <AlertDescription className="text-sm">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Two-column grid for larger screens */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Members — spans 2 cols on xl */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Members
                    {!membersLoading && (
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {members.length} total · {adminCount} admin{adminCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Active members with access to this workspace.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => utils.team.getMembers.invalidate()}>
                  <RefreshCwIcon className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0">
              {membersLoading ? (
                <div className="space-y-1 py-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <Skeleton className="size-10 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-48" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No members found.</div>
              ) : (
                <div className="divide-y">
                  {members.map((member) => (
                    <MemberRow
                      key={member.membershipId}
                      member={member}
                      onRoleChange={(userId, role) => { setErrorMsg(''); updateRole.mutate({ userId, role }) }}
                      onRemove={(userId, name) => { setErrorMsg(''); setRemoveTarget({ userId, name }) }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {(invitesLoading || invitations.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Pending Invitations
                  {!invitesLoading && invitations.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">{invitations.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">Links that haven't been accepted yet.</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-0">
                {invitesLoading ? (
                  <div className="space-y-1 py-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="flex items-center gap-3 py-3">
                        <Skeleton className="size-10 rounded-full shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-48" /><Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y">
                    {invitations.map((invite) => (
                      <InvitationRow
                        key={invite.id}
                        invite={invite}
                        onCancel={(id) => cancelInvite.mutate({ invitationId: id })}
                        // onResend={(id) => trpc.team.resendInvitation.useMutation}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — role reference + quick invite */}
        <div className="space-y-4">
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Role Permissions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                    <ShieldIcon className="size-3.5 text-violet-600" />
                  </div>
                  <p className="text-xs font-semibold">Admin</p>
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-8">
                  <li>✓ Inbox, calls, knowledge base</li>
                  <li>✓ Widget & voice settings</li>
                  <li>✓ Team management</li>
                  <li>✓ Organization settings</li>
                </ul>
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
                    <UserIcon className="size-3.5 text-blue-600" />
                  </div>
                  <p className="text-xs font-semibold">Agent</p>
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-8">
                  <li>✓ Inbox, calls, knowledge base</li>
                  <li>✗ Widget & voice settings</li>
                  <li>✗ Team management</li>
                  <li>✗ Organization settings</li>
                </ul>
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
                    <CrownIcon className="size-3.5 text-amber-600" />
                  </div>
                  <p className="text-xs font-semibold">Owner</p>
                </div>
                <p className="text-[11px] text-muted-foreground pl-8">
                  Organization creator. Cannot be demoted or removed by anyone.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Invite</CardTitle>
              <CardDescription className="text-xs">Add a team member right now.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button size="sm" className="w-full gap-1.5" onClick={() => setInviteDialogOpen(true)}>
                <PlusIcon className="size-3.5" />
                Invite Member
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <InviteDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke their access to <strong>{activeOrg.name}</strong>. They can be re-invited later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (removeTarget) removeMember.mutate({ userId: removeTarget.userId }) }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMember.isPending ? <><Spinner className="mr-1.5 size-3.5" /> Removing…</> : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
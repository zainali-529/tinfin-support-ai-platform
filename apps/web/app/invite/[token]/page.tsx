/**
 * apps/web/app/invite/[token]/page.tsx  (Updated)
 * Now passes loggedInEmail to AcceptInviteClient for client-side mismatch warning.
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AcceptInviteClient } from './AcceptInviteClient'
import { cn } from '@workspace/ui/lib/utils'
import { DecorIcon } from '@workspace/ui/components/decor-icon'
import Link from 'next/link'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(token)) return <InviteError message="Invalid invite link." />

  const { data: invite } = await supabaseAdmin
    .from('org_invitations')
    .select('id, email, role, status, expires_at, organizations (id, name), users!org_invitations_invited_by_fkey (id, name, email)')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return <InviteError message="This invite link is invalid or has already been used." />
  if (invite.status === 'accepted') return <InviteError message="This invitation has already been accepted." />
  if (invite.status === 'cancelled') return <InviteError message="This invitation has been cancelled." />
  if (invite.status === 'expired' || new Date(invite.expires_at as string) < new Date()) {
    return <InviteError message="This invitation has expired. Please ask for a new invite." />
  }

  const org = (Array.isArray(invite.organizations) ? invite.organizations[0] : invite.organizations) as { id: string; name: string } | null
  const inviter = (Array.isArray(invite.users) ? invite.users[0] : invite.users) as { id: string; name: string | null; email: string } | null
  if (!org) return <InviteError message="Organization not found." />

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <InviteLayout>
      <AcceptInviteClient
        token={token}
        orgName={org.name}
        orgId={org.id}
        role={invite.role as 'admin' | 'agent'}
        inviterName={inviter?.name || inviter?.email || 'A team member'}
        email={invite.email as string}
        expiresAt={invite.expires_at as string}
        isLoggedIn={!!user}
        loggedInEmail={user?.email ?? null}  // ← pass logged-in email for mismatch check
      />
    </InviteLayout>
  )
}

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden px-6 md:px-8">
      <div className={cn('relative flex w-full max-w-sm flex-col justify-between p-8', 'dark:bg-[radial-gradient(50%_80%_at_20%_0%,--theme(--color-foreground/.1),transparent)]')}>
        <div className="absolute -inset-y-6 -left-px w-px bg-border" />
        <div className="absolute -inset-y-6 -right-px w-px bg-border" />
        <div className="absolute -inset-x-6 -top-px h-px bg-border" />
        <div className="absolute -inset-x-6 -bottom-px h-px bg-border" />
        <DecorIcon position="top-left" />
        <DecorIcon position="bottom-right" />
        <div className="w-full max-w-sm animate-in space-y-0">
          <div className="mb-8 text-center">
            <Link href="/" className="text-sm font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
              Tinfin
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

function InviteError({ message }: { message: string }) {
  return (
    <InviteLayout>
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
          <svg className="size-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-bold">Invite Unavailable</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <a href="/dashboard" className="text-sm text-primary underline underline-offset-4">Go to Dashboard →</a>
      </div>
    </InviteLayout>
  )
}
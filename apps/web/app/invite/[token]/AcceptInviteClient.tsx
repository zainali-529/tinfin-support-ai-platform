'use client'

/**
 * apps/web/app/invite/[token]/AcceptInviteClient.tsx  (Updated)
 *
 * Fix 2: Shows a clear "wrong email" error when the logged-in user's email
 * doesn't match the invite email. The server already validates this; the client
 * surfaces the error message gracefully.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { Button } from '@workspace/ui/components/button'
import { Spinner } from '@workspace/ui/components/spinner'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { ShieldIcon, UserIcon, CheckCircleIcon, OctagonXIcon, AlertTriangleIcon } from 'lucide-react'
import { cn } from '@workspace/ui/lib/utils'

interface Props {
  token: string
  orgName: string
  orgId: string
  role: 'admin' | 'agent'
  inviterName: string
  email: string
  expiresAt: string
  isLoggedIn: boolean
  loggedInEmail?: string | null
}

export function AcceptInviteClient({
  token,
  orgName,
  orgId,
  role,
  inviterName,
  email,
  isLoggedIn,
  loggedInEmail,
}: Props) {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')

  const acceptMutation = trpc.team.acceptInvite.useMutation({
    onSuccess: () => {
      setAccepted(true)
      setTimeout(() => router.push('/dashboard'), 1800)
    },
    onError: (err) => setError(err.message),
  })

  // Detect email mismatch before even hitting the server
  const emailMismatch = isLoggedIn && loggedInEmail && loggedInEmail.toLowerCase() !== email.toLowerCase()

  function handleAccept() {
    setError('')
    acceptMutation.mutate({ token })
  }

  function handleLoginRedirect() {
    router.push(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`)
  }

  const orgInitials = orgName.slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold shadow-md">
        {orgInitials}
      </div>

      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight">You've been invited!</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{inviterName}</span> invited{' '}
          <span className="font-medium text-foreground">{email}</span> to join{' '}
          <span className="font-medium text-foreground">{orgName}</span>
        </p>
      </div>

      {/* Role badge */}
      <div className={cn(
        'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 w-full max-w-xs justify-center',
        role === 'admin'
          ? 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20'
          : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
      )}>
        {role === 'admin' ? <ShieldIcon className="size-4 text-violet-600" /> : <UserIcon className="size-4 text-blue-600" />}
        <span className={cn(
          'text-sm font-semibold',
          role === 'admin' ? 'text-violet-800 dark:text-violet-200' : 'text-blue-800 dark:text-blue-200'
        )}>
          {role === 'admin' ? 'Admin' : 'Agent'} role
        </span>
      </div>

      {/* Wrong email warning */}
      {emailMismatch && (
        <Alert className="text-left border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangleIcon className="size-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
            You're logged in as <strong>{loggedInEmail}</strong>, but this invite is for{' '}
            <strong>{email}</strong>. Please{' '}
            <button
              className="underline underline-offset-2 font-semibold hover:opacity-80"
              onClick={handleLoginRedirect}
            >
              sign in with {email}
            </button>{' '}
            to accept.
          </AlertDescription>
        </Alert>
      )}

      {/* Server error */}
      {error && (
        <Alert variant="destructive" className="text-left">
          <OctagonXIcon className="size-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Success */}
      {accepted && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircleIcon className="size-4 shrink-0" />
          Joined! Redirecting to dashboard…
        </div>
      )}

      {/* CTA */}
      {!accepted && (
        isLoggedIn ? (
          <Button
            size="lg"
            onClick={handleAccept}
            disabled={acceptMutation.isPending || !!emailMismatch}
            className="w-full max-w-xs gap-2"
          >
            {acceptMutation.isPending && <Spinner className="size-4" />}
            {acceptMutation.isPending ? 'Joining…' : `Join ${orgName}`}
          </Button>
        ) : (
          <div className="w-full max-w-xs space-y-3">
            <p className="text-xs text-muted-foreground">
              This invite is for <strong>{email}</strong>. Sign in or sign up with that email to continue.
            </p>
            <Button size="lg" onClick={handleLoginRedirect} className="w-full gap-2">
              Sign in to accept
            </Button>
            <p className="text-xs text-muted-foreground">
              Don't have an account?{' '}
              <a
                href={`/signup?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                className="text-primary underline underline-offset-4"
              >
                Sign up with {email}
              </a>
            </p>
          </div>
        )
      )}
    </div>
  )
}
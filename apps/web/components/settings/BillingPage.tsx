'use client'

/**
 * apps/web/components/settings/BillingPage.tsx  (Enhanced)
 *
 * Now includes:
 *   - Current plan card with next billing date + cancel status
 *   - Usage summary bars
 *   - Invoice history with PDF download
 *   - Plan cards (upgrade / manage)
 *   - Feature comparison table
 */

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { usePlan } from '@/hooks/usePlan'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Spinner } from '@workspace/ui/components/spinner'
import { PlanBadge, UsageBar } from '../billing/PlanGuard'
import { cn } from '@workspace/ui/lib/utils'
import {
  CheckIcon, XIcon, ArrowRightIcon, CreditCardIcon, CheckCircleIcon,
  AlertCircleIcon, DownloadIcon, ExternalLinkIcon, ZapIcon, StarIcon,
  ReceiptIcon, CalendarIcon, MessageSquareIcon, PhoneCallIcon, UsersIcon,
} from 'lucide-react'
import { format } from 'date-fns'

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  currentPlanId,
  onUpgrade,
  onPortal,
  isLoading,
}: {
  plan: { id: string; name: string; description: string; price: number; limits: Record<string, number>; features: Record<string, boolean> }
  currentPlanId: string
  onUpgrade: (planId: 'pro' | 'scale') => void
  onPortal: () => void
  isLoading: boolean
}) {
  const isCurrent = plan.id === currentPlanId
  const currentPrice = currentPlanId === 'free' ? 0 : currentPlanId === 'pro' ? 29 : 79
  const teamMembersLimit = plan.limits.teamMembers ?? 1
  const conversationsLimit = plan.limits.conversationsPerMonth ?? 50
  const kbChunksLimit = plan.limits.kbChunks ?? 100
  const knowledgeBasesLimit = plan.limits.knowledgeBases ?? 1
  const voiceMinutesLimit = plan.limits.voiceMinutesPerMonth ?? 0
  const hasEmailChannel = plan.features.emailChannel ?? plan.id !== 'free'
  const hasWhatsAppChannel = plan.features.whatsappChannel ?? plan.id !== 'free'

  return (
    <div className={cn(
      'relative rounded-2xl border p-6 flex flex-col gap-4 transition-all',
      isCurrent ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/30',
      plan.id === 'scale' && !isCurrent && 'border-violet-200 dark:border-violet-800'
    )}>
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="px-3 text-xs shadow-sm">Current Plan</Badge>
        </div>
      )}
      {plan.id === 'scale' && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="px-3 text-xs bg-violet-600 border-0 shadow-sm">Most Popular</Badge>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold">{plan.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
      </div>

      <div>
        <span className="text-4xl font-black">${plan.price}</span>
        {plan.price > 0 && <span className="text-muted-foreground text-sm ml-1">/month</span>}
      </div>

      <ul className="space-y-1.5 text-xs flex-1">
        {[
          teamMembersLimit === 1 ? '1 user (admin only)' : `Up to ${teamMembersLimit} team members`,
          conversationsLimit === -1 ? 'Unlimited chats' : `${conversationsLimit.toLocaleString()} chats/month`,
          `${kbChunksLimit.toLocaleString()} KB chunks`,
          `${knowledgeBasesLimit} knowledge base${knowledgeBasesLimit > 1 ? 's' : ''}`,
          voiceMinutesLimit === 0 ? 'No voice calls' : `${voiceMinutesLimit} voice min/month`,
        ].map((feat) => (
          <li key={feat} className="flex items-start gap-2">
            <CheckIcon className={cn('size-3.5 mt-0.5 shrink-0', feat.startsWith('No') ? 'text-muted-foreground/40' : 'text-emerald-500')} />
            <span className={feat.startsWith('No') ? 'text-muted-foreground/50' : 'text-muted-foreground'}>{feat}</span>
          </li>
        ))}
        {plan.features.widgetCustomization && <li className="flex items-start gap-2"><CheckIcon className="size-3.5 mt-0.5 shrink-0 text-emerald-500" /><span className="text-muted-foreground">Widget customization</span></li>}
        <li className="flex items-start gap-2">
          <CheckIcon className={cn('size-3.5 mt-0.5 shrink-0', hasEmailChannel ? 'text-emerald-500' : 'text-muted-foreground/40')} />
          <span className={hasEmailChannel ? 'text-muted-foreground' : 'text-muted-foreground/50'}>
            {hasEmailChannel ? 'Email channel (inbound + replies)' : 'Email channel preview only'}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckIcon className={cn('size-3.5 mt-0.5 shrink-0', hasWhatsAppChannel ? 'text-emerald-500' : 'text-muted-foreground/40')} />
          <span className={hasWhatsAppChannel ? 'text-muted-foreground' : 'text-muted-foreground/50'}>
            {hasWhatsAppChannel ? 'WhatsApp channel' : 'WhatsApp channel preview only'}
          </span>
        </li>
        {plan.features.analytics && <li className="flex items-start gap-2"><CheckIcon className="size-3.5 mt-0.5 shrink-0 text-emerald-500" /><span className="text-muted-foreground">Analytics</span></li>}
        {plan.features.prioritySupport && <li className="flex items-start gap-2"><StarIcon className="size-3.5 mt-0.5 shrink-0 text-amber-500" /><span className="text-muted-foreground">Priority support</span></li>}
      </ul>

      {isCurrent ? (
        plan.id !== 'free' ? (
          <Button variant="outline" size="sm" onClick={onPortal} disabled={isLoading} className="gap-1.5">
            {isLoading ? <Spinner className="size-3.5" /> : <CreditCardIcon className="size-3.5" />}
            Manage Billing
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground py-1 flex items-center justify-center gap-1.5">
            <CheckCircleIcon className="size-3.5 text-emerald-500" /> Free forever
          </p>
        )
      ) : plan.id === 'free' ? (
        <Button variant="outline" size="sm" onClick={onPortal} disabled={isLoading} className="text-muted-foreground gap-1.5 text-xs">
          Cancel subscription
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={isLoading}
          className={cn('gap-1.5', plan.id === 'scale' ? 'bg-violet-600 hover:bg-violet-700 text-white border-0' : '')}
          onClick={() => onUpgrade(plan.id as 'pro' | 'scale')}
        >
          {isLoading ? <Spinner className="size-3.5" /> : <ArrowRightIcon className="size-3.5" />}
          {plan.price > currentPrice ? 'Upgrade' : 'Switch'} to {plan.name}
        </Button>
      )}
    </div>
  )
}

// ─── Feature Tick ─────────────────────────────────────────────────────────────

function Tick({ yes }: { yes: boolean }) {
  return yes ? <CheckIcon className="size-4 text-emerald-500 mx-auto" /> : <XIcon className="size-4 text-muted-foreground/30 mx-auto" />
}

// ─── Invoice Row ──────────────────────────────────────────────────────────────

function InvoiceRow({ inv }: {
  inv: {
    id: string; number: string; amountPaid: number; currency: string
    status: string; createdAt: string; periodStart: string; periodEnd: string
    pdfUrl: string | null; hostedUrl: string | null
  }
}) {
  const amount = (inv.amountPaid / 100).toFixed(2)
  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Invoice #{inv.number}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(inv.periodStart), 'MMM d')} – {format(new Date(inv.periodEnd), 'MMM d, yyyy')}
        </p>
      </div>
      <div className="text-sm font-semibold tabular-nums">${amount} {inv.currency}</div>
      <Badge variant="outline" className={cn(
        'text-[10px] shrink-0',
        inv.status === 'paid' ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700'
      )}>
        {inv.status}
      </Badge>
      <div className="flex gap-1 shrink-0">
        {inv.pdfUrl && (
          <Button size="icon-sm" variant="ghost" asChild title="Download PDF">
            <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
              <DownloadIcon className="size-3.5" />
            </a>
          </Button>
        )}
        {inv.hostedUrl && (
          <Button size="icon-sm" variant="ghost" asChild title="View invoice">
            <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Inner (needs useSearchParams) ───────────────────────────────────────────

function BillingInner() {
  const searchParams = useSearchParams()
  const { planId, planName, currentPeriodEnd, cancelAtPeriodEnd, status, usage, limits, isLoading } = usePlan()
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const { data: plans = [], isLoading: plansLoading } = trpc.billing.getPlans.useQuery()
  const { data: invoices = [], isLoading: invoicesLoading } = trpc.billing.getInvoices.useQuery(undefined, { staleTime: 60_000 })

  const createCheckout = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => { window.location.href = data.url },
    onError: (err) => alert(err.message),
    onSettled: () => setCheckoutLoading(null),
  })
  const createPortal = trpc.billing.createPortal.useMutation({
    onSuccess: (data) => { window.location.href = data.url },
    onError: (err) => alert(err.message),
    onSettled: () => setPortalLoading(false),
  })

  const success = searchParams.get('success') === 'true'
  const cancelled = searchParams.get('cancelled') === 'true'

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CreditCardIcon className="size-6 text-primary" />
          Billing & Plans
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your subscription and view invoices.</p>
      </div>

      {/* Banners */}
      {success && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
          <CheckCircleIcon className="size-4 text-emerald-600" />
          <AlertDescription className="text-sm text-emerald-800 dark:text-emerald-200">
            Subscription activated! Your plan is now upgraded.
          </AlertDescription>
        </Alert>
      )}
      {cancelled && (
        <Alert>
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="text-sm">Checkout was cancelled. Your plan hasn't changed.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">

          {/* Current subscription card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Current Subscription</CardTitle>
                <PlanBadge planId={planId} />
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <p className="font-semibold capitalize">{planName}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      status === 'active' ? 'border-emerald-300 text-emerald-700' :
                      status === 'past_due' ? 'border-red-300 text-red-700' : ''
                    )}>
                      {status}
                    </Badge>
                  </div>
                  {currentPeriodEnd && planId !== 'free' && (
                    <>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarIcon className="size-3" /> {cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'}</p>
                        <p className="font-semibold">{format(new Date(currentPeriodEnd), 'MMMM d, yyyy')}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-semibold">${planId === 'pro' ? '29.00' : '79.00'}/month</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              {cancelAtPeriodEnd && (
                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                  <AlertCircleIcon className="size-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                    Your subscription will cancel on {currentPeriodEnd ? format(new Date(currentPeriodEnd), 'MMMM d, yyyy') : ''}. You'll be moved to the Free plan after that.
                  </AlertDescription>
                </Alert>
              )}
              {planId !== 'free' && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => { setPortalLoading(true); createPortal.mutate({}) }} disabled={portalLoading} className="gap-1.5">
                    {portalLoading ? <Spinner className="size-3.5" /> : <CreditCardIcon className="size-3.5" />}
                    Manage in Portal
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage this period */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Usage This Period</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Live consumption against your plan limits.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /></div>
                      <Skeleton className="h-1.5 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <UsageBar label="Conversations" current={usage?.conversations ?? 0} limit={limits?.conversations ?? 50} icon={<MessageSquareIcon className="size-4" />} />
                  {(limits?.voiceMinutes ?? 0) > 0 && (
                    <UsageBar label="Voice minutes" current={usage?.voiceMinutes ?? 0} limit={limits?.voiceMinutes ?? 0} unit="min" icon={<PhoneCallIcon className="size-4" />} />
                  )}
                  <UsageBar label="Team members" current={usage?.teamMembers ?? 0} limit={limits?.teamMembers ?? 1} icon={<UsersIcon className="size-4" />} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Invoice history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ReceiptIcon className="size-4" />
                Invoice History
              </CardTitle>
              <CardDescription className="text-xs">Your recent billing invoices.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0">
              {invoicesLoading ? (
                <div className="py-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4 py-2">
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No invoices yet. They'll appear here once you subscribe.
                </div>
              ) : (
                <div>
                  {invoices.map((inv) => (
                    <InvoiceRow key={inv.id} inv={inv} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan cards — right column */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Available Plans</p>
          {plansLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)
          ) : (
            plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentPlanId={planId}
                onUpgrade={(id) => { setCheckoutLoading(id); createCheckout.mutate({ planId: id }) }}
                onPortal={() => { setPortalLoading(true); createPortal.mutate({}) }}
                isLoading={checkoutLoading === plan.id || portalLoading}
              />
            ))
          )}
        </div>
      </div>

      {/* Comparison table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Full Comparison</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-4 gap-4 pb-3 border-b">
              <div />
              {['Free', 'Pro', 'Scale'].map((n) => (
                <div key={n} className={cn('text-center text-sm font-bold', n === 'Scale' ? 'text-violet-600' : n === 'Pro' ? 'text-primary' : '')}>{n}</div>
              ))}
            </div>
            {[
              { label: 'Team members', free: '1', pro: '5', scale: '20' },
              { label: 'Chats / month', free: '50', pro: '1,000', scale: 'Unlimited' },
              { label: 'KB chunks', free: '100', pro: '2,000', scale: '20,000' },
              { label: 'Knowledge bases', free: '1', pro: '5', scale: '20' },
              { label: 'Voice min / month', free: '0', pro: '100', scale: '500' },
              { label: 'Organizations', free: '1', pro: '1', scale: '3' },
              { label: 'Chat widget', free: <Tick yes />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Email channel', free: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'WhatsApp channel', free: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Widget customization', free: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Voice calls', free: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Team management', free: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Analytics', free: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Priority support', free: <Tick yes={false} />, pro: <Tick yes={false} />, scale: <Tick yes /> },
            ].map((row) => (
              <div key={row.label} className="grid grid-cols-4 items-center gap-4 py-2.5 border-b last:border-0">
                <div className="text-sm text-muted-foreground">{row.label}</div>
                <div className="text-center text-sm font-medium">{row.free}</div>
                <div className="text-center text-sm font-medium">{row.pro}</div>
                <div className="text-center text-sm font-medium">{row.scale}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function BillingPage() {
  return (
    <Suspense>
      <BillingInner />
    </Suspense>
  )
}

'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  AlertCircleIcon,
  ArrowRightIcon,
  BotIcon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  CreditCardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  PhoneCallIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
  WorkflowIcon,
  XIcon,
} from 'lucide-react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Spinner } from '@workspace/ui/components/spinner'
import { cn } from '@workspace/ui/lib/utils'
import { trpc } from '@/lib/trpc'
import { usePlan } from '@/hooks/usePlan'
import { PlanBadge, UsageBar } from '../billing/PlanGuard'

type PlanId = 'free' | 'starter' | 'pro' | 'scale'

type PlanCardData = {
  id: string
  name: string
  description: string
  price: number
  limits: Record<string, number>
  features: Record<string, boolean | undefined>
}

type Invoice = {
  id: string
  number: string
  amountPaid: number
  currency: string
  status: string
  createdAt: string
  periodStart: string
  periodEnd: string
  pdfUrl: string | null
  hostedUrl: string | null
}

const PLAN_ORDER: PlanId[] = ['free', 'starter', 'pro', 'scale']

const PLAN_TONES: Record<string, string> = {
  free: 'border-border bg-card',
  starter: 'border-sky-200 bg-sky-50/40 dark:border-sky-900/70 dark:bg-sky-950/10',
  pro: 'border-primary/25 bg-primary/5',
  scale: 'border-violet-200 bg-violet-50/50 dark:border-violet-900/70 dark:bg-violet-950/15',
}

function isPaidPlan(planId: string): planId is Exclude<PlanId, 'free'> {
  return planId === 'starter' || planId === 'pro' || planId === 'scale'
}

function formatLimit(value: number, suffix = ''): string {
  if (value === -1) return 'Unlimited'
  return `${value.toLocaleString()}${suffix}`
}

function boolFeature(plan: PlanCardData, key: string): boolean {
  return plan.features[key] === true
}

function FeatureLine({ enabled, label, mutedLabel }: { enabled: boolean; label: string; mutedLabel?: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckIcon className={cn('mt-0.5 size-3.5 shrink-0', enabled ? 'text-emerald-500' : 'text-muted-foreground/35')} />
      <span className={enabled ? 'text-muted-foreground' : 'text-muted-foreground/50'}>
        {enabled ? label : (mutedLabel ?? label)}
      </span>
    </li>
  )
}

function PlanCard({
  plan,
  currentPlanId,
  onUpgrade,
  onPortal,
  canManageBilling,
  isLoading,
}: {
  plan: PlanCardData
  currentPlanId: string
  onUpgrade: (planId: Exclude<PlanId, 'free'>) => void
  onPortal: () => void
  canManageBilling: boolean
  isLoading: boolean
}) {
  const isCurrent = plan.id === currentPlanId
  const isPro = plan.id === 'pro'
  const isScale = plan.id === 'scale'
  const teamMembersLimit = plan.limits.teamMembers ?? 1
  const conversationsLimit = plan.limits.conversationsPerMonth ?? 50
  const kbChunksLimit = plan.limits.kbChunks ?? 100
  const knowledgeBasesLimit = plan.limits.knowledgeBases ?? 1
  const voiceMinutesLimit = plan.limits.voiceMinutesPerMonth ?? 0

  const actionLabel = boolFeature(plan, 'aiActions')
    ? 'AI Actions and API tools'
    : 'AI Actions not included'

  return (
    <div
      className={cn(
        'relative flex min-h-[390px] flex-col rounded-2xl border p-5 transition-colors',
        PLAN_TONES[plan.id] ?? PLAN_TONES.free,
        isCurrent && 'ring-1 ring-primary/30',
        !isCurrent && 'hover:border-primary/35'
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">{plan.name}</h3>
            {isCurrent && <Badge className="h-5 px-2 text-[10px]">Current</Badge>}
            {isPro && !isCurrent && <Badge variant="outline" className="h-5 px-2 text-[10px]">Recommended</Badge>}
          </div>
          <p className="mt-1 min-h-8 text-xs leading-4 text-muted-foreground">{plan.description}</p>
        </div>
        {isScale ? <StarIcon className="size-4 shrink-0 text-violet-500" /> : <ShieldCheckIcon className="size-4 shrink-0 text-muted-foreground" />}
      </div>

      <div className="mb-4">
        <span className="text-3xl font-semibold tracking-tight">${plan.price}</span>
        {plan.price > 0 && <span className="ml-1 text-sm text-muted-foreground">/month</span>}
      </div>

      <ul className="flex-1 space-y-1.5 text-xs">
        <FeatureLine enabled label={teamMembersLimit === 1 ? '1 admin user' : `Up to ${teamMembersLimit} team members`} />
        <FeatureLine enabled label={`${formatLimit(conversationsLimit)} chats/month`} />
        <FeatureLine enabled label={`${formatLimit(kbChunksLimit)} KB chunks`} />
        <FeatureLine enabled label={`${knowledgeBasesLimit} knowledge base${knowledgeBasesLimit > 1 ? 's' : ''}`} />
        <FeatureLine enabled={voiceMinutesLimit > 0} label={`${voiceMinutesLimit} voice min/month`} mutedLabel="Voice calls not included" />
        <FeatureLine enabled={boolFeature(plan, 'widgetCustomization')} label="Widget customization" mutedLabel="Basic widget only" />
        <FeatureLine enabled={boolFeature(plan, 'emailChannel')} label="Email channel" mutedLabel="Email channel not included" />
        <FeatureLine enabled={boolFeature(plan, 'whatsappChannel')} label="WhatsApp channel" mutedLabel="WhatsApp channel not included" />
        <FeatureLine enabled={boolFeature(plan, 'aiActions')} label={actionLabel} mutedLabel={actionLabel} />
        <FeatureLine enabled={boolFeature(plan, 'analytics')} label="Analytics and reporting" mutedLabel="Basic reporting only" />
      </ul>

      <div className="mt-5">
        {isCurrent ? (
          plan.id !== 'free' ? (
            <Button variant="outline" size="sm" onClick={onPortal} disabled={isLoading || !canManageBilling} className="w-full gap-1.5">
              {isLoading ? <Spinner className="size-3.5" /> : <CreditCardIcon className="size-3.5" />}
              {canManageBilling ? 'Manage Billing' : 'Admin access required'}
            </Button>
          ) : (
            <div className="flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background text-xs text-muted-foreground">
              <CheckCircleIcon className="size-3.5 text-emerald-500" /> Free forever
            </div>
          )
        ) : plan.id === 'free' ? (
          <Button variant="outline" size="sm" onClick={onPortal} disabled={isLoading || !canManageBilling} className="w-full text-xs text-muted-foreground">
            Downgrade in portal
          </Button>
        ) : currentPlanId !== 'free' ? (
          <Button size="sm" variant="outline" disabled={isLoading || !canManageBilling} className="w-full gap-1.5" onClick={onPortal}>
            {isLoading ? <Spinner className="size-3.5" /> : <CreditCardIcon className="size-3.5" />}
            Change in Portal
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={isLoading || !canManageBilling}
            className={cn(
              'w-full gap-1.5',
              plan.id === 'starter' && 'bg-sky-600 text-white hover:bg-sky-700',
              plan.id === 'scale' && 'bg-violet-600 text-white hover:bg-violet-700'
            )}
            onClick={() => isPaidPlan(plan.id) && onUpgrade(plan.id)}
          >
            {isLoading ? <Spinner className="size-3.5" /> : <ArrowRightIcon className="size-3.5" />}
            {!canManageBilling ? 'Admin access required' : `Upgrade to ${plan.name}`}
          </Button>
        )}
      </div>
    </div>
  )
}

function Tick({ yes }: { yes: boolean }) {
  return yes ? <CheckIcon className="mx-auto size-4 text-emerald-500" /> : <XIcon className="mx-auto size-4 text-muted-foreground/30" />
}

function InvoiceRow({ inv }: { inv: Invoice }) {
  const amount = (inv.amountPaid / 100).toFixed(2)
  return (
    <div className="flex items-center gap-4 border-b py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Invoice #{inv.number}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(inv.periodStart), 'MMM d')} - {format(new Date(inv.periodEnd), 'MMM d, yyyy')}
        </p>
      </div>
      <div className="text-sm font-semibold tabular-nums">${amount} {inv.currency}</div>
      <Badge
        variant="outline"
        className={cn('shrink-0 text-[10px]', inv.status === 'paid' ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700')}
      >
        {inv.status}
      </Badge>
      <div className="flex shrink-0 gap-1">
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

function BillingInner() {
  const searchParams = useSearchParams()
  const {
    planId,
    planName,
    planDetails,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    status,
    usage,
    limits,
    isLoading,
    canManageBilling,
  } = usePlan()
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const { data: plans = [], isLoading: plansLoading } = trpc.billing.getPlans.useQuery()
  const { data: invoices = [], isLoading: invoicesLoading } = trpc.billing.getInvoices.useQuery(undefined, {
    enabled: canManageBilling,
    staleTime: 60_000,
  })

  const orderedPlans = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.id as PlanId) - PLAN_ORDER.indexOf(b.id as PlanId))

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
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CreditCardIcon className="size-6 text-primary" />
          Billing & Plans
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage plan access, usage, invoices, and subscription controls for this organization.</p>
      </div>

      {success && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
          <CheckCircleIcon className="size-4 text-emerald-600" />
          <AlertDescription className="text-sm text-emerald-800 dark:text-emerald-200">Subscription activated. Your plan is now upgraded.</AlertDescription>
        </Alert>
      )}
      {cancelled && (
        <Alert>
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="text-sm">Checkout was cancelled. Your plan has not changed.</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Available Plans</p>
            <p className="text-xs text-muted-foreground">Starter keeps the core chat experience lean. Pro unlocks email, WhatsApp, voice, analytics, and AI Actions.</p>
          </div>
          <PlanBadge planId={planId} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {plansLoading
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[390px] rounded-2xl" />)
            : orderedPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentPlanId={planId}
                onUpgrade={(id) => { setCheckoutLoading(id); createCheckout.mutate({ planId: id }) }}
                onPortal={() => { setPortalLoading(true); createPortal.mutate({}) }}
                canManageBilling={canManageBilling}
                isLoading={checkoutLoading === plan.id || portalLoading}
              />
            ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current Subscription</CardTitle>
              <PlanBadge planId={planId} />
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-semibold capitalize">{planName}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className={cn('text-[10px]', status === 'active' ? 'border-emerald-300 text-emerald-700' : status === 'past_due' ? 'border-red-300 text-red-700' : '')}>
                    {status}
                  </Badge>
                </div>
                {currentPeriodEnd && planId !== 'free' && (
                  <>
                    <div className="space-y-0.5">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarIcon className="size-3" /> {cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'}</p>
                      <p className="font-semibold">{format(new Date(currentPeriodEnd), 'MMMM d, yyyy')}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-semibold">${(planDetails?.price ?? 0).toFixed(2)}/month</p>
                    </div>
                  </>
                )}
              </div>
            )}
            {cancelAtPeriodEnd && (
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                <AlertCircleIcon className="size-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                  Your subscription will cancel on {currentPeriodEnd ? format(new Date(currentPeriodEnd), 'MMMM d, yyyy') : 'the period end'}.
                </AlertDescription>
              </Alert>
            )}
            {planId !== 'free' && canManageBilling && (
              <Button size="sm" variant="outline" onClick={() => { setPortalLoading(true); createPortal.mutate({}) }} disabled={portalLoading} className="gap-1.5">
                {portalLoading ? <Spinner className="size-3.5" /> : <CreditCardIcon className="size-3.5" />}
                Manage in Portal
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usage This Period</CardTitle>
            <CardDescription className="text-xs">Live consumption against your plan limits.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /></div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))
            ) : (
              <>
                <UsageBar label="Conversations" current={usage?.conversations ?? 0} limit={limits?.conversations ?? 50} icon={<MessageSquareIcon className="size-4" />} />
                {(limits?.voiceMinutes ?? 0) > 0 && <UsageBar label="Voice minutes" current={usage?.voiceMinutes ?? 0} limit={limits?.voiceMinutes ?? 0} unit="min" icon={<PhoneCallIcon className="size-4" />} />}
                <UsageBar label="Team members" current={usage?.teamMembers ?? 0} limit={limits?.teamMembers ?? 1} icon={<UsersIcon className="size-4" />} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ReceiptIcon className="size-4" /> Invoice History</CardTitle>
          <CardDescription className="text-xs">Your recent billing invoices.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-0">
          {invoicesLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex gap-4 py-2">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No invoices yet. They will appear here once you subscribe.</div>
          ) : (
            <div>{invoices.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}</div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Full Comparison</CardTitle>
          <CardDescription className="text-xs">Feature access is enforced in both UI and API guards.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="overflow-x-auto pt-4">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-5 gap-4 border-b pb-3">
              <div />
              {['Free', 'Starter', 'Pro', 'Scale'].map((name) => (
                <div key={name} className={cn('text-center text-sm font-bold', name === 'Starter' && 'text-sky-600', name === 'Pro' && 'text-primary', name === 'Scale' && 'text-violet-600')}>
                  {name}
                </div>
              ))}
            </div>
            {[
              { label: 'Team members', icon: UsersIcon, free: '1', starter: '2', pro: '5', scale: '20' },
              { label: 'Chats / month', icon: MessageSquareIcon, free: '50', starter: '300', pro: '1,000', scale: 'Unlimited' },
              { label: 'Knowledge bases', icon: BotIcon, free: '1', starter: '3', pro: '5', scale: '20' },
              { label: 'KB chunks', icon: SparklesIcon, free: '100', starter: '750', pro: '2,000', scale: '20,000' },
              { label: 'Voice min / month', icon: PhoneCallIcon, free: '0', starter: '0', pro: '100', scale: '500' },
              { label: 'Chat widget', icon: MessageCircleIcon, free: <Tick yes />, starter: <Tick yes />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Widget customization', icon: SparklesIcon, free: <Tick yes={false} />, starter: <Tick yes />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Email channel', icon: MailIcon, free: <Tick yes={false} />, starter: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'WhatsApp channel', icon: MessageCircleIcon, free: <Tick yes={false} />, starter: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'AI Actions', icon: WorkflowIcon, free: <Tick yes={false} />, starter: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Voice calls', icon: PhoneCallIcon, free: <Tick yes={false} />, starter: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Analytics', icon: SparklesIcon, free: <Tick yes={false} />, starter: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Priority support', icon: StarIcon, free: <Tick yes={false} />, starter: <Tick yes={false} />, pro: <Tick yes={false} />, scale: <Tick yes /> },
            ].map((row) => {
              const Icon = row.icon
              return (
                <div key={row.label} className="grid grid-cols-5 items-center gap-4 border-b py-2.5 last:border-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-3.5" /> {row.label}</div>
                  <div className="text-center text-sm font-medium">{row.free}</div>
                  <div className="text-center text-sm font-medium">{row.starter}</div>
                  <div className="text-center text-sm font-medium">{row.pro}</div>
                  <div className="text-center text-sm font-medium">{row.scale}</div>
                </div>
              )
            })}
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

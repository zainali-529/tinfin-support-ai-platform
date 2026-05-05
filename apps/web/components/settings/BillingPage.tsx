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
  PackagePlusIcon,
  PhoneCallIcon,
  PlusCircleIcon,
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
import { Input } from '@workspace/ui/components/input'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Spinner } from '@workspace/ui/components/spinner'
import { toast } from '@workspace/ui/components/sonner'
import { cn } from '@workspace/ui/lib/utils'
import { trpc } from '@/lib/trpc'
import { usePlan } from '@/hooks/usePlan'
import { PlanBadge, UsageBar } from '../billing/PlanGuard'
import { LaunchErrorState, LaunchInlineError } from '@/components/launch/LaunchState'

type PlanId = 'free' | 'starter' | 'pro' | 'scale'

type PlanCardData = {
  id: string
  name: string
  description: string
  price: number
  priceCents?: number
  limits: Record<string, number>
  features: Record<string, boolean | undefined>
  trialDays?: number | null
  promotionCodesEnabled?: boolean
  pricing?: BillingPriceSummary | null
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

type BillingAddOnId =
  | 'conversations_1000'
  | 'voice_100'
  | 'team_seat_1'
  | 'knowledge_base_1'
  | 'kb_chunks_5000'

type BillingAddOn = {
  id: BillingAddOnId
  name: string
  description: string
  price: number
  priceCents: number
  unitAmount: number
  unitLabel: string
  minUnits: number
  defaultUnits: number
  maxUnits: number
  limitKey: string
  requiresFeature: string | null
  pricing: BillingPriceSummary | null
}

type ActiveBillingAddOn = {
  id: string
  addOnId: string
  name: string
  quantity: number
  totalUnits: number
  unitAmount: number
  periodEnd: string
  status: string
}

type BillingDiscountSummary = {
  couponId: string
  label: string
  percentOff: number | null
  amountOffCents: number | null
  duration: string | null
}

type BillingPriceSummary = {
  subtotalCents: number
  discountCents: number
  totalCents: number
  dueNowCents: number
  trialDays: number | null
  discount: BillingDiscountSummary | null
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

function formatMoney(cents: number): string {
  const amount = cents / 100
  return amount % 1 === 0 ? `$${amount.toFixed(0)}` : `$${amount.toFixed(2)}`
}

function calculateDiscountCents(subtotalCents: number, discount: BillingDiscountSummary | null | undefined): number {
  if (!discount || subtotalCents <= 0) return 0
  if (typeof discount.percentOff === 'number') {
    return Math.min(subtotalCents, Math.round((subtotalCents * discount.percentOff) / 100))
  }
  if (typeof discount.amountOffCents === 'number') {
    return Math.min(subtotalCents, discount.amountOffCents)
  }
  return 0
}

function calculateCustomUnitAmountCents(params: {
  priceCents: number
  baseUnits: number
  requestedUnits: number
}): number {
  return Math.max(1, Math.ceil((params.priceCents * params.requestedUnits) / params.baseUnits))
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
  const planPricing = plan.pricing
  const hasPlanDiscount = Boolean(planPricing && planPricing.discountCents > 0)
  const recurringCents = planPricing?.totalCents ?? Math.round(plan.price * 100)
  const dueNowCents = planPricing?.dueNowCents ?? recurringCents
  const trialDays = planPricing?.trialDays ?? plan.trialDays ?? null

  const actionLabel = boolFeature(plan, 'aiActions')
    ? 'AI Actions: save and run'
    : 'AI Actions preview only'

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
            {Boolean(plan.trialDays) && !isCurrent && (
              <Badge variant="outline" className="h-5 px-2 text-[10px]">
                {plan.trialDays}d trial
              </Badge>
            )}
          </div>
          <p className="mt-1 min-h-8 text-xs leading-4 text-muted-foreground">{plan.description}</p>
        </div>
        {isScale ? <StarIcon className="size-4 shrink-0 text-violet-500" /> : <ShieldCheckIcon className="size-4 shrink-0 text-muted-foreground" />}
      </div>

      <div className="mb-4">
        {hasPlanDiscount && (
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">{formatMoney(planPricing!.subtotalCents)}</span>
            <Badge variant="outline" className="border-emerald-300 text-[10px] text-emerald-700">
              Save {formatMoney(planPricing!.discountCents)}
            </Badge>
          </div>
        )}
        <span className="text-3xl font-semibold tracking-tight">{formatMoney(recurringCents)}</span>
        {plan.price > 0 && <span className="ml-1 text-sm text-muted-foreground">/month</span>}
        {plan.price > 0 && hasPlanDiscount && (
          <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
            {planPricing!.discount?.label ?? 'Discount'} applied automatically
          </p>
        )}
        {plan.price > 0 && !hasPlanDiscount && plan.promotionCodesEnabled && (
          <p className="mt-1 text-[11px] text-muted-foreground">Optional promo code at checkout</p>
        )}
        {plan.price > 0 && (
          <div className="mt-3 rounded-xl border bg-background/70 px-3 py-2 text-[11px]">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Due today</span>
              <span className="font-semibold">{formatMoney(dueNowCents)}</span>
            </div>
            {trialDays ? (
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">After {trialDays} day trial</span>
                <span className="font-semibold">{formatMoney(recurringCents)}/mo</span>
              </div>
            ) : hasPlanDiscount ? (
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">List price</span>
                <span className="line-through">{formatMoney(planPricing!.subtotalCents)}/mo</span>
              </div>
            ) : null}
          </div>
        )}
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

function PreviewCell() {
  return (
    <Badge variant="outline" className="mx-auto w-fit border-amber-300 text-[10px] text-amber-700">
      Preview
    </Badge>
  )
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

function AddOnCard({
  addOn,
  activeQuantity,
  canManageBilling,
  canPurchase,
  disabledReason,
  isLoading,
  onBuy,
}: {
  addOn: BillingAddOn
  activeQuantity: number
  canManageBilling: boolean
  canPurchase: boolean
  disabledReason: string | null
  isLoading: boolean
  onBuy: (requestedUnits: number) => void
}) {
  const [requestedUnits, setRequestedUnits] = useState(addOn.defaultUnits ?? addOn.unitAmount)
  const checkoutUnits = requestedUnits
  const subtotalCents = calculateCustomUnitAmountCents({
    priceCents: addOn.priceCents,
    baseUnits: addOn.unitAmount,
    requestedUnits,
  })
  const discountCents = calculateDiscountCents(subtotalCents, addOn.pricing?.discount)
  const checkoutTotalCents = Math.max(0, subtotalCents - discountCents)

  function updateRequestedUnits(nextValue: number) {
    if (!Number.isFinite(nextValue)) {
      setRequestedUnits(addOn.defaultUnits ?? addOn.unitAmount)
      return
    }

    setRequestedUnits(Math.min(addOn.maxUnits, Math.max(addOn.minUnits, Math.trunc(nextValue))))
  }

  return (
    <div className="flex min-h-[280px] flex-col rounded-2xl border bg-card p-4 transition-colors hover:border-primary/35">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">{addOn.name}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{addOn.description}</p>
        </div>
        <PackagePlusIcon className="size-4 shrink-0 text-primary" />
      </div>

      <div className="mb-3 rounded-xl border bg-background px-3 py-2">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`addon-quantity-${addOn.id}`}>
            Custom {addOn.unitLabel}
          </label>
          <span className="text-[11px] text-muted-foreground">
            Min {addOn.minUnits.toLocaleString()} / Max {addOn.maxUnits.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={requestedUnits <= addOn.minUnits || isLoading}
            onClick={() => updateRequestedUnits(requestedUnits - 1)}
          >
            -
          </Button>
          <Input
            id={`addon-quantity-${addOn.id}`}
            type="number"
            min={addOn.minUnits}
            max={addOn.maxUnits}
            value={requestedUnits}
            onChange={(event) => updateRequestedUnits(Number(event.target.value))}
            className="h-8 text-center text-sm font-semibold"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={requestedUnits >= addOn.maxUnits || isLoading}
            onClick={() => updateRequestedUnits(requestedUnits + 1)}
          >
            +
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">You are adding</span>
          <span className="font-semibold">+{checkoutUnits.toLocaleString()} {addOn.unitLabel}</span>
        </div>
      </div>

      {activeQuantity > 0 ? (
        <Badge variant="outline" className="mb-3 w-fit border-emerald-300 text-[10px] text-emerald-700">
          Active this period: +{activeQuantity.toLocaleString()} {addOn.unitLabel}
        </Badge>
      ) : (
        <Badge variant="outline" className="mb-3 w-fit text-[10px]">
          Current billing period
        </Badge>
      )}

      <div className="mt-auto">
        <Button
          size="sm"
          disabled={!canManageBilling || !canPurchase || isLoading}
          onClick={() => onBuy(requestedUnits)}
          className="w-full gap-1.5"
          title={disabledReason ?? undefined}
        >
          {isLoading ? <Spinner className="size-3.5" /> : <PlusCircleIcon className="size-3.5" />}
          Pay {formatMoney(checkoutTotalCents)}
        </Button>
      </div>
      <div className="mt-3 rounded-xl border bg-muted/20 px-3 py-2 text-[11px]">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Subtotal</span>
          <span className={discountCents > 0 ? 'line-through' : 'font-semibold'}>{formatMoney(subtotalCents)}</span>
        </div>
        {discountCents > 0 && (
          <>
            <div className="mt-1 flex justify-between gap-3 text-emerald-700 dark:text-emerald-300">
              <span>{addOn.pricing?.discount?.label ?? 'Discount'}</span>
              <span>-{formatMoney(discountCents)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-muted-foreground">Due today</span>
              <span className="font-semibold">{formatMoney(checkoutTotalCents)}</span>
            </div>
          </>
        )}
      </div>

      {!canManageBilling && <p className="mt-2 text-[11px] text-muted-foreground">Only organization admins can buy add-ons.</p>}
      {canManageBilling && disabledReason && <p className="mt-2 text-[11px] text-muted-foreground">{disabledReason}</p>}
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
    activeAddOns,
    accessMode,
    isBillingRestricted,
    graceEndsAt,
    isLoading,
    canManageBilling,
    error: planError,
    refetchPlan,
  } = usePlan()
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [addOnLoading, setAddOnLoading] = useState<string | null>(null)

  const { data: plans = [], isLoading: plansLoading, error: plansError, refetch: refetchPlans } = trpc.billing.getPlans.useQuery()
  const { data: addOnData, isLoading: addOnsLoading, error: addOnsError, refetch: refetchAddOns } = trpc.billing.getAddOns.useQuery(undefined, {
    enabled: canManageBilling,
    staleTime: 30_000,
  })
  const { data: invoices = [], isLoading: invoicesLoading, error: invoicesError, refetch: refetchInvoices } = trpc.billing.getInvoices.useQuery(undefined, {
    enabled: canManageBilling,
    staleTime: 60_000,
  })

  const orderedPlans = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.id as PlanId) - PLAN_ORDER.indexOf(b.id as PlanId))
  const billingAddOns = addOnData?.addOns ?? []
  const visibleActiveAddOns = (addOnData?.activeAddOns ?? activeAddOns) as ActiveBillingAddOn[]
  const features = (planDetails?.features ?? {}) as Record<string, boolean | undefined>

  const createCheckout = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => { window.location.href = data.url },
    onSettled: () => setCheckoutLoading(null),
  })
  const createAddOnCheckout = trpc.billing.createAddOnCheckout.useMutation({
    onSuccess: (data) => { window.location.href = data.url },
    onSettled: () => setAddOnLoading(null),
  })
  const createPortal = trpc.billing.createPortal.useMutation({
    onSuccess: (data) => { window.location.href = data.url },
    onSettled: () => setPortalLoading(false),
  })

  const success = searchParams.get('success') === 'true'
  const cancelled = searchParams.get('cancelled') === 'true'
  const addOnSuccess = searchParams.get('addon') === 'success'
  const addOnCancelled = searchParams.get('addon') === 'cancelled'

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
      {addOnSuccess && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
          <CheckCircleIcon className="size-4 text-emerald-600" />
          <AlertDescription className="text-sm text-emerald-800 dark:text-emerald-200">Add-on purchased. It will apply to this billing period after Stripe confirms payment.</AlertDescription>
        </Alert>
      )}
      {addOnCancelled && (
        <Alert>
          <AlertCircleIcon className="size-4" />
          <AlertDescription className="text-sm">Add-on checkout was cancelled. No usage pack was added.</AlertDescription>
        </Alert>
      )}
      {plansError && !plansLoading && (
        <LaunchErrorState
          error={plansError}
          title="Plans could not be loaded"
          onRetry={() => void refetchPlans()}
          docsHref="/docs/admin/billing-usage-addons"
        />
      )}
      {planError && !isLoading && (
        <LaunchErrorState
          error={planError}
          title="Current billing status could not be loaded"
          onRetry={refetchPlan}
          docsHref="/docs/admin/billing-usage-addons"
        />
      )}
      {isBillingRestricted && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <AlertCircleIcon className="size-4 text-red-600" />
          <AlertDescription className="text-sm text-red-800 dark:text-red-200">
            Billing is restricted. Update payment details in Stripe Portal before using paid features or buying add-ons.
          </AlertDescription>
        </Alert>
      )}
      {accessMode === 'grace' && graceEndsAt && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <AlertCircleIcon className="size-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            Payment needs attention. You are in grace mode until {format(new Date(graceEndsAt), 'MMMM d, yyyy')}.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Available Plans</p>
            <p className="text-xs text-muted-foreground">Starter keeps the core chat experience lean. Pro unlocks email, WhatsApp, voice, analytics, and AI Actions. Automatic discounts and trials are shown before checkout and applied in Stripe.</p>
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
                onUpgrade={(id) => {
                  setCheckoutLoading(id)
                  toast.loading('Opening secure checkout...', { id: `checkout-${id}` })
                  createCheckout.mutate({ planId: id }, {
                    onSettled: () => toast.dismiss(`checkout-${id}`),
                  })
                }}
                onPortal={() => {
                  setPortalLoading(true)
                  toast.loading('Opening billing portal...', { id: 'billing-portal' })
                  createPortal.mutate({}, {
                    onSettled: () => toast.dismiss('billing-portal'),
                  })
                }}
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPortalLoading(true)
                toast.loading('Opening billing portal...', { id: 'billing-portal' })
                createPortal.mutate({}, {
                  onSettled: () => toast.dismiss('billing-portal'),
                })
              }}
              disabled={portalLoading}
              className="gap-1.5"
            >
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

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <PackagePlusIcon className="size-4 text-primary" />
              Usage Add-ons
            </p>
            <p className="text-xs text-muted-foreground">
              Add any custom amount for the current billing period when a workspace needs extra capacity before renewal.
            </p>
          </div>
          {visibleActiveAddOns.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {visibleActiveAddOns.length} active
            </Badge>
          )}
        </div>
        {addOnsError && canManageBilling && !addOnsLoading ? (
          <LaunchInlineError
            error={addOnsError}
            onRetry={() => void refetchAddOns()}
            docsHref="/docs/admin/billing-usage-addons"
          />
        ) : isLoading || addOnsLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-[210px] rounded-2xl" />)}
          </div>
        ) : !canManageBilling ? (
          <Card className="shadow-none">
            <CardContent className="flex items-center justify-between gap-4 py-5">
              <div>
                <p className="text-sm font-semibold">Admin access required</p>
                <p className="text-xs text-muted-foreground">Ask an organization admin to buy extra usage packs.</p>
              </div>
              <ShieldCheckIcon className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ) : billingAddOns.length === 0 ? (
          <Card className="shadow-none">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">No add-ons are available yet.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {billingAddOns.map((addOn) => {
              const activeQuantity = visibleActiveAddOns
                .filter((active) => active.addOnId === addOn.id)
                .reduce((sum, active) => sum + active.totalUnits, 0)
              const missingFeature = addOn.requiresFeature && !features[addOn.requiresFeature]
              const disabledReason = isBillingRestricted
                ? 'Update billing before buying add-ons.'
                : planId === 'free'
                  ? 'Add-ons require an active paid plan.'
                  : missingFeature
                    ? 'This add-on requires a plan that includes the related feature.'
                    : null

              return (
                <AddOnCard
                  key={addOn.id}
                  addOn={addOn}
                  activeQuantity={activeQuantity}
                  canManageBilling={canManageBilling}
                  canPurchase={!disabledReason}
                  disabledReason={disabledReason}
                  isLoading={addOnLoading === addOn.id}
                  onBuy={(requestedUnits) => {
                    setAddOnLoading(addOn.id)
                    toast.loading('Opening add-on checkout...', { id: `addon-${addOn.id}` })
                    createAddOnCheckout.mutate({ addOnId: addOn.id, units: requestedUnits }, {
                      onSettled: () => toast.dismiss(`addon-${addOn.id}`),
                    })
                  }}
                />
              )
            })}
          </div>
        )}
      </section>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ReceiptIcon className="size-4" /> Invoice History</CardTitle>
          <CardDescription className="text-xs">Your recent billing invoices.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-0">
          {invoicesError && canManageBilling ? (
            <div className="py-4">
              <LaunchInlineError
                error={invoicesError}
                onRetry={() => void refetchInvoices()}
                docsHref="/docs/admin/billing-usage-addons"
              />
            </div>
          ) : invoicesLoading ? (
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
              { label: 'Chats / month', icon: MessageSquareIcon, free: '50', starter: '300', pro: '1,500', scale: '6,000' },
              { label: 'Knowledge bases', icon: BotIcon, free: '1', starter: '3', pro: '5', scale: '20' },
              { label: 'KB chunks', icon: SparklesIcon, free: '100', starter: '750', pro: '2,000', scale: '20,000' },
              { label: 'Voice min / month', icon: PhoneCallIcon, free: '0', starter: '0', pro: '60', scale: '250' },
              { label: 'Chat widget', icon: MessageCircleIcon, free: <Tick yes />, starter: <Tick yes />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Widget customization', icon: SparklesIcon, free: <Tick yes={false} />, starter: <Tick yes />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'Email channel', icon: MailIcon, free: <Tick yes={false} />, starter: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'WhatsApp channel', icon: MessageCircleIcon, free: <Tick yes={false} />, starter: <Tick yes={false} />, pro: <Tick yes />, scale: <Tick yes /> },
              { label: 'AI Actions', icon: WorkflowIcon, free: <PreviewCell />, starter: <PreviewCell />, pro: <Tick yes />, scale: <Tick yes /> },
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

"use client"

import Link from "next/link"
import {
  ArrowRightIcon,
  CheckIcon,
  ShieldCheckIcon,
  StarIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { trpc } from "@/lib/trpc"
import { cn } from "@workspace/ui/lib/utils"

export type MarketingPlan = {
  id: "free" | "starter" | "pro" | "scale"
  name: string
  eyebrow: string
  description: string
  price: number
  recommended?: boolean
  highlight?: string
  limits: {
    teamMembers: string
    conversations: string
    knowledgeBases: string
    kbChunks: string
    voiceMinutes: string
  }
  features: string[]
  notIncluded?: string[]
  cta: string
  href: string
}

type ApiPlan = {
  id: string
  price: number
  priceCents?: number
  trialDays?: number | null
  promotionCodesEnabled?: boolean
  pricing?: {
    subtotalCents: number
    discountCents: number
    totalCents: number
    dueNowCents: number
    trialDays: number | null
    discount: {
      label: string
      percentOff: number | null
      amountOffCents: number | null
      duration: string | null
    } | null
  } | null
}

function formatMoney(cents: number): string {
  const amount = cents / 100
  return amount % 1 === 0 ? `$${amount.toFixed(0)}` : `$${amount.toFixed(2)}`
}

function formatLimitLabel(key: string) {
  if (key === "teamMembers") return "Team"
  if (key === "knowledgeBases") return "KBs"
  if (key === "kbChunks") return "Chunks"
  if (key === "voiceMinutes") return "Voice"
  return "Chats"
}

function getApiPlan(plans: ApiPlan[], planId: string) {
  return plans.find((plan) => plan.id === planId)
}

export function PricingPlanCards({ plans }: { plans: MarketingPlan[] }) {
  const plansQuery = trpc.billing.getPlans.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
  })
  const apiPlans = (plansQuery.data ?? []) as ApiPlan[]

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-primary">Monthly plans</p>
            <h2 className="mt-2 text-3xl font-medium tracking-tight text-foreground md:text-4xl">Choose the workspace size that fits today.</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Discounts, trials, and final due-today totals are applied in secure checkout and shown again inside the billing dashboard.
          </p>
        </div>

        {plansQuery.isLoading && apiPlans.length === 0 ? (
          <div className="grid gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[620px] rounded-none" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-4">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} apiPlan={getApiPlan(apiPlans, plan.id)} />
            ))}
          </div>
        )}

        {plansQuery.error ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Live discount preview could not be loaded. Checkout will still show the final Stripe total before payment.
          </p>
        ) : null}
      </div>
    </section>
  )
}

function PlanCard({ plan, apiPlan }: { plan: MarketingPlan; apiPlan?: ApiPlan }) {
  const pricing = apiPlan?.pricing ?? null
  const subtotalCents = pricing?.subtotalCents ?? Math.round(plan.price * 100)
  const recurringCents = pricing?.totalCents ?? subtotalCents
  const dueNowCents = pricing?.dueNowCents ?? recurringCents
  const trialDays = pricing?.trialDays ?? apiPlan?.trialDays ?? null
  const hasDiscount = Boolean(pricing && pricing.discountCents > 0)
  const hasPromoAtCheckout = Boolean(apiPlan?.promotionCodesEnabled && plan.price > 0 && !hasDiscount)

  return (
    <article
      className={cn(
        "relative flex min-h-[650px] flex-col border bg-card p-5 transition-colors hover:border-primary/40",
        plan.recommended && "border-primary/45 bg-primary/5",
      )}
    >
      {plan.recommended ? (
        <div className="absolute -top-px left-5 right-5 flex h-px items-center justify-center bg-primary">
          <span className="bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">
            Recommended
          </span>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{plan.eyebrow}</p>
          <h3 className="mt-3 text-2xl font-medium tracking-tight text-foreground">{plan.name}</h3>
        </div>
        {plan.id === "scale" ? <StarIcon className="size-5 text-primary" /> : <ShieldCheckIcon className="size-5 text-muted-foreground" />}
      </div>

      <p className="mt-4 min-h-16 text-sm leading-6 text-muted-foreground">{plan.description}</p>

      <div className="mt-6 border-y border-border py-5">
        {hasDiscount ? (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">{formatMoney(subtotalCents)}</span>
            <span className="border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
              Save {formatMoney(pricing!.discountCents)}
            </span>
          </div>
        ) : null}

        <div className="flex items-end gap-1">
          <span className="text-5xl font-semibold tracking-tight text-foreground">{formatMoney(recurringCents)}</span>
          {plan.price > 0 ? <span className="pb-1.5 text-sm text-muted-foreground">/month</span> : null}
        </div>

        {plan.price === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Free forever</p>
        ) : hasDiscount ? (
          <p className="mt-2 text-xs font-medium text-emerald-600">
            {pricing?.discount?.label ?? "Discount"} applied automatically
          </p>
        ) : hasPromoAtCheckout ? (
          <p className="mt-2 text-xs text-muted-foreground">Optional promo code at checkout</p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Monthly billing</p>
        )}

        {plan.price > 0 ? (
          <div className="mt-4 border border-border bg-background px-3 py-2 text-[11px]">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Due today</span>
              <span className="font-semibold text-foreground">{formatMoney(dueNowCents)}</span>
            </div>
            {trialDays ? (
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">After {trialDays} day trial</span>
                <span className="font-semibold text-foreground">{formatMoney(recurringCents)}/mo</span>
              </div>
            ) : hasDiscount ? (
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">List price</span>
                <span className="text-muted-foreground line-through">{formatMoney(subtotalCents)}/mo</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-2 text-sm">
        {Object.entries(plan.limits).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-4 border-b border-border/70 pb-2 last:border-b-0">
            <span className="capitalize text-muted-foreground">{formatLimitLabel(key)}</span>
            <span className="text-right font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Includes</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-2">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {plan.notIncluded?.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Not included</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground/70">
            {plan.notIncluded.map((feature) => (
              <li key={feature} className="flex gap-2">
                <XIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/35" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button asChild className="mt-auto w-full rounded-full" variant={plan.recommended ? "default" : "outline"}>
        <Link href={plan.href}>
          {plan.cta}
          <ArrowRightIcon className="size-4" />
        </Link>
      </Button>
    </article>
  )
}

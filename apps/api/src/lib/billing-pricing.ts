import type Stripe from 'stripe'
import type { BillingAddOnId, PlanId } from './plans'

export type BillingDiscountTarget =
  | { type: 'plan'; planId: Exclude<PlanId, 'free'> }
  | { type: 'addon'; addOnId: BillingAddOnId }

export interface BillingDiscountSummary {
  couponId: string
  label: string
  percentOff: number | null
  amountOffCents: number | null
  duration: string | null
}

export interface BillingPriceSummary {
  subtotalCents: number
  discountCents: number
  totalCents: number
  dueNowCents: number
  trialDays: number | null
  discount: BillingDiscountSummary | null
}

const couponCache = new Map<string, Promise<BillingDiscountSummary | null>>()

function readPositiveIntEnv(name: string): number | null {
  const raw = process.env[name]
  if (!raw) return null

  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) return null

  return value
}

function readTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

export function promotionCodesEnabled(couponId?: string | null): boolean {
  if (couponId) return false
  return process.env.STRIPE_ALLOW_PROMOTION_CODES === 'true'
}

export function trialDaysForPlan(planId: PlanId): number | null {
  if (planId === 'free') return null

  const planSpecific = readPositiveIntEnv(`STRIPE_TRIAL_DAYS_${planId.toUpperCase()}`)
  return planSpecific ?? readPositiveIntEnv('STRIPE_TRIAL_DAYS')
}

export function couponIdForTarget(target: BillingDiscountTarget): string | null {
  if (target.type === 'plan') {
    return (
      readTrimmedEnv(`STRIPE_PLAN_PROMOTION_CODE_${target.planId.toUpperCase()}`) ??
      readTrimmedEnv(`STRIPE_PLAN_COUPON_${target.planId.toUpperCase()}`) ??
      readTrimmedEnv(`STRIPE_PROMOTION_CODE_${target.planId.toUpperCase()}`) ??
      readTrimmedEnv(`STRIPE_COUPON_${target.planId.toUpperCase()}`) ??
      readTrimmedEnv('STRIPE_PLAN_PROMOTION_CODE_ID') ??
      readTrimmedEnv('STRIPE_PLAN_COUPON_ID') ??
      readTrimmedEnv('STRIPE_DEFAULT_PROMOTION_CODE_ID') ??
      readTrimmedEnv('STRIPE_DEFAULT_COUPON_ID') ??
      readTrimmedEnv('STRIPE_PROMOTION_CODE_ID') ??
      readTrimmedEnv('STRIPE_COUPON_ID')
    )
  }

  return (
    readTrimmedEnv(`STRIPE_ADDON_PROMOTION_CODE_${target.addOnId.toUpperCase()}`) ??
    readTrimmedEnv(`STRIPE_ADDON_COUPON_${target.addOnId.toUpperCase()}`) ??
    readTrimmedEnv('STRIPE_ADDON_PROMOTION_CODE_ID') ??
    readTrimmedEnv('STRIPE_ADDON_COUPON_ID') ??
    readTrimmedEnv('STRIPE_DEFAULT_PROMOTION_CODE_ID') ??
    readTrimmedEnv('STRIPE_DEFAULT_COUPON_ID') ??
    readTrimmedEnv('STRIPE_PROMOTION_CODE_ID') ??
    readTrimmedEnv('STRIPE_COUPON_ID')
  )
}

function couponLabel(coupon: Stripe.Coupon): string {
  if (coupon.name) return coupon.name
  if (typeof coupon.percent_off === 'number') return `${coupon.percent_off}% off`
  if (typeof coupon.amount_off === 'number') {
    return `$${(coupon.amount_off / 100).toFixed(2)} off`
  }
  return 'Discount'
}

function toDiscountSummary(coupon: Stripe.Coupon): BillingDiscountSummary | null {
  if (!coupon.valid) return null

  return {
    couponId: coupon.id,
    label: couponLabel(coupon),
    percentOff: typeof coupon.percent_off === 'number' ? coupon.percent_off : null,
    amountOffCents: typeof coupon.amount_off === 'number' ? coupon.amount_off : null,
    duration: coupon.duration ?? null,
  }
}

async function loadCoupon(
  stripe: Stripe | null,
  couponOrPromotionCodeId: string | null
): Promise<BillingDiscountSummary | null> {
  if (!stripe || !couponOrPromotionCodeId) return null

  if (!couponCache.has(couponOrPromotionCodeId)) {
    couponCache.set(
      couponOrPromotionCodeId,
      (couponOrPromotionCodeId.startsWith('promo_')
        ? stripe.promotionCodes
          .retrieve(couponOrPromotionCodeId)
          .then((promotionCode) => toDiscountSummary(promotionCode.coupon as Stripe.Coupon))
        : stripe.coupons
          .retrieve(couponOrPromotionCodeId)
          .then((coupon) => toDiscountSummary(coupon as Stripe.Coupon))
      )
        .catch((error) => {
          console.warn(`[billing-pricing] Failed to load discount ${couponOrPromotionCodeId}:`, (error as Error).message)
          return null
        })
    )
  }

  return couponCache.get(couponOrPromotionCodeId)!
}

export function calculateDiscountCents(
  subtotalCents: number,
  discount: BillingDiscountSummary | null
): number {
  if (!discount || subtotalCents <= 0) return 0

  if (typeof discount.percentOff === 'number') {
    return Math.min(subtotalCents, Math.round((subtotalCents * discount.percentOff) / 100))
  }

  if (typeof discount.amountOffCents === 'number') {
    return Math.min(subtotalCents, discount.amountOffCents)
  }

  return 0
}

export async function priceSummaryForTarget(params: {
  stripe: Stripe | null
  target: BillingDiscountTarget
  subtotalCents: number
  trialDays?: number | null
}): Promise<BillingPriceSummary> {
  const couponId = couponIdForTarget(params.target)
  const discount = await loadCoupon(params.stripe, couponId)
  const discountCents = calculateDiscountCents(params.subtotalCents, discount)
  const totalCents = Math.max(0, params.subtotalCents - discountCents)
  const trialDays = params.trialDays ?? null

  return {
    subtotalCents: params.subtotalCents,
    discountCents,
    totalCents,
    dueNowCents: trialDays ? 0 : totalCents,
    trialDays,
    discount,
  }
}

export function checkoutDiscountParams(
  target: BillingDiscountTarget
): Pick<Stripe.Checkout.SessionCreateParams, 'allow_promotion_codes' | 'discounts'> {
  const discountId = couponIdForTarget(target)
  if (discountId) {
    return {
      discounts: [
        discountId.startsWith('promo_')
          ? { promotion_code: discountId }
          : { coupon: discountId },
      ],
    }
  }

  return {
    allow_promotion_codes: promotionCodesEnabled(),
  }
}

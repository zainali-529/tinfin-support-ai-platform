import type { Metadata } from "next"
import type { ComponentType } from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  BarChart3Icon,
  BotIcon,
  CheckIcon,
  CreditCardIcon,
  DatabaseIcon,
  HeadphonesIcon,
  MailIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  PhoneCallIcon,
  SparklesIcon,
  UsersIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Header } from "@/components/marketing/header"
import { MarketingFooter } from "@/components/marketing/MarketingFooter"
import { MarketingHeroGrid } from "@/components/marketing/MarketingHeroGrid"
import { MarketingCTASection } from "@/components/marketing/MarketingCTASection"
import { MarketingFAQSection, type MarketingFAQ } from "@/components/marketing/MarketingFAQSection"
import { PricingPlanCards, type MarketingPlan } from "@/components/marketing/PricingPlanCards"
import { cn } from "@workspace/ui/lib/utils"

export const metadata: Metadata = {
  title: "Pricing | Tinfiz",
  description:
    "Simple pricing for Tinfiz AI support: website chat, knowledge base, unified inbox, AI Actions, channels, voice, analytics, and usage add-ons.",
}

type Plan = MarketingPlan

type ComparisonRow = {
  label: string
  icon: ComponentType<{ className?: string }>
  free: string | boolean | "preview"
  starter: string | boolean | "preview"
  pro: string | boolean | "preview"
  scale: string | boolean | "preview"
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    eyebrow: "Start here",
    description: "A small workspace for testing chat, AI answers, and your first knowledge source.",
    price: 0,
    limits: {
      teamMembers: "1 admin user",
      conversations: "50 chats / month",
      knowledgeBases: "1 knowledge base",
      kbChunks: "100 KB chunks",
      voiceMinutes: "No voice minutes",
    },
    features: ["Website chat widget", "AI responses", "Knowledge base", "Basic conversation handling"],
    notIncluded: ["Email, WhatsApp, and voice", "AI Actions save/run", "Agent Copilot", "Analytics"],
    cta: "Start free",
    href: "/signup",
  },
  {
    id: "starter",
    name: "Starter",
    eyebrow: "Lean launch",
    description: "For solo operators and early teams that need a polished chat experience.",
    price: 19,
    limits: {
      teamMembers: "2 team members",
      conversations: "300 chats / month",
      knowledgeBases: "3 knowledge bases",
      kbChunks: "750 KB chunks",
      voiceMinutes: "No voice minutes",
    },
    features: ["Everything in Free", "Widget customization", "Team member access", "Larger knowledge capacity"],
    notIncluded: ["Email channel", "WhatsApp channel", "Voice calls", "Analytics", "Agent Copilot"],
    cta: "Choose Starter",
    href: "/signup?callbackUrl=/billing",
  },
  {
    id: "pro",
    name: "Pro",
    eyebrow: "Recommended",
    description: "For growing teams that need inbox operations, channels, actions, voice, and reporting.",
    price: 29,
    recommended: true,
    highlight: "Best fit for most support teams",
    limits: {
      teamMembers: "5 team members",
      conversations: "1,500 chats / month",
      knowledgeBases: "5 knowledge bases",
      kbChunks: "2,000 KB chunks",
      voiceMinutes: "60 voice min / month",
    },
    features: ["Email and WhatsApp", "AI Actions v1", "Agent Copilot", "Analytics and CSAT", "Custom branding"],
    cta: "Choose Pro",
    href: "/signup?callbackUrl=/billing",
  },
  {
    id: "scale",
    name: "Scale",
    eyebrow: "High volume",
    description: "For businesses with larger teams, higher usage, priority support, and more knowledge storage.",
    price: 79,
    limits: {
      teamMembers: "20 team members",
      conversations: "6,000 chats / month",
      knowledgeBases: "20 knowledge bases",
      kbChunks: "20,000 KB chunks",
      voiceMinutes: "250 voice min / month",
    },
    features: ["Everything in Pro", "Priority support", "Higher channel capacity", "Large knowledge storage", "Scale-ready reporting"],
    cta: "Choose Scale",
    href: "/signup?callbackUrl=/billing",
  },
]

const ADD_ONS = [
  {
    icon: MessageSquareTextIcon,
    name: "Extra conversations",
    price: "$10",
    unit: "per 1,000 conversations",
    note: "Custom quantity supported from dashboard billing.",
  },
  {
    icon: PhoneCallIcon,
    name: "Extra voice minutes",
    price: "$12.50",
    unit: "per 50 voice minutes",
    note: "Available when voice is included in the active plan.",
  },
  {
    icon: UsersIcon,
    name: "Extra team seats",
    price: "$8",
    unit: "per team member",
    note: "Useful when the team grows before the next plan upgrade.",
  },
  {
    icon: DatabaseIcon,
    name: "Knowledge storage",
    price: "$5",
    unit: "per 2,500 KB chunks",
    note: "Add indexed capacity for larger knowledge bases.",
  },
  {
    icon: BotIcon,
    name: "Extra knowledge bases",
    price: "$5",
    unit: "per knowledge base",
    note: "Separate sources by product, brand, or team.",
  },
] as const

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Team members", icon: UsersIcon, free: "1", starter: "2", pro: "5", scale: "20" },
  { label: "Chats per month", icon: MessageSquareTextIcon, free: "50", starter: "300", pro: "1,500", scale: "6,000" },
  { label: "Knowledge bases", icon: DatabaseIcon, free: "1", starter: "3", pro: "5", scale: "20" },
  { label: "KB chunks", icon: SparklesIcon, free: "100", starter: "750", pro: "2,000", scale: "20,000" },
  { label: "Voice minutes", icon: PhoneCallIcon, free: "0", starter: "0", pro: "60", scale: "250" },
  { label: "Website chat widget", icon: MessageCircleIcon, free: true, starter: true, pro: true, scale: true },
  { label: "Widget customization", icon: SparklesIcon, free: false, starter: true, pro: true, scale: true },
  { label: "Email channel", icon: MailIcon, free: false, starter: false, pro: true, scale: true },
  { label: "WhatsApp channel", icon: MessageCircleIcon, free: false, starter: false, pro: true, scale: true },
  { label: "Voice calls", icon: PhoneCallIcon, free: false, starter: false, pro: true, scale: true },
  { label: "AI Actions", icon: WorkflowIcon, free: "preview", starter: "preview", pro: true, scale: true },
  { label: "Agent Copilot", icon: BotIcon, free: false, starter: false, pro: true, scale: true },
  { label: "Analytics and CSAT", icon: BarChart3Icon, free: false, starter: false, pro: true, scale: true },
  { label: "Priority support", icon: HeadphonesIcon, free: false, starter: false, pro: false, scale: true },
]

const DECISION_POINTS = [
  {
    title: "Use Starter when",
    body: "you only need a branded website chat widget and core AI answers while keeping channels simple.",
  },
  {
    title: "Use Pro when",
    body: "you need email, WhatsApp, voice, AI Actions, Agent Copilot, CSAT, and analytics in one support workflow.",
  },
  {
    title: "Use Scale when",
    body: "your team needs more seats, more conversations, more knowledge storage, priority support, and bigger reporting capacity.",
  },
] as const

const PRICING_FAQS: MarketingFAQ[] = [
  {
    question: "Can I start without paying?",
    answer:
      "Yes. The Free plan is for testing the widget, AI answers, a first knowledge base, and a small number of monthly chats before you upgrade.",
  },
  {
    question: "Does Starter include email, WhatsApp, or voice?",
    answer:
      "No. Starter is focused on website chat and core setup. Email, WhatsApp, voice minutes, analytics, AI Actions, and Agent Copilot are designed for Pro and Scale.",
  },
  {
    question: "How do add-ons work?",
    answer:
      "Paid workspaces can buy custom extra capacity from billing: conversations, voice minutes, team seats, knowledge bases, and KB chunks. The dashboard calculates the cost before checkout.",
  },
  {
    question: "What happens when a workspace reaches its limit?",
    answer:
      "Protected features are limited by server-side billing guards. Admins can upgrade, buy add-ons, or wait for the next billing period depending on the limit.",
  },
  {
    question: "Can discounts or trials be applied?",
    answer:
      "Yes. Discounts and trials are configured through billing and reflected in checkout and dashboard pricing so users see the real due-today amount before paying.",
  },
  {
    question: "Which plan is best for a launch-ready support team?",
    answer:
      "Pro is usually the best starting point because it unlocks channels, AI Actions, Agent Copilot, CSAT, analytics, and voice while keeping the monthly cost controlled.",
  },
]

export default function PricingPage() {
  return (
    <>
      <Header />
      <main className="bg-background">
        <PricingHero />
        <PlanCards />
        <AddOnsSection />
        <ComparisonSection />
        <PricingGuidance />
        <MarketingFAQSection
          eyebrow="Pricing FAQ"
          title="Clear answers before checkout."
          description="Plan limits, add-ons, discounts, and billing behavior should be understandable before a customer starts paying."
          faqs={PRICING_FAQS}
          className="border-t-0"
        />
        <MarketingCTASection
          eyebrow="Choose with confidence"
          title="Start free, or book a walkthrough if you want help choosing."
          description="If your team only needs chat, start simple. If you need channels, actions, voice, and reporting, Pro is usually the cleanest first paid plan."
          primary={{ label: "Start free", href: "/signup" }}
          secondary={{ label: "Book a demo", href: "/demo" }}
          note="The billing dashboard remains the source of truth for active plan, usage limits, discounts, trials, add-ons, and checkout totals."
        />
      </main>
      <MarketingFooter />
    </>
  )
}

function PricingHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-background py-20 md:py-24">
      <MarketingHeroGrid />

      <div className="relative mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex border border-border bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
            Pricing
          </div>
          <h1 className="mt-6 text-balance text-5xl font-medium tracking-tight text-foreground md:text-7xl">
            Simple plans for AI support that can actually operate.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Start with chat and knowledge. Upgrade when you need channels, voice, AI Actions, Agent Copilot, CSAT, and serious reporting.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link href="/signup">
                Start free
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-background/70 px-7">
              <Link href="/docs/admin/billing-usage-addons">Read billing docs</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-3">
          {[
            ["No surprise overages", "Limits are clear. Add capacity only when you choose."],
            ["Pro unlocks channels", "Email, WhatsApp, voice, actions, analytics, and Copilot."],
            ["Custom add-ons", "Buy exact conversations, minutes, seats, KBs, or chunks."],
          ].map(([title, body]) => (
            <div key={title} className="border border-border bg-background/78 p-4 text-left backdrop-blur">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PlanCards() {
  return <PricingPlanCards plans={PLANS} />
}

function AddOnsSection() {
  return (
    <section className="border-y border-border bg-muted/12 py-16 md:py-20">
      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1fr] lg:items-start">
          <div>
            <div className="inline-flex border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Usage add-ons
            </div>
            <h2 className="mt-5 text-3xl font-medium tracking-tight text-foreground md:text-5xl">
              Need more before renewal? Add exact capacity.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Tinfiz does not need to auto-charge surprise overages. Paid workspaces can buy custom add-on amounts for the active billing period from the billing dashboard.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {ADD_ONS.map((addOn) => {
              const Icon = addOn.icon
              return (
                <article key={addOn.name} className="border border-border bg-background p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-medium text-foreground">{addOn.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{addOn.unit}</p>
                    </div>
                    <span className="flex size-10 items-center justify-center border border-primary/20 bg-primary/8 text-primary">
                      <Icon className="size-4" />
                    </span>
                  </div>
                  <p className="mt-5 text-3xl font-semibold tracking-tight text-foreground">{addOn.price}</p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{addOn.note}</p>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function ComparisonSection() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="mb-8 grid gap-4 lg:grid-cols-[0.82fr_1fr] lg:items-end">
          <div>
            <p className="text-sm font-medium text-primary">Full comparison</p>
            <h2 className="mt-2 text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Feature gates match the product dashboard.
            </h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Frontend labels are helpful, but server-side billing guards are the final authority for channels, voice, AI Actions, Agent Copilot, usage limits, and add-ons.
          </p>
        </div>

        <div className="overflow-x-auto border border-border bg-card">
          <div className="min-w-[940px]">
            <div className="grid grid-cols-[1.55fr_repeat(4,1fr)] border-b border-border bg-muted/25">
              <div className="p-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Feature</div>
              {PLANS.map((plan) => (
                <div key={plan.id} className={cn("border-l border-border p-4 text-center text-sm font-semibold", plan.recommended && "text-primary")}>
                  {plan.name}
                </div>
              ))}
            </div>

            {COMPARISON_ROWS.map((row) => (
              <ComparisonRow key={row.label} row={row} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ComparisonRow({ row }: { row: ComparisonRow }) {
  const Icon = row.icon
  return (
    <div className="grid grid-cols-[1.55fr_repeat(4,1fr)] border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
        <Icon className="size-4 text-foreground" />
        {row.label}
      </div>
      <ComparisonCell value={row.free} />
      <ComparisonCell value={row.starter} />
      <ComparisonCell value={row.pro} highlight />
      <ComparisonCell value={row.scale} />
    </div>
  )
}

function ComparisonCell({ value, highlight }: { value: string | boolean | "preview"; highlight?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center border-l border-border p-4 text-center text-sm", highlight && "bg-primary/[0.03]")}>
      {value === true ? <CheckIcon className="size-4 text-primary" /> : value === false ? <XIcon className="size-4 text-muted-foreground/35" /> : value === "preview" ? (
        <span className="border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600">Preview</span>
      ) : (
        <span className="font-medium text-foreground">{value}</span>
      )}
    </div>
  )
}

function PricingGuidance() {
  return (
    <section className="border-t border-border bg-muted/12 py-16 md:py-20">
      <div className="mx-auto grid w-full max-w-[86rem] gap-8 px-4 md:px-6 lg:grid-cols-[0.7fr_1fr] lg:px-8">
        <div>
          <div className="inline-flex border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Plan guidance
          </div>
          <h2 className="mt-5 text-3xl font-medium tracking-tight text-foreground md:text-5xl">Pick based on operations, not just price.</h2>
        </div>
        <div className="grid gap-3">
          {DECISION_POINTS.map((item) => (
            <div key={item.title} className="border border-border bg-background p-5">
              <h3 className="text-base font-medium text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
          <div className="border border-primary/25 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <CreditCardIcon className="mt-0.5 size-5 text-primary" />
              <div>
                <h3 className="text-base font-medium text-foreground">Billing behavior</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  If a paid subscription becomes restricted, paid features are blocked until billing is fixed. Existing data stays available, and admins can update billing from the dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}



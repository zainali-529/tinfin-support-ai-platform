import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  Clock3Icon,
  LifeBuoyIcon,
  MessageSquareTextIcon,
  RouteIcon,
  SparklesIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Header } from "@/components/marketing/header"
import { MarketingFooter } from "@/components/marketing/MarketingFooter"
import { DemoRequestForm } from "@/components/marketing/DemoRequestForm"
import { MarketingHeroGrid } from "@/components/marketing/MarketingHeroGrid"
import { MarketingCTASection } from "@/components/marketing/MarketingCTASection"
import { MarketingFAQSection, type MarketingFAQ } from "@/components/marketing/MarketingFAQSection"

export const metadata: Metadata = {
  title: "Book a Demo | Tinfiz",
  description:
    "Request a Tinfiz demo and see how AI support, unified inbox, channels, voice, actions, and reporting can fit your customer support workflow.",
}

const FIT_POINTS = [
  "AI answers grounded in your knowledge base",
  "Human takeover, assignment, notes, and timeline",
  "Email, WhatsApp, voice, CSAT, analytics, and actions when your plan needs them",
] as const

const NEXT_STEPS = [
  {
    icon: MessageSquareTextIcon,
    title: "Share your workflow",
    body: "Tell us which channels you support, where customers wait, and what your team wants AI to handle first.",
  },
  {
    icon: RouteIcon,
    title: "We map the setup",
    body: "We outline the best starting path across widget, knowledge base, inbox, channels, actions, and reporting.",
  },
  {
    icon: SparklesIcon,
    title: "You get a focused demo",
    body: "The walkthrough stays practical: what to connect, what to automate, and what to measure before rollout.",
  },
] as const

const RESOURCE_LINKS = [
  {
    icon: BookOpenIcon,
    title: "Read the docs",
    body: "Explore setup guides for widget installation, knowledge base, channels, billing, and launch checks.",
    href: "/docs",
    cta: "Open docs",
  },
  {
    icon: LifeBuoyIcon,
    title: "Compare plans",
    body: "See which plan includes email, WhatsApp, voice, AI Actions, Agent Copilot, CSAT, and analytics.",
    href: "/pricing",
    cta: "View pricing",
  },
] as const

const DEMO_FAQS: MarketingFAQ[] = [
  {
    question: "What should I include in the demo request?",
    answer:
      "Share your website, current support channels, team size, current tool if you use one, and the biggest support workflow you want to improve first.",
  },
  {
    question: "Do I need a complete knowledge base before the demo?",
    answer:
      "No. A small help article, product page, FAQ, or short text note is enough to show how grounded AI answers and human handoff work.",
  },
  {
    question: "Can I start without booking a demo?",
    answer:
      "Yes. You can start free, install the widget, add a knowledge source, and test the inbox. The demo is useful when you want setup guidance or plan advice.",
  },
  {
    question: "Can you review migration from another support tool?",
    answer:
      "Yes. Include your current tool, channels, and team workflow in the form so the walkthrough can focus on the closest Tinfiz setup path.",
  },
]

export default function DemoPage() {
  return (
    <>
      <Header />
      <main className="bg-background">
        <DemoHero />
        <DemoFormSection />
        <WhatHappensNext />
        <MarketingFAQSection
          eyebrow="Demo FAQ"
          title="What to know before requesting a walkthrough."
          description="The demo should stay practical: your channels, your support flow, and the setup path that gets you value fastest."
          faqs={DEMO_FAQS}
        />
        <MarketingCTASection
          eyebrow="Explore first"
          title="Want to test the product before talking to anyone?"
          description="You can start with the free plan, add a knowledge source, and see how the widget and inbox feel before booking a walkthrough."
          primary={{ label: "Start free", href: "/signup" }}
          secondary={{ label: "View pricing", href: "/pricing" }}
        />
        <DemoResourceLinks />
      </main>
      <MarketingFooter />
    </>
  )
}

function DemoHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-background py-20 md:py-24">
      <MarketingHeroGrid />

      <div className="relative mx-auto grid w-full max-w-[86rem] gap-10 px-4 md:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 border border-border bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
            <Clock3Icon className="size-3.5" />
            Demo request
          </div>
          <h1 className="mt-6 text-balance text-5xl font-medium tracking-tight text-foreground md:text-7xl">
            See how Tinfiz fits your support workflow.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Send a short request and we will show the cleanest way to bring AI answers, human handoff, channels,
            actions, and reporting into one support workspace.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7">
              <a href="#demo-form">
                Request demo
                <ArrowRightIcon className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-background/75 px-7">
              <Link href="/pricing">Compare plans</Link>
            </Button>
          </div>
        </div>

        <div className="grid content-end gap-3">
          {FIT_POINTS.map((point, index) => (
            <div
              key={point}
              className="group flex items-start gap-3 border border-border bg-background/82 p-4 backdrop-blur transition hover:border-primary/35"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <CheckCircle2Icon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{point}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {index === 0
                    ? "Start with approved sources so answers stay useful and grounded."
                    : index === 1
                      ? "Keep agents in control when a customer needs a person."
                      : "Add only the operational layers your team is ready to use."}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DemoFormSection() {
  return (
    <section id="demo-form" className="border-b border-border bg-muted/15 py-14 md:py-20">
      <div className="mx-auto grid w-full max-w-[86rem] gap-8 px-4 md:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Short form</p>
          <h2 className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Enough context for a useful demo, not a long sales survey.
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            The goal is simple: understand your channels, team size, current tool, and what you want customers to
            experience when they ask for help.
          </p>
          <div className="mt-6 border border-border bg-background/78 p-4 text-sm leading-6 text-muted-foreground">
            Prefer to explore first? The docs and pricing links are below, so you can review setup and plan limits
            before sending the request.
          </div>
        </div>

        <DemoRequestForm />
      </div>
    </section>
  )
}

function WhatHappensNext() {
  return (
    <section className="border-b border-border bg-background py-14 md:py-20">
      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">What happens next</p>
          <h2 className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            A practical walkthrough, focused on your support flow.
          </h2>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {NEXT_STEPS.map((step, index) => {
            const Icon = step.icon

            return (
              <article key={step.title} className="border border-border bg-background p-5">
                <div className="flex items-center justify-between">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/35 text-foreground">
                    <Icon className="size-5" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-medium tracking-tight text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function DemoResourceLinks() {
  return (
    <section className="bg-muted/15 py-14 md:py-20">
      <div className="mx-auto grid w-full max-w-[86rem] gap-4 px-4 md:grid-cols-2 md:px-6 lg:px-8">
        {RESOURCE_LINKS.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.title}
              href={item.href}
              className="group border border-border bg-background p-6 transition hover:border-primary/35 hover:bg-primary/[0.025]"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/35 text-foreground">
                  <Icon className="size-5" />
                </div>
                <ArrowRightIcon className="size-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h3 className="mt-6 text-2xl font-medium tracking-tight text-foreground">{item.title}</h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{item.body}</p>
              <p className="mt-5 text-sm font-medium text-primary">{item.cta}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

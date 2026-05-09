import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRightIcon,
  BookOpenIcon,
  Clock3Icon,
  HandshakeIcon,
  LifeBuoyIcon,
  MailIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Header } from "@/components/marketing/header"
import { MarketingFooter } from "@/components/marketing/MarketingFooter"
import { MarketingHeroGrid } from "@/components/marketing/MarketingHeroGrid"
import { ContactRequestForm } from "@/components/marketing/ContactRequestForm"

export const metadata: Metadata = {
  title: "Contact | Tinfiz",
  description:
    "Contact Tinfiz for product questions, support, billing, partnerships, security reports, or a guided demo request.",
}

const CONTACT_EMAILS = [
  {
    icon: MailIcon,
    title: "General inquiries",
    body: "Questions about Tinfiz, product fit, or anything that does not need a dedicated route.",
    href: "mailto:hello@tinfiz.ai",
    label: "hello@tinfiz.ai",
  },
  {
    icon: HandshakeIcon,
    title: "Demo and sales",
    body: "Use the demo flow when you want a guided walkthrough based on your support workflow.",
    href: "/demo",
    label: "Book a demo",
  },
  {
    icon: ShieldCheckIcon,
    title: "Security reports",
    body: "Report suspected security issues without sending passwords, full secrets, or unnecessary customer data.",
    href: "mailto:security@tinfiz.ai",
    label: "security@tinfiz.ai",
  },
] as const

const CONTACT_ROUTES = [
  {
    icon: BookOpenIcon,
    title: "Need setup help?",
    body: "Open the docs for widget installation, knowledge base, channels, billing, and launch checks.",
    href: "/docs",
    cta: "Open docs",
  },
  {
    icon: LifeBuoyIcon,
    title: "Choosing a plan?",
    body: "Compare limits, channels, voice minutes, AI Actions, Agent Copilot, CSAT, and add-ons.",
    href: "/pricing",
    cta: "View pricing",
  },
  {
    icon: MessageCircleIcon,
    title: "Want a walkthrough?",
    body: "Request a practical demo focused on your channels, inbox workflow, and AI support setup.",
    href: "/demo",
    cta: "Request demo",
  },
] as const

const RESPONSE_NOTES = [
  "Product and demo questions usually get the fastest answer when you include your website and current support channels.",
  "Billing questions should include the workspace email or organization name if you already have an account.",
  "Security reports should include enough detail to reproduce or assess the issue safely.",
] as const

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="bg-background">
        <ContactHero />
        <ContactMain />
        <ContactRouteCards />
      </main>
      <MarketingFooter />
    </>
  )
}

function ContactHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-background py-20 md:py-24">
      <MarketingHeroGrid />

      <div className="relative mx-auto grid w-full max-w-[86rem] gap-10 px-4 md:px-6 lg:grid-cols-[1fr_0.9fr] lg:items-end lg:px-8">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
            <MailIcon className="size-3.5" />
            Contact
          </div>
          <h1 className="mt-6 text-balance text-5xl font-medium tracking-tight text-foreground md:text-7xl">
            Talk to us about support, setup, or security.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Send a message for product questions, support, billing, partnerships, or security reports. If you want a
            guided product walkthrough, the demo route is the best path.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7">
              <a href="#contact-form">
                Send a message
                <ArrowRightIcon className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-background/75 px-7">
              <Link href="/demo">Book a demo</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-border bg-background/82 p-5 backdrop-blur">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="flex size-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Clock3Icon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Best way to get a useful reply</p>
              <p className="text-xs text-muted-foreground">Choose the route that matches your question.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {CONTACT_EMAILS.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex gap-3 rounded-2xl border border-border bg-muted/12 p-3 transition hover:border-primary/35 hover:bg-primary/[0.035]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground group-hover:text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.body}</span>
                    <span className="mt-2 block text-xs font-medium text-primary">{item.label}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactMain() {
  return (
    <section id="contact-form" className="scroll-mt-24 border-b border-border bg-muted/10 py-14 md:py-20">
      <div className="mx-auto grid w-full max-w-[86rem] gap-8 px-4 md:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Contact form</p>
          <h2 className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Short message, clear route, useful reply.
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Keep the message focused. If you are already using Tinfiz, include your workspace email or organization
            name so we can understand the context faster.
          </p>

          <div className="mt-6 rounded-[1.5rem] border border-border bg-background p-5">
            <h3 className="text-sm font-medium text-foreground">Direct email</h3>
            <div className="mt-4 space-y-3">
              <a
                href="mailto:hello@tinfiz.ai"
                className="flex items-center justify-between gap-4 rounded-2xl border border-border p-3 text-sm transition hover:border-primary/35 hover:text-primary"
              >
                <span className="text-muted-foreground">General contact</span>
                <span className="font-medium text-foreground">hello@tinfiz.ai</span>
              </a>
              <a
                href="mailto:security@tinfiz.ai"
                className="flex items-center justify-between gap-4 rounded-2xl border border-border p-3 text-sm transition hover:border-primary/35 hover:text-primary"
              >
                <span className="text-muted-foreground">Security</span>
                <span className="font-medium text-foreground">security@tinfiz.ai</span>
              </a>
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-border bg-background p-5">
            <h3 className="text-sm font-medium text-foreground">Response notes</h3>
            <ul className="mt-4 space-y-3">
              {RESPONSE_NOTES.map((note) => (
                <li key={note} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <ContactRequestForm />
      </div>
    </section>
  )
}

function ContactRouteCards() {
  return (
    <section className="bg-background py-14 md:py-20">
      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Helpful routes</p>
          <h2 className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Sometimes the fastest answer is already one click away.
          </h2>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {CONTACT_ROUTES.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[1.75rem] border border-border bg-background p-5 transition hover:border-primary/35 hover:bg-primary/[0.025]"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-muted/25 text-foreground">
                    <Icon className="size-5" />
                  </div>
                  <ArrowRightIcon className="size-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <h3 className="mt-6 text-xl font-medium tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
                <p className="mt-5 text-sm font-medium text-primary">{item.cta}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

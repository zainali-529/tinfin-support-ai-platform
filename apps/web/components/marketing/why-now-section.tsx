import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Clock3,
  FileSearch,
  Inbox,
  MessageCircle,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

const FEATURE_CARDS = [
  {
    icon: MessageCircle,
    title: "Every channel in one queue",
    body: "Website chat, email, WhatsApp, and voice can move through one support workspace instead of scattered tabs and missed context.",
  },
  {
    icon: FileSearch,
    title: "Answers stay grounded",
    body: "AI uses approved knowledge sources, source health, and no-verified-answer handling so teams can trust what customers receive.",
  },
] as const

const WIDE_CARD_ITEMS = [
  "Realtime inbox ownership and saved views",
  "SLA, backlog, CSAT, and action quality signals",
  "Internal notes, timeline, and Agent Copilot for human teams",
] as const

export function WhyNowSection() {
  return (
    <section id="why-now" className="bg-background py-20 md:py-24">
      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="mb-10">
          <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Why choose Tinfiz
          </div>

          <h2 className="mt-5 max-w-5xl text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Why <span className="text-primary">Tinfiz</span> is the right support workspace for modern teams.
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(330px,0.92fr)]">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              {FEATURE_CARDS.map((card) => (
                <LightReasonCard key={card.title} card={card} />
              ))}
            </div>

            <article className="min-h-[220px] rounded-[1.45rem] border border-border bg-muted/35 p-6 md:p-7">
              <span className="flex size-11 items-center justify-center rounded-full border border-foreground/20 bg-background">
                <Clock3 className="size-5 text-foreground" />
              </span>

              <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:items-end">
                <div>
                  <h3 className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
                    One operating loop for support quality
                  </h3>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                    Tinfiz connects AI, human agents, actions, customer feedback, and analytics so support does not become a pile of disconnected tools.
                  </p>
                </div>

                <ul className="space-y-3">
                  {WIDE_CARD_ITEMS.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </div>

          <article className="relative min-h-[456px] overflow-hidden rounded-[1.45rem] bg-primary p-6 text-primary-foreground md:p-7">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(circle at 18% 0%, rgba(255,255,255,0.24), transparent 34%), radial-gradient(circle at 92% 18%, rgba(0,0,0,0.12), transparent 30%)",
              }}
            />

            <div className="relative flex h-full flex-col">
              <span className="flex size-12 items-center justify-center rounded-full border border-primary-foreground/45 bg-primary-foreground/10">
                <ShieldCheck className="size-5" />
              </span>

              <div className="mt-12">
                <h3 className="max-w-xs text-3xl font-medium tracking-tight md:text-4xl">
                  AI that works with human control.
                </h3>
                <p className="mt-7 text-sm leading-6 text-primary-foreground/80">
                  Let AI answer from approved knowledge, call safe API actions, and request handoff when the customer needs a person.
                </p>
                <p className="mt-5 text-sm leading-6 text-primary-foreground/80">
                  Your team keeps visibility through assignments, notes, timeline, approvals, CSAT, and analytics.
                </p>
              </div>

              <div className="mt-auto pt-9">
                <Button asChild className="rounded-full bg-background px-6 text-foreground hover:bg-background/90">
                  <Link href="/signup">
                    Start free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

function LightReasonCard({ card }: { card: (typeof FEATURE_CARDS)[number] }) {
  const Icon = card.icon

  return (
    <article className="min-h-[250px] rounded-[1.45rem] border border-border bg-muted/35 p-6 transition-colors hover:bg-muted/50 md:p-7">
      <span className="flex size-11 items-center justify-center rounded-full border border-foreground/20 bg-background">
        <Icon className={cn("size-5", card.icon === Bot ? "text-primary" : "text-foreground")} />
      </span>
      <h3 className="mt-10 max-w-sm text-2xl font-medium tracking-tight text-foreground">
        {card.title}
      </h3>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">
        {card.body}
      </p>
    </article>
  )
}


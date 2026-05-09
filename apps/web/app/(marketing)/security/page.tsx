import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertTriangleIcon,
  BadgeCheckIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  FingerprintIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  MailIcon,
  ServerCogIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  WorkflowIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Header } from "@/components/marketing/header"
import { MarketingFooter } from "@/components/marketing/MarketingFooter"
import { MarketingFAQSection, type MarketingFAQ } from "@/components/marketing/MarketingFAQSection"

export const metadata: Metadata = {
  title: "Security | Tinfiz",
  description:
    "How Tinfiz approaches workspace isolation, knowledge base data handling, grounded AI, AI Actions safety, secrets, roles, and security contact workflows.",
}

const SECURITY_EMAIL = "security@tinfiz.ai"

const SECURITY_PRINCIPLES = [
  {
    icon: ShieldCheckIcon,
    title: "Workspace isolation",
    body: "Customer conversations, knowledge sources, actions, and analytics are scoped to the active workspace.",
  },
  {
    icon: DatabaseIcon,
    title: "Customer data ownership",
    body: "Your organization owns the support data it adds to Tinfiz. We process it to provide the service.",
  },
  {
    icon: WorkflowIcon,
    title: "Controlled automation",
    body: "AI Actions use explicit endpoints, required parameters, allowlists, logs, and approval flows for risky operations.",
  },
] as const

const SECURITY_SECTIONS = [
  {
    id: "workspace-isolation",
    icon: ServerCogIcon,
    eyebrow: "Isolation",
    title: "Workspace isolation",
    body:
      "Tinfiz is built around organization-scoped workspaces. Conversations, contacts, knowledge bases, AI Actions, usage, and reporting are queried and guarded by workspace context.",
    points: [
      "Agents operate inside their active organization.",
      "Server-side guards remain the final authority for protected operations.",
      "Organization switching reloads workspace state so badges, limits, and permissions stay aligned.",
    ],
  },
  {
    id: "ai-knowledge",
    icon: BookOpenIcon,
    eyebrow: "AI and Knowledge Base",
    title: "Grounded AI and knowledge handling",
    body:
      "Knowledge Base sources are used to help AI answer customer questions in the context of your organization. The goal is useful answers from approved support content, not unrestricted guessing.",
    points: [
      "Knowledge sources can be text notes, URLs, or documents.",
      "Source health, chunk counts, and re-index controls help teams keep answers current.",
      "When no verified answer is available, the assistant should avoid pretending and can guide the customer toward human help.",
    ],
  },
  {
    id: "actions-safety",
    icon: WorkflowIcon,
    eyebrow: "AI Actions",
    title: "AI Actions safety",
    body:
      "AI Actions are designed for controlled API usage. Admins define the endpoint, method, required parameters, and safety settings before the AI can use an action.",
    points: [
      "Read actions can fetch approved data when required parameters are available.",
      "Risky write actions should require human approval before execution.",
      "Action logs capture status, failure reason, latency, request preview, and response output for review.",
    ],
  },
  {
    id: "secrets-allowlists",
    icon: KeyRoundIcon,
    eyebrow: "Secrets",
    title: "Secrets and domain allowlists",
    body:
      "Secrets are kept server-side and masked in the UI. Domain allowlists reduce where AI Actions can send outbound requests.",
    points: [
      "Action secrets are not exposed to widget visitors.",
      "Admins can rotate action secrets when credentials change.",
      "Outbound allowlists help prevent accidental calls to unapproved domains.",
    ],
  },
  {
    id: "access-control",
    icon: UsersRoundIcon,
    eyebrow: "Access",
    title: "Access control and team roles",
    body:
      "Tinfiz separates workspace membership from customer conversations so teams can invite agents without giving everyone full administrative access.",
    points: [
      "Admin and agent roles support different workspace responsibilities.",
      "Team permissions can limit access to sensitive operational areas.",
      "Assignment, notes, timeline, and notifications help keep agent activity visible.",
    ],
  },
  {
    id: "billing-security",
    icon: LockKeyholeIcon,
    eyebrow: "Billing",
    title: "Billing and plan security basics",
    body:
      "Billing state and plan limits are enforced server-side. Frontend labels help users understand access, but protected backend checks decide what can run.",
    points: [
      "Plan guards control channels, AI Actions, Agent Copilot, analytics, and usage limits.",
      "Stripe handles payment collection and subscription checkout flows.",
      "Usage limits are based on recorded activity, not removable UI records.",
    ],
  },
] as const

const INCIDENT_STEPS = [
  "Describe what happened and when you noticed it.",
  "Include affected workspace, domain, or user email if relevant.",
  "Do not send passwords, full API secrets, or unnecessary customer data by email.",
] as const

const SECURITY_FAQS: MarketingFAQ[] = [
  {
    question: "Does Tinfiz sell customer data?",
    answer:
      "No. Customer support data is processed to provide the product. Tinfiz is designed around workspace data ownership, not selling customer conversations or knowledge base content.",
  },
  {
    question: "Can AI answer without verified knowledge?",
    answer:
      "The assistant is designed to avoid unsupported claims when approved workspace context is missing. Teams can review no-answer and low-confidence signals to improve the knowledge base.",
  },
  {
    question: "Are action secrets exposed to widget visitors?",
    answer:
      "No. Action secrets are handled server-side and masked in admin UI. Widget visitors should never receive raw action credentials.",
  },
  {
    question: "Can risky write actions run automatically?",
    answer:
      "Risky write actions should require human approval. Admins can use action safety settings, logs, allowlists, and approval queues to keep execution controlled.",
  },
  {
    question: "Who should we contact for a security report?",
    answer: (
      <>
        Send details to{" "}
        <a className="font-medium text-foreground underline underline-offset-4" href={`mailto:${SECURITY_EMAIL}`}>
          {SECURITY_EMAIL}
        </a>
        . Avoid sending passwords, full API keys, or unnecessary customer data by email.
      </>
    ),
  },
]

export default function SecurityPage() {
  return (
    <>
      <Header />
      <main className="bg-background">
        <SecurityHero />
        <SecurityOverview />
        <SecurityDetails />
        <MarketingFAQSection
          eyebrow="Security FAQ"
          title="Direct answers for security review."
          description="These are practical answers for teams evaluating workspace isolation, AI grounding, secrets, actions, and incident contact."
          faqs={SECURITY_FAQS}
          className="border-t border-b-0"
        />
        <IncidentContact />
      </main>
      <MarketingFooter />
    </>
  )
}

function SecurityHero() {
  return (
    <section className="border-b border-border bg-background py-16 md:py-20">
      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/25 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <ShieldCheckIcon className="size-3.5" />
              Security
            </div>
            <h1 className="mt-6 text-balance text-4xl font-medium tracking-tight text-foreground md:text-6xl">
              Security posture for AI support teams.
            </h1>
          </div>

          <div className="max-w-3xl lg:justify-self-end">
            <p className="text-base leading-8 text-muted-foreground md:text-lg">
              Tinfiz is designed with workspace isolation, controlled AI Actions, and human approval flows for
              sensitive operations. This page explains the current security model clearly and without overclaiming.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-full px-6">
                <a href={`mailto:${SECURITY_EMAIL}`}>Contact security</a>
              </Button>
              <Button asChild variant="outline" className="rounded-full bg-background px-6">
                <Link href="/privacy">Read privacy policy</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {SECURITY_PRINCIPLES.map((item) => {
            const Icon = item.icon

            return (
              <article key={item.title} className="border border-border bg-muted/15 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground">
                    <Icon className="size-4" />
                  </div>
                  <h2 className="text-sm font-medium text-foreground">{item.title}</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SecurityOverview() {
  return (
    <section className="border-b border-border bg-muted/10 py-12 md:py-16">
      <div className="mx-auto grid w-full max-w-[86rem] gap-6 px-4 md:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Security overview</p>
          <h2 className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Practical safeguards for support teams using AI.
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Security for an AI support product is not only login protection. It includes workspace boundaries, safe AI
            grounding, controlled API actions, access roles, and clear incident reporting.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Data ownership", "Your workspace owns the support content, contacts, conversations, and knowledge sources it adds."],
            ["Grounded answers", "AI should answer from approved workspace context and avoid unsupported claims when evidence is missing."],
            ["Action approval", "Sensitive write actions can require a human before the API request is executed."],
            ["Audit visibility", "Logs, timeline events, assignments, and notifications make operational activity easier to review."],
          ].map(([title, body]) => (
            <div key={title} className="border border-border bg-background p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckCircle2Icon className="size-4 text-primary" />
                {title}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SecurityDetails() {
  return (
    <section className="bg-background py-12 md:py-16">
      <div className="mx-auto grid w-full max-w-[86rem] gap-8 px-4 md:px-6 lg:grid-cols-[18rem_1fr] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 border border-border bg-muted/10 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">On this page</p>
            <nav className="mt-4 space-y-1">
              {SECURITY_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                >
                  {section.title}
                </a>
              ))}
              <a
                href="#incident-contact"
                className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
              >
                Incident contact
              </a>
            </nav>
          </div>
        </aside>

        <div className="grid gap-4">
          {SECURITY_SECTIONS.map((section) => {
            const Icon = section.icon

            return (
              <article id={section.id} key={section.id} className="scroll-mt-24 border-b border-border pb-8 last:border-b-0 md:pb-10">
                <div className="flex flex-col gap-5 md:flex-row md:items-start">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/25 text-foreground">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{section.eyebrow}</p>
                    <h2 className="mt-2 text-2xl font-medium tracking-tight text-foreground">{section.title}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{section.body}</p>
                    <ul className="mt-5 grid gap-2">
                      {section.points.map((point) => (
                        <li key={point} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                          <BadgeCheckIcon className="mt-1 size-4 shrink-0 text-primary" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function IncidentContact() {
  return (
    <section id="incident-contact" className="scroll-mt-24 border-t border-border bg-muted/10 py-12 md:py-16">
      <div className="mx-auto grid w-full max-w-[86rem] gap-6 px-4 md:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
        <div className="border border-border bg-background p-6 md:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-5" />
          </div>
          <h2 className="mt-6 text-3xl font-medium tracking-tight text-foreground">Report a security issue</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            If you believe you found a security issue in Tinfiz, contact us with enough detail to reproduce or assess
            the report. We will review and respond as quickly as we can.
          </p>
          <Button asChild className="mt-6 rounded-full px-7">
            <a href={`mailto:${SECURITY_EMAIL}`}>
              <MailIcon className="size-4" />
              {SECURITY_EMAIL}
            </a>
          </Button>
        </div>

        <div className="border border-border bg-background p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl border border-border bg-muted/35 text-foreground">
              <FingerprintIcon className="size-5" />
            </div>
            <h3 className="text-xl font-medium tracking-tight text-foreground">What to include</h3>
          </div>
          <ul className="mt-6 space-y-3">
            {INCIDENT_STEPS.map((step) => (
              <li key={step} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                <CheckCircle2Icon className="mt-1 size-4 shrink-0 text-primary" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 border border-border bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
            No system is 100% secure. This page describes the security posture Tinfiz is designed around and will be
            updated as the platform and controls mature.
          </div>
        </div>
      </div>
    </section>
  )
}

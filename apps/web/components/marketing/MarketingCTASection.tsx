import Link from "next/link"
import { ArrowRightIcon, BookOpenIcon, CheckCircle2Icon, MessageSquareTextIcon, WorkflowIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type CTAAction = {
  label: string
  href: string
}

type MarketingCTASectionProps = {
  eyebrow?: string
  title: string
  description: string
  primary: CTAAction
  secondary?: CTAAction
  note?: string
  className?: string
}

function ActionButton({ action, variant }: { action: CTAAction; variant?: "primary" | "secondary" }) {
  const isExternal = action.href.startsWith("http") || action.href.startsWith("mailto:")
  const className = cn("rounded-full px-7", variant === "secondary" && "bg-background/80")

  if (isExternal) {
    return (
      <Button asChild size="lg" variant={variant === "secondary" ? "outline" : "default"} className={className}>
        <a href={action.href}>
          {action.label}
          {variant !== "secondary" ? <ArrowRightIcon className="size-4" /> : null}
        </a>
      </Button>
    )
  }

  return (
    <Button asChild size="lg" variant={variant === "secondary" ? "outline" : "default"} className={className}>
      <Link href={action.href}>
        {action.label}
        {variant !== "secondary" ? <ArrowRightIcon className="size-4" /> : null}
      </Link>
    </Button>
  )
}

export function MarketingCTASection({
  eyebrow = "Next step",
  title,
  description,
  primary,
  secondary,
  note,
  className,
}: MarketingCTASectionProps) {
  const setupSteps = [
    {
      icon: MessageSquareTextIcon,
      title: "Install the widget",
      body: "Start with the customer-facing chat surface.",
    },
    {
      icon: BookOpenIcon,
      title: "Add knowledge",
      body: "Ground answers in your approved support content.",
    },
    {
      icon: WorkflowIcon,
      title: "Operate the inbox",
      body: "Route, assign, take over, measure, and improve.",
    },
  ] as const

  return (
    <section className={cn("bg-background py-16 md:py-20", className)}>
      <div className="mx-auto w-full max-w-[86rem] px-4 md:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-border bg-background">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-border p-6 md:p-8 lg:border-b-0 lg:border-r lg:p-10">
              <div className="inline-flex rounded-full border border-border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {eyebrow}
              </div>
              <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight text-foreground md:text-5xl">
                {title}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>

              {note ? (
                <div className="mt-7 flex max-w-xl items-start gap-3 rounded-2xl border border-border bg-muted/15 p-4 text-sm leading-6 text-muted-foreground">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{note}</span>
                </div>
              ) : null}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ActionButton action={primary} variant="primary" />
                {secondary ? <ActionButton action={secondary} variant="secondary" /> : null}
              </div>
            </div>

            <div className="bg-muted/10 p-6 md:p-8 lg:p-10">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Recommended path
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Simple enough for day one. Strong enough to scale.</p>
                </div>
                <span className="hidden rounded-full border border-primary/25 px-3 py-1 text-xs font-medium text-primary sm:inline-flex">
                  3 steps
                </span>
              </div>

              <div className="relative mt-7 space-y-6">
                <div className="absolute left-5 top-5 h-[calc(100%-2.5rem)] w-px bg-border" />
                {setupSteps.map((step, index) => {
                  const Icon = step.icon

                  return (
                    <div key={step.title} className="relative flex gap-4">
                      <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            0{index + 1}
                          </span>
                          <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

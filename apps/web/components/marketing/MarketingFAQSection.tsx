import type { ReactNode } from "react"

import { HelpCircleIcon, PlusIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export type MarketingFAQ = {
  question: string
  answer: ReactNode
}

type MarketingFAQSectionProps = {
  id?: string
  eyebrow?: string
  title: string
  description: string
  faqs: MarketingFAQ[]
  className?: string
}

export function MarketingFAQSection({
  id,
  eyebrow = "FAQ",
  title,
  description,
  faqs,
  className,
}: MarketingFAQSectionProps) {
  return (
    <section id={id} className={cn("border-y border-border bg-muted/10 py-16 md:py-20", className)}>
      <div className="mx-auto grid w-full max-w-[86rem] gap-8 px-4 md:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <HelpCircleIcon className="size-3.5" />
            {eyebrow}
          </div>
          <h2 className="mt-5 text-balance text-3xl font-medium tracking-tight text-foreground md:text-5xl">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>
        </div>

        <div className="rounded-[1.75rem] border border-border bg-background">
          {faqs.map((faq, index) => (
            <details
              key={faq.question}
              className="group border-b border-border px-5 py-5 last:border-b-0 md:px-6"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/25 text-muted-foreground transition group-open:rotate-45 group-open:text-primary">
                  <PlusIcon className="size-4" />
                </span>
              </summary>
              <div className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">{faq.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

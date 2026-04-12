'use client'

import { useInView } from '@/hooks/useInView'
import { cn } from '@workspace/ui/lib/utils'
import { UploadCloudIcon, ZapIcon, HeadphonesIcon, ArrowRightIcon } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    icon: UploadCloudIcon,
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    title: 'Connect your knowledge',
    description:
      'Paste docs URLs, upload PDFs, or write text notes. Tinfin learns your product in minutes — no training, no tagging.',
  },
  {
    number: '02',
    icon: ZapIcon,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'Install the widget',
    description:
      'One script tag. Works on any website, React app, or Next.js project. AI starts answering instantly.',
  },
  {
    number: '03',
    icon: HeadphonesIcon,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    title: 'Your team takes it from here',
    description:
      'Monitor conversations, take over from AI when needed, and review analytics. The AI handles the routine; your team handles the rest.',
  },
]

export function HowItWorksSection() {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.1 })

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="py-24 lg:py-32 bg-muted/30 border-y border-border/50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div
          className="text-center mb-16"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'none' : 'translateY(20px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/60 mb-4">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Live in under 5 minutes
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            No complex onboarding. No sales calls. Just results.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">

          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-12 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px border-t-2 border-dashed border-border/60" />

          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div
                key={i}
                className="relative flex flex-col items-center text-center"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'none' : 'translateY(28px)',
                  transition: `opacity 0.6s ease ${i * 150}ms, transform 0.6s ease ${i * 150}ms`,
                }}
              >
                {/* Step number + icon */}
                <div className="relative mb-6">
                  <div
                    className={cn(
                      'size-20 rounded-2xl flex items-center justify-center transition-transform duration-300 hover:scale-105',
                      step.iconBg,
                      'border border-border/40 shadow-sm'
                    )}
                  >
                    <Icon className={cn('size-8', step.iconColor)} />
                  </div>
                  {/* Step number badge */}
                  <div className="absolute -top-3 -right-3 size-7 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-bold shadow-md">
                    {i + 1}
                  </div>
                </div>

                <h3 className="text-base font-semibold mb-3">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                  {step.description}
                </p>

                {/* Arrow between steps (mobile) */}
                {i < STEPS.length - 1 && (
                  <ArrowRightIcon className="md:hidden size-5 text-border mt-6 rotate-90" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
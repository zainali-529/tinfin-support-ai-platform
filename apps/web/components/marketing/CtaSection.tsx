'use client'

import Link from 'next/link'
import { Button } from '@workspace/ui/components/button'
import { useInView } from '@/hooks/useInView'
import { ArrowRightIcon, SparklesIcon, ZapIcon } from 'lucide-react'

export function CtaSection() {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.2 })

  return (
    <section ref={ref} className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(var(--foreground)/0.05)_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Icon */}
        <div
          className="inline-flex size-16 items-center justify-center rounded-2xl bg-foreground text-background mb-8 shadow-2xl"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'none' : 'scale(0.8)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          <ZapIcon className="size-8" />
        </div>

        <h2
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-6"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'none' : 'translateY(20px)',
            transition: 'opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s',
          }}
        >
          Ready to transform
          <br />
          your support?
        </h2>

        <p
          className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'none' : 'translateY(16px)',
            transition: 'opacity 0.7s ease 0.2s, transform 0.7s ease 0.2s',
          }}
        >
          Join 500+ teams already using Tinfin to deflect 60% of tickets, delight
          customers, and free their agents for work that matters.
        </p>

        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'none' : 'translateY(12px)',
            transition: 'opacity 0.7s ease 0.3s, transform 0.7s ease 0.3s',
          }}
        >
          <Button size="lg" className="gap-2 w-full sm:w-auto shadow-lg" asChild>
            <Link href="/signup">
              <SparklesIcon className="size-4" />
              Start free — no credit card
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2" asChild>
            <Link href="/login">
              Sign in to your account
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </div>

        {/* Social proof strip */}
        <p
          className="mt-8 text-xs text-muted-foreground/60"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 0.7s ease 0.5s',
          }}
        >
          Free forever on the Starter plan · No setup fee · Cancel anytime
        </p>
      </div>
    </section>
  )
}
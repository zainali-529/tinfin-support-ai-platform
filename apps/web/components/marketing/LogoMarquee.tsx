'use client'

import { cn } from '@workspace/ui/lib/utils'

// Company name logos (text-based, styled)
const COMPANIES_ROW_1 = [
  { name: 'Shopify', color: '#96BF48' },
  { name: 'Stripe', color: '#635BFF' },
  { name: 'Notion', color: '#000000' },
  { name: 'Linear', color: '#5E6AD2' },
  { name: 'Vercel', color: '#000000' },
  { name: 'Figma', color: '#F24E1E' },
  { name: 'Supabase', color: '#3ECF8E' },
  { name: 'Tailwind', color: '#38B2AC' },
]

const COMPANIES_ROW_2 = [
  { name: 'Loom', color: '#625DF5' },
  { name: 'Webflow', color: '#4353FF' },
  { name: 'Framer', color: '#0055FF' },
  { name: 'Railway', color: '#0B0D0E' },
  { name: 'PlanetScale', color: '#000000' },
  { name: 'Render', color: '#46E3B7' },
  { name: 'Clerk', color: '#6C47FF' },
  { name: 'Resend', color: '#000000' },
]

function LogoItem({
  name,
  color,
}: {
  name: string
  color: string
}) {
  return (
    <div className="flex items-center justify-center px-8 shrink-0">
      <span
        className="text-sm font-bold tracking-wide opacity-40 hover:opacity-70 transition-opacity duration-200 cursor-default select-none"
        style={{ color }}
      >
        {name}
      </span>
    </div>
  )
}

function MarqueeRow({
  companies,
  reverse = false,
  speed = 28,
}: {
  companies: typeof COMPANIES_ROW_1
  reverse?: boolean
  speed?: number
}) {
  const doubled = [...companies, ...companies]

  return (
    <div className="flex overflow-hidden">
      <div
        className={cn(
          'flex whitespace-nowrap will-change-transform',
          reverse ? 'animate-marquee-reverse' : 'animate-marquee'
        )}
        style={{ animationDuration: `${speed}s` }}
      >
        {doubled.map((company, i) => (
          <LogoItem key={i} name={company.name} color={company.color} />
        ))}
      </div>
      {/* Duplicate for seamless loop */}
      <div
        className={cn(
          'flex whitespace-nowrap will-change-transform',
          reverse ? 'animate-marquee-reverse' : 'animate-marquee'
        )}
        style={{ animationDuration: `${speed}s` }}
        aria-hidden
      >
        {doubled.map((company, i) => (
          <LogoItem key={i} name={company.name} color={company.color} />
        ))}
      </div>
    </div>
  )
}

export function LogoMarquee() {
  return (
    <section className="py-16 border-y border-border/50 bg-muted/20 relative overflow-hidden">
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10 bg-gradient-to-l from-background to-transparent" />

      {/* Label */}
      <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/60 mb-10">
        Trusted by teams at
      </p>

      <div className="space-y-6">
        <MarqueeRow companies={COMPANIES_ROW_1} speed={30} />
        <MarqueeRow companies={COMPANIES_ROW_2} reverse speed={36} />
      </div>
    </section>
  )
}
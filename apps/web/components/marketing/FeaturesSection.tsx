'use client'

import { cn } from '@workspace/ui/lib/utils'
import { useInView } from '@/hooks/useInView'
import {
  MessageSquareIcon,
  PhoneCallIcon,
  BookOpenIcon,
  BarChart2Icon,
  UsersIcon,
  ZapIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from 'lucide-react'

// ─── Feature data ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: ZapIcon,
    title: 'AI Chat — out of the box',
    description:
      'Your support widget is live in under 2 minutes. Upload your docs, paste a URL, and the AI learns your product instantly.',
    accent: 'from-violet-500/20 to-transparent',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    large: true,
    extra: (
      // Mini chat preview inside card
      <div className="mt-4 rounded-xl border border-border/50 bg-background/60 p-3 space-y-2">
        <div className="flex items-end gap-2">
          <div className="size-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
            <ZapIcon className="size-3 text-violet-600" />
          </div>
          <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-1.5 text-[11px] max-w-[80%]">
            Hey! I can help with that — here's the answer from your docs 📄
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-foreground text-background rounded-xl rounded-br-sm px-3 py-1.5 text-[11px] max-w-[80%]">
            Wow, that was instant!
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: PhoneCallIcon,
    title: 'Voice calls with AI',
    description:
      'Visitors click to talk. Your AI picks up, answers questions, and hands off to a human if needed — all in real-time.',
    accent: 'from-blue-500/20 to-transparent',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    large: false,
  },
  {
    icon: BookOpenIcon,
    title: 'Knowledge base — zero effort',
    description:
      'Drop URLs, PDFs, or docs. Our RAG pipeline chunks, embeds, and retrieves the right answer every time.',
    accent: 'from-emerald-500/20 to-transparent',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    large: false,
  },
  {
    icon: UsersIcon,
    title: 'Team inbox — real-time',
    description:
      'Agents see all conversations live. Take over from AI with one click, reply, and resolve — no page refresh needed.',
    accent: 'from-amber-500/20 to-transparent',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    large: false,
  },
  {
    icon: BarChart2Icon,
    title: 'Analytics that actually help',
    description:
      'Track AI automation rate, resolution speed, contact growth, and voice minutes — all in one dashboard.',
    accent: 'from-rose-500/20 to-transparent',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    large: false,
    extra: (
      // Mini bar chart
      <div className="mt-4 flex items-end gap-1.5 h-14">
        {[40, 65, 55, 80, 70, 90, 85].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-rose-200 dark:bg-rose-900/40 transition-all duration-500"
            style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    ),
  },
  {
    icon: ShieldCheckIcon,
    title: 'Enterprise-ready security',
    description:
      'BYOK support, role-based access, org isolation, and Stripe-verified billing. Built right from day one.',
    accent: 'from-teal-500/20 to-transparent',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
    large: false,
  },
]

// ─── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  feature,
  index,
  inView,
}: {
  feature: (typeof FEATURES)[0]
  index: number
  inView: boolean
}) {
  const Icon = feature.icon

  return (
    <div
      className={cn(
        'feature-card group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300',
        'hover:border-border hover:shadow-xl hover:-translate-y-1',
        feature.large && 'lg:col-span-2'
      )}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${index * 80}ms, transform 0.6s ease ${index * 80}ms, box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease`,
      }}
    >
      {/* Background gradient on hover */}
      <div
        className={cn(
          'feature-icon-glow pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100',
          feature.accent
        )}
      />

      {/* Icon */}
      <div
        className={cn(
          'relative z-10 mb-4 flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
          feature.iconBg
        )}
      >
        <Icon className={cn('size-5', feature.iconColor)} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <h3 className="text-sm font-semibold mb-2 leading-snug">{feature.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
        {feature.extra && feature.extra}
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function FeaturesSection() {
  const [headRef, headInView] = useInView<HTMLDivElement>({ threshold: 0.2 })
  const [gridRef, gridInView] = useInView<HTMLDivElement>({ threshold: 0.05 })

  return (
    <section id="features" className="py-24 lg:py-32 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div
          ref={headRef}
          className="text-center mb-16"
          style={{
            opacity: headInView ? 1 : 0,
            transform: headInView ? 'none' : 'translateY(20px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
          }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-1.5 mb-6">
            <SparklesIcon className="size-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">
              Everything included
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            One platform.{' '}
            <span
              className="animate-gradient-shift bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 50%, hsl(var(--foreground)/0.6) 100%)',
                backgroundSize: '200% 200%',
              }}
            >
              Zero compromises.
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            From AI chat to live agent handoff to voice calls — every tool your team
            needs, already connected and working on day one.
          </p>
        </div>

        {/* ── Bento grid ── */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {/* First feature takes 2 columns on lg */}
          <FeatureCard feature={FEATURES[0]!} index={0} inView={gridInView} />
          <FeatureCard feature={FEATURES[1]!} index={1} inView={gridInView} />
          <FeatureCard feature={FEATURES[2]!} index={2} inView={gridInView} />
          <FeatureCard feature={FEATURES[3]!} index={3} inView={gridInView} />
          <FeatureCard feature={FEATURES[4]!} index={4} inView={gridInView} />
          <FeatureCard feature={FEATURES[5]!} index={5} inView={gridInView} />
        </div>
      </div>
    </section>
  )
}
"use client"

import Link from "next/link"
import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { ArrowUpIcon, MailIcon, SendIcon } from "lucide-react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

import { cn } from "@workspace/ui/lib/utils"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

const FOOTER_STYLES = `
.cinematic-footer-wrapper {
  -webkit-font-smoothing: antialiased;
}

@keyframes footer-scroll-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes footer-pulse-dot {
  0%, 100% { transform: scale(1); opacity: 0.72; }
  50% { transform: scale(1.35); opacity: 1; }
}

.animate-footer-scroll-marquee {
  animation: footer-scroll-marquee 40s linear infinite;
}

.animate-footer-pulse-dot {
  animation: footer-pulse-dot 2.2s ease-in-out infinite;
}

.footer-giant-bg-text {
  font-size: clamp(12rem, 28vw, 34rem);
  line-height: 0.75;
  font-weight: 900;
  letter-spacing: -0.06em;
  color: transparent;
  -webkit-text-stroke: 1px color-mix(in oklch, var(--foreground) 5%, transparent);
  background: linear-gradient(180deg, color-mix(in oklch, var(--foreground) 10%, transparent) 0%, transparent 62%);
  -webkit-background-clip: text;
  background-clip: text;
}

.footer-text-glow {
  background: linear-gradient(180deg, var(--foreground) 0%, color-mix(in oklch, var(--foreground) 42%, transparent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 20px color-mix(in oklch, var(--foreground) 15%, transparent));
}

@media (prefers-reduced-motion: reduce) {
  .animate-footer-scroll-marquee,
  .animate-footer-pulse-dot {
    animation: none !important;
  }
}
`

type MagneticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: React.ElementType
  }

const MagneticButton = React.forwardRef<HTMLElement, MagneticButtonProps>(
  ({ className, children, as: Component = "button", ...props }, forwardedRef) => {
    return (
      <Component
        ref={(node: HTMLElement | null) => {
          if (typeof forwardedRef === "function") forwardedRef(node)
          else if (forwardedRef) forwardedRef.current = node
        }}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
MagneticButton.displayName = "MagneticButton"

const MARQUEE_ITEMS = [
  "Grounded AI support",
  "Unified inbox",
  "Knowledge Base",
  "AI Actions",
  "CSAT Analytics",
  "Email, WhatsApp, Voice",
  "Human handoff",
  "SLA visibility",
]

const FOOTER_LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Contact", href: "/contact" },
  { label: "Security", href: "/security" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
] as const

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Unified inbox", href: "/#unified-inbox" },
      { label: "Grounded AI", href: "/#grounded-ai" },
      { label: "AI Actions", href: "/#ai-actions" },
      { label: "Channels", href: "/#channels" },
      { label: "Analytics and CSAT", href: "/#analytics-csat" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Pricing", href: "/pricing" },
      { label: "Book a demo", href: "/demo" },
      { label: "Contact", href: "/contact" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security contact", href: "mailto:security@tinfiz.ai" },
      { label: "Support docs", href: "/docs/getting-started/overview" },
    ],
  },
] as const

const SOCIAL_LINKS = [
  { label: "X", href: "https://x.com/tinfiz" },
  { label: "in", href: "https://www.linkedin.com/company/tinfiz" },
  { label: "GH", href: "https://github.com/tinfiz" },
] as const

function MarqueeItem() {
  return (
    <div className="flex items-center gap-12 px-6">
      {MARQUEE_ITEMS.map((item, index) => (
        <React.Fragment key={item}>
          <span>{item}</span>
          {index < MARQUEE_ITEMS.length - 1 ? <span className="text-primary/60">✦</span> : null}
        </React.Fragment>
      ))}
    </div>
  )
}

export function MarketingFooter() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const giantTextRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const linksRef = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!wrapperRef.current) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        giantTextRef.current,
        { y: "10vh", scale: 0.82, opacity: 0 },
        {
          y: "0vh",
          scale: 1,
          opacity: 1,
          ease: "power1.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 82%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      )

      gsap.fromTo(
        [headingRef.current, linksRef.current],
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 44%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      )
    }, wrapperRef)

    return () => ctx.revert()
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleUpdateRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = email.trim()
    if (!value) return

    const subject = encodeURIComponent("Tinfiz product updates")
    const body = encodeURIComponent(`Please add ${value} to Tinfiz product updates.`)
    setSubscribed(true)
    window.location.href = `mailto:hello@tinfiz.ai?subject=${subject}&body=${body}`
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FOOTER_STYLES }} />

      <div
        ref={wrapperRef}
        className="relative h-screen w-full"
        style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}
      >
        <footer className="cinematic-footer-wrapper fixed bottom-0 left-0 flex h-screen w-full flex-col justify-between overflow-hidden bg-background text-foreground">
          <div
            ref={giantTextRef}
            className="footer-giant-bg-text pointer-events-none absolute -bottom-[7vh] left-1/2 z-[1] -translate-x-1/2 select-none whitespace-nowrap md:-bottom-[8vh]"
          >
            TINFIZ
          </div>

          <div className="absolute left-0 top-12 z-10 w-full -rotate-2 scale-110 overflow-hidden border-y border-border/50 bg-background/60 py-4 shadow-2xl backdrop-blur-md">
            <div className="flex w-max animate-footer-scroll-marquee text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground md:text-sm">
              <MarqueeItem />
              <MarqueeItem />
            </div>
          </div>

          <div className="relative z-10 mx-auto mt-20 flex w-full max-w-[86rem] flex-1 flex-col justify-center px-4 pb-16 pt-10 sm:px-6 md:pb-20 md:pt-16 lg:px-8">
            <h2
              ref={headingRef}
              className="sr-only"
            >
              Tinfiz footer
            </h2>

            <div ref={linksRef} className="w-full border-y border-border py-8 md:py-10">
              <div className="grid gap-10 lg:grid-cols-[1.05fr_1.4fr]">
                <div>
                  <Link href="/" className="inline-flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl border border-border text-sm font-black text-primary">
                      T
                    </span>
                    <span className="text-2xl font-black tracking-tight text-foreground">Tinfiz</span>
                  </Link>

                  <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                    AI support workspace for grounded answers, realtime inbox operations, safe actions, channels,
                    CSAT, and human handoff.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {SOCIAL_LINKS.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex size-10 items-center justify-center rounded-full border border-border text-xs font-bold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                        aria-label={`Tinfiz on ${link.label}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <Link
                      href="mailto:hello@tinfiz.ai"
                      className="flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                      aria-label="Email Tinfiz"
                    >
                      <MailIcon className="size-4" />
                    </Link>
                  </div>

                  <form onSubmit={handleUpdateRequest} className="mt-6 max-w-md">
                    <label htmlFor="footer-email" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Product updates
                    </label>
                    <div className="mt-2 flex gap-2 rounded-full border border-border p-1">
                      <input
                        id="footer-email"
                        type="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value)
                          setSubscribed(false)
                        }}
                        placeholder="you@company.com"
                        className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        type="submit"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
                        aria-label="Request product updates"
                      >
                        <SendIcon className="size-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {subscribed
                        ? "Opening your email client so we can add you manually."
                        : "Low-volume updates about product improvements and setup guides."}
                    </p>
                  </form>
                </div>

                <div className="grid gap-6 sm:grid-cols-3">
                  {FOOTER_COLUMNS.map((column) => (
                    <div key={column.title}>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {column.title}
                      </h3>
                      <ul className="mt-4 space-y-3">
                        {column.links.map((link) => (
                          <li key={link.label}>
                            <Link
                              href={link.href}
                              className="text-sm text-muted-foreground transition hover:text-foreground"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex w-full flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                <div className="flex flex-wrap gap-2">
                {FOOTER_LINKS.map((link) => (
                  <MagneticButton
                    key={link.label}
                    as={Link}
                    href={link.href}
                    className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {link.label}
                  </MagneticButton>
                ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  hello@tinfiz.ai
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-20 flex w-full items-center justify-between gap-6 px-6 pb-24 md:px-12 md:pb-28">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground md:text-xs">
              © 2026 Tinfiz. All rights reserved.
            </div>

            <MagneticButton
              as="button"
              onClick={scrollToTop}
              className="ml-auto flex size-12 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              aria-label="Back to top"
            >
              <ArrowUpIcon className="size-5 transition-transform duration-300 group-hover:-translate-y-1.5" />
            </MagneticButton>
          </div>
        </footer>
      </div>
    </>
  )
}

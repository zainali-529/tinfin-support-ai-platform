"use client"

import Link from "next/link"
import type { CSSProperties } from "react"

import { ProductWorkflowPreview } from "@/components/marketing/ProductWorkflowSection"
import { Button } from "@workspace/ui/components/button"

const COLS = 16
const ROWS = 11
const CW = 100 / COLS
const CH = 100 / ROWS

type GridBlock = {
  c: number
  r: number
  w: number
  h: number
  tone: "primary" | "muted"
  delay?: string
  duration?: string
}

type GridBlockStyle = CSSProperties & {
  "--hero-block-delay": string
  "--hero-block-duration": string
}

const GRID_BLOCKS: GridBlock[] = [
  { c: 1, r: 2, w: 2, h: 1, tone: "primary", delay: "0ms", duration: "5.8s" },
  { c: 2, r: 3, w: 2, h: 1, tone: "primary", delay: "520ms", duration: "6.7s" },
  { c: 5, r: 1, w: 1, h: 1, tone: "primary", delay: "1180ms", duration: "6.2s" },
  { c: 10, r: 1, w: 1, h: 1, tone: "primary", delay: "240ms", duration: "5.9s" },
  { c: 11, r: 2, w: 2, h: 1, tone: "primary", delay: "900ms", duration: "7s" },
  { c: 13, r: 4, w: 2, h: 1, tone: "muted", delay: "1420ms", duration: "6.8s" },
  { c: 13, r: 5, w: 1, h: 1, tone: "muted", delay: "1840ms", duration: "6.1s" },
  { c: 2, r: 8, w: 2, h: 1, tone: "primary", delay: "320ms", duration: "6.4s" },
  { c: 12, r: 8, w: 1, h: 1, tone: "primary", delay: "1080ms", duration: "5.7s" },
  { c: 14, r: 8, w: 1, h: 1, tone: "muted", delay: "1540ms", duration: "6.5s" },
]

function blockBackground(block: GridBlock) {
  if (block.tone === "muted") {
    return "color-mix(in oklch, var(--muted-foreground) 7%, transparent)"
  }

  return "color-mix(in oklch, var(--primary) 12%, transparent)"
}

export default function HeroNoMediaSection() {
  return (
    <section className="relative isolate min-h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      <style>{`
        @keyframes hero-content-reveal {
          from {
            opacity: 0;
            transform: translateY(14px);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        .hero-content-reveal {
          animation: hero-content-reveal 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .hero-workflow-reveal {
          animation: hero-content-reveal 820ms cubic-bezier(0.22, 1, 0.36, 1) 140ms both;
        }

        @keyframes hero-grid-block-flicker {
          0%, 100% {
            opacity: 0.54;
            filter: saturate(0.9) brightness(0.98);
          }
          18% {
            opacity: 0.78;
            filter: saturate(1.02) brightness(1.02);
          }
          38% {
            opacity: 0.36;
            filter: saturate(0.84) brightness(0.96);
          }
          64% {
            opacity: 0.86;
            filter: saturate(1.06) brightness(1.03);
          }
          82% {
            opacity: 0.48;
            filter: saturate(0.92) brightness(0.98);
          }
        }

        .hero-grid-block {
          animation: hero-grid-block-flicker var(--hero-block-duration) ease-in-out var(--hero-block-delay) infinite alternate;
          will-change: opacity, filter;
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-content-reveal,
          .hero-workflow-reveal,
          .hero-grid-block {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20"
        style={{
          backgroundImage: [
            "linear-gradient(to right, color-mix(in oklch, var(--primary) 7%, transparent) 1px, transparent 1px)",
            "linear-gradient(to bottom, color-mix(in oklch, var(--primary) 7%, transparent) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: `${CW}vw ${CH}vh`,
        }}
      />

      {GRID_BLOCKS.map((block, index) => (
        <div
          key={`${block.c}-${block.r}-${index}`}
          aria-hidden="true"
          className="hero-grid-block absolute -z-10 select-none"
          style={
            {
            left: `${block.c * CW}vw`,
            top: `${block.r * CH}vh`,
            width: `${block.w * CW}vw`,
            height: `${block.h * CH}vh`,
            background: blockBackground(block),
            "--hero-block-delay": block.delay ?? "0ms",
            "--hero-block-duration": block.duration ?? "10s",
            } as GridBlockStyle
          }
        />
      ))}

      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 58% 42% at 50% 30%, oklch(from var(--background) l c h / 0.98) 0%, oklch(from var(--background) l c h / 0.9) 44%, oklch(from var(--background) l c h / 0) 76%)",
        }}
      />

      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[90rem] flex-col items-center px-4 pb-8 pt-10 text-center sm:px-6 sm:pt-12 lg:px-8 lg:pb-12 lg:pt-14">
        <div className="hero-content-reveal relative z-20 flex max-w-6xl flex-col items-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm sm:mb-5">
            Grounded AI support, human control, realtime visibility
          </div>

          <h1 className="max-w-5xl text-4xl font-bold leading-[1.04] tracking-tight text-balance sm:text-5xl md:text-6xl">
            <span className="text-primary">AI support</span>{" "}
            <span className="text-foreground">that </span>
            <span className="relative inline-block text-foreground">
              stays grounded
              <span
                aria-hidden="true"
                className="absolute left-0 right-0 rounded-full bg-foreground"
                style={{ height: "2px", bottom: "0.08em" }}
              />
            </span>
            <br />
            <span className="text-foreground">and keeps </span>
            <span className="text-primary">humans in control</span>
          </h1>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
            Tinfiz brings your website widget, unified inbox, knowledge base, AI actions, email, WhatsApp, voice, CSAT, and analytics into one calm support workspace.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild variant="outline" className="h-11 min-w-[142px] rounded-full bg-background/80 px-7 text-sm backdrop-blur-sm">
              <Link href="/docs">View docs</Link>
            </Button>
            <Button asChild className="h-11 min-w-[142px] rounded-full px-7 text-sm">
              <Link href="/signup">Start free</Link>
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Free plan available. No credit card required.
          </p>
        </div>

        <ProductWorkflowPreview
          variant="hero"
          className="hero-workflow-reveal relative z-20 mt-8 w-full max-w-[82rem] text-left sm:mt-9 lg:mt-10"
        />
      </div>
    </section>
  )
}

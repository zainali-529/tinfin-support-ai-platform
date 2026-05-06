"use client"

import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

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
}

type ProductShot = {
  src: string
  alt: string
  className: string
  cardClassName?: string
  imageClassName?: string
  delay: string
}

const GRID_BLOCKS: GridBlock[] = [
  { c: 1, r: 2, w: 2, h: 1, tone: "primary" },
  { c: 2, r: 3, w: 2, h: 1, tone: "primary" },
  { c: 5, r: 1, w: 1, h: 1, tone: "primary" },
  { c: 10, r: 1, w: 1, h: 1, tone: "primary" },
  { c: 11, r: 2, w: 2, h: 1, tone: "primary" },
  { c: 13, r: 4, w: 2, h: 1, tone: "muted" },
  { c: 13, r: 5, w: 1, h: 1, tone: "muted" },
  { c: 2, r: 8, w: 2, h: 1, tone: "primary" },
  { c: 12, r: 8, w: 1, h: 1, tone: "primary" },
  { c: 14, r: 8, w: 1, h: 1, tone: "muted" },
]

const PRODUCT_SHOTS: ProductShot[] = [
  {
    src: "/marketing/images/light/inbox.png",
    alt: "Tinfiz unified inbox interface",
    className:
      "left-0 top-[15%] z-10 w-[52rem] max-w-[52vw] -translate-x-[18%] rotate-[-1.2deg] opacity-80 sm:top-[11%] lg:opacity-[0.88]",
    delay: "180ms",
  },
  {
    src: "/marketing/images/light/analytics.png",
    alt: "Tinfiz analytics reporting interface",
    className:
      "right-0 top-[15%] z-10 w-[52rem] max-w-[52vw] translate-x-[18%] rotate-[1.2deg] opacity-80 sm:top-[11%] lg:opacity-[0.88]",
    delay: "260ms",
  },
  {
    src: "/marketing/images/light/dashboard.png",
    alt: "Tinfiz dashboard overview interface",
    className:
      "left-1/2 top-0 z-20 w-[48rem] max-w-[76vw] -translate-x-1/2 sm:max-w-[68vw] lg:max-w-[49rem]",
    cardClassName: "[filter:drop-shadow(0_34px_62px_rgba(15,23,42,0.22))_drop-shadow(0_14px_24px_rgba(15,23,42,0.12))]",
    delay: "90ms",
  },
]

function blockBackground(block: GridBlock) {
  if (block.tone === "muted") {
    return "color-mix(in oklch, var(--muted-foreground) 7%, transparent)"
  }

  return "color-mix(in oklch, var(--primary) 12%, transparent)"
}

function ProductScreenshot({ shot }: { shot: ProductShot }) {
  return (
    <div className={cn("absolute", shot.className)}>
      <div
        className={cn(
          "hero-shot-reveal [filter:drop-shadow(0_26px_46px_rgba(15,23,42,0.16))_drop-shadow(0_10px_18px_rgba(15,23,42,0.10))]",
          shot.cardClassName
        )}
        style={{ animationDelay: shot.delay }}
      >
        <img
          src={shot.src}
          alt={shot.alt}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className={cn("h-auto w-full select-none object-contain", shot.imageClassName)}
        />
      </div>
    </div>
  )
}

export default function HeroSection() {
  return (
    <section className="relative isolate min-h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      <link rel="preload" as="image" href="/marketing/images/light/dashboard.png" />
      <link rel="preload" as="image" href="/marketing/images/light/inbox.png" />
      <link rel="preload" as="image" href="/marketing/images/light/analytics.png" />

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

        @keyframes hero-shot-reveal {
          from {
            opacity: 0;
            transform: translateY(22px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .hero-content-reveal {
          animation: hero-content-reveal 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .hero-shot-reveal {
          animation: hero-shot-reveal 820ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-content-reveal,
          .hero-shot-reveal {
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
          className="absolute -z-10 select-none"
          style={{
            left: `${block.c * CW}vw`,
            top: `${block.r * CH}vh`,
            width: `${block.w * CW}vw`,
            height: `${block.h * CH}vh`,
            background: blockBackground(block),
          }}
        />
      ))}

      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 58% 42% at 50% 34%, oklch(from var(--background) l c h / 0.98) 0%, oklch(from var(--background) l c h / 0.88) 44%, oklch(from var(--background) l c h / 0) 76%)",
        }}
      />

      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[90rem] flex-col items-center px-4 pt-16 text-center sm:px-6 sm:pt-[4.5rem] lg:px-8 lg:pt-20">
        <div className="hero-content-reveal relative z-20 flex max-w-6xl flex-col items-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
            Grounded AI support, human control, realtime visibility
          </div>

          <h1 className="max-w-5xl text-5xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl md:text-7xl">
            <span className="text-primary">AI support</span>{" "}
            <span className="text-foreground">that </span>
            <span className="relative inline-block text-foreground" >
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

          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
            Tinfiz brings your website widget, unified inbox, knowledge base, AI actions, email, WhatsApp, voice, CSAT, and analytics into one calm support workspace.
          </p>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
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

        <div className="relative z-10 mt-12 h-[310px] w-full max-w-[88rem] sm:h-[390px] md:mt-14 md:h-[470px] lg:h-[545px] xl:h-[580px]">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 mx-auto h-[68%] max-w-6xl rounded-[999px] bg-primary/10 blur-3xl dark:bg-primary/[0.08]"
          />
          <div className="absolute inset-x-[-16%] bottom-0 h-28 bg-gradient-to-t from-background via-background/88 to-transparent sm:h-36" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-border/70" />

          {PRODUCT_SHOTS.map((shot) => (
            <ProductScreenshot key={shot.src} shot={shot} />
          ))}
        </div>
      </div>
    </section>
  )
}


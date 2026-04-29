"use client"

import { Button } from "@workspace/ui/components/button"

// ─── Grid Configuration ───────────────────────────────────────────────────────
// Grid is 14 cols × 10 rows — positioned using % of viewport so it's responsive
const COLS = 14
const ROWS = 10
const CW = 100 / COLS // vw per column cell
const CH = 100 / ROWS // vh per row cell

// ─── Block Definitions ────────────────────────────────────────────────────────
// c = col (0-based), r = row (0-based)
// w = colSpan, h = rowSpan
// op = opacity % (0–100) of primary color
// d = animation delay (s), t = animation duration (s)
// gradient = special feature block with diagonal gradient

interface GridBlock {
  c: number
  r: number
  w: number
  h: number
  op: number
  d: number
  t: number
  gradient?: boolean
  neutral?: boolean // muted/gray tinted block
}

const BLOCKS: GridBlock[] = [
  // ── Top area: col 5 single accent ──
  { c: 5,  r: 1, w: 1, h: 1, op: 18, d: 0.4, t: 3.6 },

  // ── Top-right feature cluster (darker, gradient) ──
  { c: 10, r: 1, w: 1, h: 1, op: 25, d: 0.0, t: 3.2 },
  { c: 10, r: 2, w: 2, h: 2, op: 40, d: 0.3, t: 4.8, gradient: true },

  // ── Top-left cluster ──
  { c: 1,  r: 2, w: 2, h: 1, op: 14, d: 0.6, t: 4.0 },
  { c: 1,  r: 3, w: 1, h: 2, op: 9,  d: 1.0, t: 4.5 },
  { c: 2,  r: 3, w: 1, h: 1, op: 13, d: 1.6, t: 3.8 },

  // ── Right-side subtle neutral blocks ──
  { c: 12, r: 4, w: 2, h: 1, op: 10, d: 2.0, t: 5.0, neutral: true },
  { c: 12, r: 5, w: 1, h: 1, op: 8,  d: 2.8, t: 4.5, neutral: true },

  // ── Mid-left accent ──
  { c: 1,  r: 6, w: 1, h: 1, op: 15, d: 3.2, t: 4.2 },

  // ── Center-lower subtle ──
  { c: 7,  r: 8, w: 1, h: 1, op: 10, d: 2.6, t: 4.8, neutral: true },

  // ── Far-right lower ──
  { c: 13, r: 7, w: 1, h: 1, op: 20, d: 0.9, t: 3.4 },

  // ── Bottom-left cluster ──
  { c: 2,  r: 8, w: 2, h: 1, op: 15, d: 0.2, t: 4.1 },
  { c: 2,  r: 9, w: 1, h: 1, op: 10, d: 2.0, t: 3.9 },

  // ── Bottom-right accents ──
  { c: 11, r: 8, w: 1, h: 1, op: 14, d: 1.4, t: 4.3 },
  { c: 12, r: 9, w: 1, h: 1, op: 11, d: 0.5, t: 3.6 },
]

// ─── Block Background Resolver ────────────────────────────────────────────────
function blockBg(b: GridBlock): string {
  if (b.neutral) {
    return `color-mix(in oklch, var(--muted-foreground) ${Math.round(b.op * 0.55)}%, transparent)`
  }
  if (b.gradient) {
    return `linear-gradient(148deg, color-mix(in oklch, var(--primary) ${b.op}%, transparent) 0%, color-mix(in oklch, var(--primary) ${Math.round(b.op * 0.38)}%, transparent) 100%)`
  }
  return `color-mix(in oklch, var(--primary) ${b.op}%, transparent)`
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HeroSection() {
  return (
    <>
      {/* Keyframes injected once — SSR-safe in a client component */}
      <style>{`
        @keyframes hero-block-pulse {
          0%,  100% { opacity: 0; }
          30%, 70%  { opacity: 1; }
        }
        @keyframes hero-block-flicker {
          0%         { opacity: 0; }
          8%         { opacity: 1; }
          22%        { opacity: 0.35; }
          38%        { opacity: 1; }
          88%, 100%  { opacity: 0; }
        }
      `}</style>

      <section className="relative min-h-screen overflow-hidden bg-background">

        {/* ── Grid lines (start at very top, covered by nav's solid bg) ── */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none select-none"
          style={{
            backgroundImage: [
              `linear-gradient(to right, color-mix(in oklch, var(--primary) 5%, transparent) 1px, transparent 1px)`,
              `linear-gradient(to bottom, color-mix(in oklch, var(--primary) 5%, transparent) 1px, transparent 1px)`,
            ].join(", "),
            backgroundSize: `${CW}vw ${CH}vh`,
          }}
        />

        {/* ── Animated grid blocks ── */}
        {BLOCKS.map((b, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="absolute pointer-events-none select-none"
            style={{
              left:       `${b.c * CW}vw`,
              top:        `${b.r * CH}vh`,
              width:      `${b.w * CW}vw`,
              height:     `${b.h * CH}vh`,
              background: blockBg(b),
              // Gradient block gets a subtle flicker, others pulse smoothly
              animation: b.gradient
                ? `hero-block-flicker ${b.t + 1.5}s ease-in-out ${b.d}s infinite`
                : `hero-block-pulse ${b.t}s ease-in-out ${b.d}s infinite`,
            }}
          />
        ))}

        {/* ── Center radial glow — feathered clearing for content ── */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none select-none"
          style={{
            background: [
              // Core — fully opaque background colour
              `radial-gradient(ellipse 62% 48% at 50% 56%,`,
              `  oklch(from var(--background) l c h / 1) 10%,`,
              `  oklch(from var(--background) l c h / 0.88) 38%,`,
              `  oklch(from var(--background) l c h / 0.50) 58%,`,
              `  oklch(from var(--background) l c h / 0) 76%`,
              `)`,
            ].join(" "),
          }}
        />

        {/* ── Hero content — vertically centred in remaining viewport ── */}
        <div className="relative z-20 flex min-h-[calc(100vh-4rem)] w-full items-center justify-center px-4 py-16 text-center">
          <div className="mx-auto flex w-full max-w-[86rem] flex-col items-center">

          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 backdrop-blur-sm px-4 py-1.5 text-xs text-muted-foreground mb-8">
            Manage Your AI on Your Own
          </div>

          {/* Headline */}
          <h1 className="max-w-4xl lg:max-w-6xl xl:max-w-7xl text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.1] mb-6">
            {/* "Support" — primary colour */}
            <span className="text-primary">Support</span>
            {" "}

            {/* "that" — foreground */}
            <span className="text-foreground">that </span>

            {/* "works" — foreground + underline */}
            <span className="relative inline-block text-foreground">
              works
              <span
                aria-hidden="true"
                className="absolute left-0 right-0 bg-foreground rounded-full"
                style={{ height: "2px", bottom: "0.08em" }}
              />
            </span>

            <br />

            {/* "while you" — foreground */}
            <span className="text-foreground">while you </span>

            {/* "sleep" — primary colour */}
            <span className="text-primary">sleep</span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-xl lg:max-w-3xl text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed mb-10">
            It is a long established fact that a reader will be distracted by the
            readable content of a page when looking at its layout. The point of
            using Lorem Ipsum is that it has a more-or-less normal distribution
            of letters, as opposed to using &lsquo;Content here
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 lg:gap-6">
            <Button variant="outline" className="min-w-[128px] lg:min-w-[160px] lg:h-12 lg:text-lg rounded-full">
              Explore us
            </Button>
            <Button className="min-w-[128px] lg:min-w-[160px] lg:h-12 lg:text-lg rounded-full">
              Free Trial
            </Button>
          </div>
          </div>
        </div>
      </section>
    </>
  )
}

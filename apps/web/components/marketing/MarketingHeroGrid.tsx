import type { CSSProperties } from "react"

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

function blockBackground(block: GridBlock) {
  if (block.tone === "muted") {
    return "color-mix(in oklch, var(--muted-foreground) 7%, transparent)"
  }

  return "color-mix(in oklch, var(--primary) 12%, transparent)"
}

export function MarketingHeroGrid({ className, softenCenter = true }: { className?: string; softenCenter?: boolean }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-0 opacity-[0.34]"
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
          className="absolute select-none"
          style={
            {
              left: `${block.c * CW}vw`,
              top: `${block.r * CH}vh`,
              width: `${block.w * CW}vw`,
              height: `${block.h * CH}vh`,
              background: blockBackground(block),
            } satisfies CSSProperties
          }
        />
      ))}

      {softenCenter ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 58% 42% at 50% 34%, oklch(from var(--background) l c h / 0.98) 0%, oklch(from var(--background) l c h / 0.88) 44%, oklch(from var(--background) l c h / 0) 76%)",
          }}
        />
      ) : null}
    </div>
  )
}

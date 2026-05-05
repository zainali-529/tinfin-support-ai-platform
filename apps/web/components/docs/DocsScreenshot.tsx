"use client"

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, ImageIcon, ZoomIn } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog'

type LoadState = 'themed' | 'fallback' | 'failed'

function getThemedScreenshotPath(src: string, theme: 'light' | 'dark') {
  const normalized = src
    .replace('/docs-assets/screenshots/light/', '/docs-assets/screenshots/')
    .replace('/docs-assets/screenshots/dark/', '/docs-assets/screenshots/')

  return normalized.replace('/docs-assets/screenshots/', `/docs-assets/screenshots/${theme}/`)
}

export function DocsScreenshot({
  title,
  description,
  src,
}: {
  title: string
  description: string
  src: string
}) {
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const [loadState, setLoadState] = useState<LoadState>('themed')
  const themedSrc = useMemo(() => getThemedScreenshotPath(src, theme), [src, theme])
  const lightSrc = useMemo(() => getThemedScreenshotPath(src, 'light'), [src])
  const darkSrc = useMemo(() => getThemedScreenshotPath(src, 'dark'), [src])
  const activeSrc = loadState === 'fallback' ? src : themedSrc

  useEffect(() => {
    setLoadState('themed')
  }, [themedSrc])

  if (loadState === 'failed') {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/10 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
            <ImageIcon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Screenshot placeholder: {title}</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-3 space-y-2 rounded-lg border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
              <div>Light image: {lightSrc}</div>
              <div>Dark image: {darkSrc}</div>
              <div>Optional fallback: {src}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const image = (
    <img
      src={activeSrc}
      alt={title}
      className="size-full object-contain"
      onError={() => setLoadState((current) => (current === 'themed' ? 'fallback' : 'failed'))}
    />
  )

  return (
    <Dialog>
      <figure className="overflow-hidden rounded-xl border border-border bg-background">
        <DialogTrigger asChild>
          <button
            type="button"
            className="group relative block w-full cursor-zoom-in bg-muted/20 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Open ${title} screenshot`}
          >
            <span className="relative block aspect-[1902/941]">
              {image}
            </span>
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
                <ZoomIn className="size-3.5" />
                Click to zoom
              </span>
            </span>
          </button>
        </DialogTrigger>
      </figure>

      <DialogContent className="max-h-[94vh] overflow-hidden p-0 sm:max-w-[94vw]" showCloseButton>
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3 pr-12">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">{loadState === 'fallback' ? 'Fallback image' : `${theme} mode screenshot`}</div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={activeSrc} target="_blank" rel="noreferrer">
              Open full size
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
        <div className="max-h-[calc(94vh-58px)] overflow-auto bg-muted/20 p-3">
          <img
            src={activeSrc}
            alt={title}
            className="mx-auto h-auto max-h-none w-auto max-w-full rounded-lg border bg-background"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

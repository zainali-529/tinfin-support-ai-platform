"use client"

import { useState } from 'react'
import { ImageIcon } from 'lucide-react'

export function DocsScreenshot({
  title,
  description,
  src,
}: {
  title: string
  description: string
  src: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/10 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
            <ImageIcon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Screenshot placeholder: {title}</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-3 rounded-lg border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
              Add image at: {src}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="relative aspect-[16/9] bg-muted/20">
        <img
          src={src}
          alt={title}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
      <figcaption className="border-t bg-muted/10 px-4 py-3">
        <div className="flex items-start gap-3">
          <ImageIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{title}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
        </div>
      </figcaption>
    </figure>
  )
}

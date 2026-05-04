"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Search } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { DocsSearchDialog } from './DocsSearchDialog'

export function DocsSearchLauncher({
  className,
  showDocsButton = true,
  compact = false,
}: {
  className?: string
  showDocsButton?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (!isSearchShortcut) return

      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showDocsButton ? (
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link href="/docs">
            <BookOpen className="size-3.5" />
            Docs
          </Link>
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'default'}
        onClick={() => setOpen(true)}
        className={cn(
          'justify-start border-border/80 bg-background text-muted-foreground hover:text-foreground',
          compact ? 'h-8 w-9 px-0 sm:w-56 sm:px-2.5' : 'h-9 w-full min-w-0 sm:w-72'
        )}
      >
        <Search className="size-3.5" />
        <span className={cn('truncate', compact ? 'hidden sm:inline' : 'inline')}>Search docs</span>
        <span className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
          Ctrl K
        </span>
      </Button>

      <DocsSearchDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

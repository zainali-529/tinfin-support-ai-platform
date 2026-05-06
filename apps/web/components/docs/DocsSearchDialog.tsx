"use client"

import { useRouter } from 'next/navigation'
import { BookOpen, FileText, Search } from 'lucide-react'

import { docsSearchItems, docsSections } from '@/lib/docs'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@workspace/ui/components/command'

export function DocsSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search documentation"
      description="Search guides, setup steps, troubleshooting, and product checklists."
      className="top-[14vh] w-[calc(100vw-2rem)] max-w-5xl translate-y-0 border-border/80 p-0 sm:max-w-5xl"
      showCloseButton
    >
      <Command className="rounded-xl border-0 bg-background">
        <div className="border-b px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border bg-muted/40">
              <BookOpen className="size-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Search documentation</div>
              <div className="text-xs text-muted-foreground">Jump to setup, widget, inbox, AI, channels, billing, and product guides.</div>
            </div>
          </div>
          <CommandInput placeholder="Search docs, setup steps, channels, billing..." />
        </div>
        <CommandList className="max-h-[68vh] p-3">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
              <Search className="size-5" />
              <span>No docs found. Try searching for widget, billing, SLA, WhatsApp, or AI.</span>
            </div>
          </CommandEmpty>
          {docsSections.map((section) => {
            const items = docsSearchItems.filter((item) => item.section === section.title)
            if (items.length === 0) return null

            return (
              <CommandGroup key={section.title} heading={section.title}>
                {items.map((item) => (
                  <CommandItem
                    key={item.slug}
                    value={item.value}
                    onSelect={() => {
                      onOpenChange(false)
                      router.push(item.href)
                    }}
                    className="items-start gap-3 rounded-xl px-3 py-3"
                  >
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
                      <FileText className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                      <div className="line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

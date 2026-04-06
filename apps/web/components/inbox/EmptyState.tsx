import { InboxIcon, MessageSquarePlusIcon } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/10 text-center">
      <div className="relative flex size-16 items-center justify-center">
        <div className="absolute inset-0 rounded-2xl bg-primary/8" />
        <div className="relative flex size-12 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border">
          <InboxIcon className="size-6 text-muted-foreground opacity-60" />
        </div>
      </div>

      <div className="max-w-xs">
        <p className="text-sm font-semibold text-foreground">Select a conversation</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Choose a conversation from the left panel to view messages and reply to your customers.
        </p>
      </div>

      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
        <MessageSquarePlusIcon className="size-3.5" />
        New conversation
      </Button>
    </div>
  )
}
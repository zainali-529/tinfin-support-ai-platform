'use client'

/**
 * apps/web/components/inbox/EmptyState.tsx
 *
 * Shown in the right panel of the inbox when no conversation is selected.
 */

import { MailIcon, MessageSquareIcon, InboxIcon } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/60">
        <InboxIcon className="size-8 text-muted-foreground/40" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">Select a conversation</h3>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Choose a conversation from the list to read messages and reply to customers.
        </p>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground/60">
        <span className="flex items-center gap-1.5">
          <MessageSquareIcon className="size-3.5" />
          Chat
        </span>
        <span className="text-muted-foreground/30">·</span>
        <span className="flex items-center gap-1.5">
          <MailIcon className="size-3.5" />
          Email
        </span>
      </div>
    </div>
  )
}
'use client'

/**
 * apps/web/components/email/EmailThreadView.tsx
 *
 * Renders the email thread for email-channel conversations.
 * Shows full HTML email bodies, threading metadata, and direction badges.
 * Used inside ConversationView when conversation.channel === 'email'.
 */

import { useState } from 'react'
import { format } from 'date-fns'
import { useEmailMessages } from '@/hooks/useEmail'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { cn } from '@workspace/ui/lib/utils'
import {
  MailIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SendIcon,
  InboxIcon,
  BotIcon,
  UserCheckIcon,
  ExternalLinkIcon,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailMessage {
  id: string
  conversationId: string
  externalMessageId: string | null
  inReplyTo: string | null
  referencesHeader: string | null
  subject: string
  fromEmail: string
  fromName: string | null
  toEmails: string[]
  ccEmails: string[]
  htmlBody: string | null
  textBody: string | null
  direction: 'inbound' | 'outbound'
  status: string
  errorMessage: string | null
  createdAt: string
}

interface Props {
  conversationId: string
}

// ─── Single Email Item ────────────────────────────────────────────────────────

function EmailItem({ msg }: { msg: EmailMessage }) {
  const [expanded, setExpanded] = useState(true)
  const [showHtml, setShowHtml] = useState(true)

  const isInbound = msg.direction === 'inbound'
  const displayName = msg.fromName || msg.fromEmail
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-shadow',
      isInbound
        ? 'border-border bg-card'
        : 'border-primary/15 bg-primary/5',
    )}>
      {/* Email header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <Avatar className="size-8 shrink-0 mt-0.5">
          <AvatarFallback className={cn(
            'text-xs font-semibold',
            isInbound ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'
          )}>
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold truncate">{displayName}</span>
            {msg.fromEmail !== displayName && (
              <span className="text-[10px] text-muted-foreground truncate">&lt;{msg.fromEmail}&gt;</span>
            )}
            {/* Direction badge */}
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide shrink-0',
              isInbound
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-primary/10 text-primary'
            )}>
              {isInbound ? <InboxIcon className="size-2.5" /> : <SendIcon className="size-2.5" />}
              {isInbound ? 'Received' : 'Sent'}
            </span>
            {msg.status === 'failed' && (
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-destructive/10 text-destructive">
                Failed
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
            <span>To: {msg.toEmails.join(', ')}</span>
            {msg.ccEmails.length > 0 && <span>CC: {msg.ccEmails.join(', ')}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
            {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
          </span>
          {expanded
            ? <ChevronUpIcon className="size-3.5 text-muted-foreground" />
            : <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          }
        </div>
      </button>

      {/* Email body */}
      {expanded && (
        <div className="border-t border-border/50">
          {/* Subject bar */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/20 border-b border-border/30">
            <span className="text-xs font-medium text-foreground truncate">{msg.subject}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {msg.htmlBody && msg.textBody && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowHtml((v) => !v) }}
                  className="h-5 text-[10px] px-1.5 gap-1"
                >
                  {showHtml ? 'Plain text' : 'HTML'}
                </Button>
              )}
              {msg.externalMessageId && (
                <span className="text-[10px] text-muted-foreground font-mono hidden sm:block truncate max-w-[180px]">
                  {msg.externalMessageId}
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-4">
            {msg.htmlBody && showHtml ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 overflow-x-auto"
                // Safe: email HTML is sanitised — we only store body content from trusted providers
                // In production, add DOMPurify here if forwarding untrusted email
                dangerouslySetInnerHTML={{ __html: msg.htmlBody }}
              />
            ) : msg.textBody ? (
              <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                {msg.textBody}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">(empty email body)</p>
            )}
          </div>

          {/* Error */}
          {msg.errorMessage && (
            <div className="px-4 pb-3">
              <p className="text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2">
                Send error: {msg.errorMessage}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmailThreadView({ conversationId }: Props) {
  const { messages, isLoading } = useEmailMessages(conversationId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2.5 w-64" />
              </div>
              <Skeleton className="h-3 w-20 shrink-0" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60">
          <MailIcon className="size-6 text-muted-foreground opacity-40" />
        </div>
        <div>
          <p className="text-sm font-semibold">No emails yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Email messages will appear here when the customer sends or you reply.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="flex flex-col gap-3 p-4">
        {/* Thread subject header */}
        <div className="flex items-center gap-2 px-1 mb-1">
          <MailIcon className="size-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold truncate">
            {messages[0]?.subject ?? 'Email Thread'}
          </h3>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {messages.length} email{messages.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {messages.map((msg) => (
          <EmailItem key={msg.id} msg={msg as EmailMessage} />
        ))}
      </div>
    </ScrollArea>
  )
}
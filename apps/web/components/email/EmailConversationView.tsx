'use client'

/**
 * apps/web/components/email/EmailConversationView.tsx
 *
 * Full right-panel view for email-channel conversations.
 * Replaces the chat ConversationView when conversation.channel === 'email'.
 *
 * Features:
 *  - Email thread with HTML rendering
 *  - Reply composer with auto-threading
 *  - Take over / resolve / release actions (same as chat)
 */

import { useCallback } from 'react'
import { format } from 'date-fns'
import { EmailThreadView } from './EmailThreadView'
import { EmailReplyComposer } from './EmailReplyComposer'
import { Button } from '@workspace/ui/components/button'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'
import { createClient } from '@/lib/supabase'
import {
  MailIcon,
  CheckCircleIcon,
  UserCheckIcon,
  RefreshCwIcon,
  MoreHorizontalIcon,
  UserIcon,
  TagIcon,
  ArrowUpRightIcon,
  PhoneIcon,
} from 'lucide-react'
import type { Conversation } from '@/types/database'

// ─── Status styles ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  bot:      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  pending:  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  open:     'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  resolved: 'bg-muted text-muted-foreground border-border',
  closed:   'bg-muted text-muted-foreground border-border',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  conversation: Conversation
  orgId: string
  agentId: string
  onStatusChange?: (id: string, status: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailConversationView({ conversation, orgId, agentId, onStatusChange }: Props) {
  const contact = conversation.contacts
  const status = conversation.status
  const isResolved = status === 'resolved' || status === 'closed'

  const toEmail = contact?.email ?? null

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleTakeover = useCallback(async () => {
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ status: 'open', assigned_to: agentId })
      .eq('id', conversation.id)
    onStatusChange?.(conversation.id, 'open')
  }, [agentId, conversation.id, onStatusChange])

  const handleRelease = useCallback(async () => {
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ status: 'pending', assigned_to: null })
      .eq('id', conversation.id)
    onStatusChange?.(conversation.id, 'pending')
  }, [conversation.id, onStatusChange])

  const handleResolve = useCallback(async () => {
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ status: 'resolved' })
      .eq('id', conversation.id)
    onStatusChange?.(conversation.id, 'resolved')
  }, [conversation.id, onStatusChange])

  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.resolved

  return (
    <div className="flex h-full flex-col bg-background">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b bg-card/50 px-5 py-3 shrink-0">
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="text-sm font-semibold">
            {(contact?.name ?? contact?.email ?? '?').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate text-sm font-semibold">
              {contact?.name ?? contact?.email ?? 'Anonymous'}
            </p>
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', statusStyle)}>
              <MailIcon className="size-2.5" />
              Email · {status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {contact?.email && (
              <span className="flex items-center gap-1 truncate max-w-[200px]">
                <MailIcon className="size-3 shrink-0" />
                {contact.email}
              </span>
            )}
            {contact?.phone && (
              <span className="flex items-center gap-1">
                <PhoneIcon className="size-3" />
                {contact.phone}
              </span>
            )}
            <span className="text-muted-foreground/60">
              {format(new Date(conversation.started_at), 'MMM d, h:mm a')}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              {(status === 'pending' || status === 'bot') ? (
                <Button
                  size="sm"
                  onClick={handleTakeover}
                  className="h-7 gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0"
                >
                  <UserCheckIcon className="size-3.5" />
                  Take Over
                </Button>
              ) : status === 'open' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRelease}
                  className="h-7 gap-1.5 text-xs"
                >
                  <RefreshCwIcon className="size-3.5" />
                  Release
                </Button>
              ) : (
                <span />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {status === 'open' ? 'Return to pending queue' : 'Assign to yourself and reply'}
            </TooltipContent>
          </Tooltip>

          {!isResolved && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResolve}
                  className="h-7 gap-1.5 text-xs"
                >
                  <CheckCircleIcon className="size-3.5" />
                  Resolve
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark as resolved</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem>
                <UserIcon className="mr-2 size-3.5" /> Assign agent
              </DropdownMenuItem>
              <DropdownMenuItem>
                <TagIcon className="mr-2 size-3.5" /> Add label
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ArrowUpRightIcon className="mr-2 size-3.5" /> View contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Status banners ── */}
      {status === 'pending' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900 px-4 py-2 flex items-center justify-between shrink-0">
          <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <MailIcon className="size-3.5" />
            New email — waiting for an agent to take over.
          </p>
          <Button
            size="sm"
            onClick={handleTakeover}
            className="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-700 text-white border-0"
          >
            Take Over
          </Button>
        </div>
      )}
      {isResolved && (
        <div className="bg-muted/50 border-b px-4 py-2 shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            ✅ This conversation is resolved.
          </p>
        </div>
      )}

      {/* ── Email thread ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <EmailThreadView conversationId={conversation.id} />
      </div>

      {/* ── Reply composer ── */}
      <EmailReplyComposer
        conversationId={conversation.id}
        status={status}
        toEmail={toEmail}
      />
    </div>
  )
}
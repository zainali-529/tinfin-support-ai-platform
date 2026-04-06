'use client'

import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { cn } from '@workspace/ui/lib/utils'
import {
  SendIcon,
  BotIcon,
  CheckCircleIcon,
  PhoneIcon,
  MailIcon,
  ZapIcon,
  MoreHorizontalIcon,
  UserIcon,
  TagIcon,
  ArrowUpRightIcon,
  SmileIcon,
  PaperclipIcon,
} from 'lucide-react'
import { useMessages } from '@/hooks/useMessages'
import type { Conversation } from '@/types/database'

const STATUS_STYLES = {
  bot: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  open: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  resolved: 'bg-muted text-muted-foreground border-border',
  closed: 'bg-muted text-muted-foreground border-border',
}

function formatMessageTime(date: Date) {
  if (isToday(date)) return format(date, 'h:mm a')
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, h:mm a')
}

interface Props {
  conversation: Conversation
  orgId: string
  agentId: string
}

export function ConversationView({ conversation, orgId, agentId }: Props) {
  const { messages, loading, sending, sendMessage } = useMessages(conversation.id, orgId)
  const [reply, setReply] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const contact = conversation.contacts

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = reply.trim()
    if (!text || sending) return
    setReply('')
    await sendMessage(text, agentId)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  const statusStyle = STATUS_STYLES[conversation.status] ?? STATUS_STYLES.resolved

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Conversation Header */}
      <div className="flex items-center gap-3 border-b bg-card/50 px-5 py-3">
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="text-sm font-semibold">
            {contact?.name?.slice(0, 2).toUpperCase() ||
              contact?.email?.slice(0, 2).toUpperCase() ||
              '??'}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {contact?.name || contact?.email || 'Anonymous Visitor'}
            </p>
            <span className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              statusStyle
            )}>
              {conversation.status === 'bot' && <ZapIcon className="mr-1 size-2.5" />}
              {conversation.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {contact?.email && (
              <span className="flex items-center gap-1 truncate">
                <MailIcon className="size-3 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </span>
            )}
            {contact?.phone && (
              <span className="flex items-center gap-1">
                <PhoneIcon className="size-3" />
                {contact.phone}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {conversation.status !== 'resolved' && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                    <CheckCircleIcon className="size-3.5" />
                    Resolve
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark as resolved</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem>
                <UserIcon className="mr-2 size-3.5" />
                Assign agent
              </DropdownMenuItem>
              <DropdownMenuItem>
                <TagIcon className="mr-2 size-3.5" />
                Add label
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ArrowUpRightIcon className="mr-2 size-3.5" />
                View contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-4 py-4">
          {loading ? (
            <MessageSkeletons />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <BotIcon className="size-5 text-muted-foreground opacity-40" />
              </div>
              <p className="text-sm text-muted-foreground">No messages yet</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              const isAgent = msg.role === 'agent'
              const isOutbound = isUser || isAgent
              const prevMsg = messages[idx - 1]
              const showTimeDivider = !prevMsg ||
                new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300_000

              return (
                <div key={msg.id}>
                  {showTimeDivider && (
                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] text-muted-foreground/60">
                        {formatMessageTime(new Date(msg.created_at))}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  <div className={cn('flex gap-2 py-0.5', isOutbound ? 'flex-row-reverse' : '')}>
                    {/* Avatar */}
                    {!isOutbound && (
                      <Avatar className="mt-auto size-6 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {msg.role === 'assistant' ? (
                            <BotIcon className="size-3" />
                          ) : 'S'}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {/* Bubble */}
                    <div className={cn(
                      'flex max-w-[75%] flex-col gap-1',
                      isOutbound ? 'items-end' : 'items-start'
                    )}>
                      {/* Role label */}
                      {!isUser && (
                        <span className="px-0.5 text-[10px] font-medium text-muted-foreground/60 capitalize">
                          {msg.role === 'assistant' ? 'AI Assistant' : msg.role}
                        </span>
                      )}

                      <div className={cn(
                        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                        isUser
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : isAgent
                            ? 'rounded-br-sm bg-emerald-600 text-white'
                            : 'rounded-bl-sm bg-muted/80 text-foreground ring-1 ring-border/50'
                      )}>
                        {msg.content}
                      </div>

                      <span className="px-0.5 text-[10px] tabular-nums text-muted-foreground/50">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Reply Box */}
      <div className="border-t bg-card/50 p-3">
        <div className="rounded-xl border bg-background ring-1 ring-border/50 transition-shadow focus-within:ring-2 focus-within:ring-ring/30">
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 border-b px-2 py-1.5">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                    <SmileIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Emoji</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                    <PaperclipIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach file</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <span className="text-[11px] text-muted-foreground/60">Reply as Agent</span>
          </div>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            placeholder="Type your reply... (⌘+Enter to send)"
            className="min-h-[80px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0"
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={handleKey}
          />

          {/* Footer */}
          <div className="flex items-center justify-between px-3 pb-2.5">
            <p className="text-[11px] text-muted-foreground/50">
              ⌘+Enter to send
            </p>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!reply.trim() || sending}
              className="h-7 gap-1.5 px-3 text-xs"
            >
              {sending ? (
                <>
                  <div className="size-3 animate-spin rounded-full border border-primary-foreground/30 border-t-primary-foreground" />
                  Sending...
                </>
              ) : (
                <>
                  <SendIcon className="size-3" />
                  Send Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageSkeletons() {
  return (
    <div className="flex flex-col gap-4 py-2">
      {[
        { side: 'left', width: 'w-52' },
        { side: 'right', width: 'w-40' },
        { side: 'left', width: 'w-64' },
        { side: 'right', width: 'w-36' },
        { side: 'left', width: 'w-48' },
      ].map((item, i) => (
        <div key={i} className={cn('flex gap-2', item.side === 'right' ? 'flex-row-reverse' : '')}>
          {item.side === 'left' && <Skeleton className="size-6 shrink-0 rounded-full" />}
          <Skeleton className={cn('h-10 rounded-2xl', item.width)} />
        </div>
      ))}
    </div>
  )
}
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { cn } from '@workspace/ui/lib/utils'
import {
  SendIcon, BotIcon, CheckCircleIcon, PhoneIcon, MailIcon,
  ZapIcon, MoreHorizontalIcon, UserIcon, TagIcon,
  ArrowUpRightIcon, SmileIcon, PaperclipIcon, UserCheckIcon, RefreshCwIcon,
} from 'lucide-react'
import { useMessages } from '@/hooks/useMessages'
import { createClient } from '@/lib/supabase'
import type { Conversation } from '@/types/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMsgTime(date: Date) {
  if (isToday(date)) return format(date, 'h:mm a')
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, h:mm a')
}

const STATUS_STYLES: Record<string, string> = {
  bot: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  open: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  resolved: 'bg-muted text-muted-foreground border-border',
  closed: 'bg-muted text-muted-foreground border-border',
}

// ─── WS for agent-side control ───────────────────────────────────────────────

function useAgentWS(orgId: string, agentId: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!orgId || !agentId) return
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3003'
    const ws = new WebSocket(`${wsUrl}?orgId=${orgId}&type=agent&agentId=${agentId}`)
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    return () => ws.close()
  }, [orgId, agentId])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send, connected }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  conversation: Conversation
  orgId: string
  agentId: string
  onStatusChange?: (id: string, status: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConversationView({ conversation, orgId, agentId, onStatusChange }: Props) {
  const { messages, loading, sending, sendMessage } = useMessages(conversation.id, orgId)
  const { send: wsSend } = useAgentWS(orgId, agentId)
  const [reply, setReply] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const contact = conversation.contacts
  const status = conversation.status
  const isAgentMode = status === 'open'
  const isBotMode = status === 'bot'
  const isResolved = status === 'resolved' || status === 'closed'
  const canReply = isAgentMode && !isResolved

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = reply.trim()
    if (!text || sending || !canReply) return
    setReply('')
    await sendMessage(text, agentId)
  }, [reply, sending, canReply, sendMessage, agentId])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  const handleTakeover = async () => {
    // Update DB
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ status: 'open', assigned_to: agentId })
      .eq('id', conversation.id)

    // Notify WS
    wsSend({ type: 'agent:takeover', conversationId: conversation.id })
    onStatusChange?.(conversation.id, 'open')
  }

  const handleRelease = async () => {
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ status: 'bot', assigned_to: null })
      .eq('id', conversation.id)

    wsSend({ type: 'agent:release', conversationId: conversation.id })
    onStatusChange?.(conversation.id, 'bot')
  }

  const handleResolve = async () => {
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ status: 'resolved' })
      .eq('id', conversation.id)

    wsSend({ type: 'agent:resolve', conversationId: conversation.id })
    onStatusChange?.(conversation.id, 'resolved')
  }

  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.resolved

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-card/50 px-5 py-3 shrink-0">
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="text-sm font-semibold">
            {contact?.name?.slice(0, 2).toUpperCase() ||
              contact?.email?.slice(0, 2).toUpperCase() || '??'}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate text-sm font-semibold">
              {contact?.name || contact?.email || 'Anonymous Visitor'}
            </p>
            <span className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap',
              statusStyle
            )}>
              {status === 'bot' && <ZapIcon className="mr-1 size-2.5" />}
              {status === 'open' && <UserCheckIcon className="mr-1 size-2.5" />}
              {status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {contact?.email && (
              <span className="flex items-center gap-1 truncate max-w-[160px]">
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

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          <TooltipProvider delayDuration={0}>
            {/* Take Over Button (when in bot/pending mode) */}
            {(isBotMode || status === 'pending') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" onClick={handleTakeover}
                    className="h-7 gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0">
                    <UserCheckIcon className="size-3.5" />
                    Take Over
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Take over from AI</TooltipContent>
              </Tooltip>
            )}

            {/* Release to AI (when agent is handling) */}
            {isAgentMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleRelease}
                    className="h-7 gap-1.5 text-xs">
                    <RefreshCwIcon className="size-3.5" />
                    Release to AI
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hand back to AI assistant</TooltipContent>
              </Tooltip>
            )}

            {/* Resolve */}
            {!isResolved && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleResolve}
                    className="h-7 gap-1.5 text-xs">
                    <CheckCircleIcon className="size-3.5" />
                    Resolve
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark as resolved</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>

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

      {/* Mode Banner */}
      {isBotMode && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 px-4 py-2 flex items-center justify-between shrink-0">
          <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <ZapIcon className="size-3.5" />
            AI is handling this conversation. Take over to reply as agent.
          </p>
          <Button size="sm" onClick={handleTakeover}
            className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700 text-white border-0">
            Take Over
          </Button>
        </div>
      )}

      {status === 'pending' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900 px-4 py-2 flex items-center justify-between shrink-0">
          <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <UserCheckIcon className="size-3.5" />
            Visitor requested human support. Take over to reply.
          </p>
          <Button size="sm" onClick={handleTakeover}
            className="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-700 text-white border-0">
            Take Over
          </Button>
        </div>
      )}

      {isResolved && (
        <div className="bg-muted/50 border-b px-4 py-2 shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            This conversation is resolved.
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-1 px-4 py-4 min-h-full">
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
              const isAgentMsg = msg.role === 'agent'
              const isOutbound = isUser || isAgentMsg
              const prevMsg = messages[idx - 1]
              const showTimeDivider = !prevMsg ||
                new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300_000

              // System messages (join/leave etc.)
              const isSystem = msg.ai_metadata && (msg.ai_metadata as any).system === true
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex items-center justify-center py-2">
                    <span className="text-[11px] text-muted-foreground/60 bg-muted/50 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                )
              }

              return (
                <div key={msg.id}>
                  {showTimeDivider && (
                    <div className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">
                        {formatMsgTime(new Date(msg.created_at))}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  <div className={cn('flex gap-2 py-0.5', isOutbound ? 'flex-row-reverse' : '')}>
                    {!isOutbound && (
                      <Avatar className="mt-auto size-6 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {msg.role === 'assistant' ? <BotIcon className="size-3" /> : 'S'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn(
                      'flex max-w-[75%] flex-col gap-0.5',
                      isOutbound ? 'items-end' : 'items-start'
                    )}>
                      {!isUser && (
                        <span className="px-0.5 text-[10px] font-medium text-muted-foreground/60 capitalize">
                          {msg.role === 'assistant' ? 'AI Assistant' : 'Agent'}
                        </span>
                      )}
                      <div className={cn(
                        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words',
                        isUser
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : isAgentMsg
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
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Reply Box */}
      <div className="border-t bg-card/50 p-3 shrink-0">
        {!canReply ? (
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              {isBotMode
                ? '🤖 AI is handling this conversation — take over to reply'
                : status === 'pending'
                ? '⏳ Take over this conversation to reply'
                : isResolved
                ? '✅ This conversation is resolved'
                : 'Reply disabled'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-background ring-1 ring-border/50 transition-shadow focus-within:ring-2 focus-within:ring-ring/30">
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

            <Textarea
              ref={textareaRef}
              placeholder="Type your reply... (⌘+Enter to send)"
              className="min-h-[80px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0"
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={handleKey}
            />

            <div className="flex items-center justify-between px-3 pb-2.5">
              <p className="text-[11px] text-muted-foreground/50">⌘+Enter to send</p>
              <Button size="sm" onClick={handleSend}
                disabled={!reply.trim() || sending}
                className="h-7 gap-1.5 px-3 text-xs">
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
        )}
      </div>
    </div>
  )
}

function MessageSkeletons() {
  return (
    <div className="flex flex-col gap-4 py-2">
      {[
        { side: 'left', width: 'w-52' }, { side: 'right', width: 'w-40' },
        { side: 'left', width: 'w-64' }, { side: 'right', width: 'w-36' },
      ].map((item, i) => (
        <div key={i} className={cn('flex gap-2', item.side === 'right' ? 'flex-row-reverse' : '')}>
          {item.side === 'left' && <Skeleton className="size-6 shrink-0 rounded-full" />}
          <Skeleton className={cn('h-10 rounded-2xl', item.width)} />
        </div>
      ))}
    </div>
  )
}
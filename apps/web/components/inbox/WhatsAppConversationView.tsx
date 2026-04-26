'use client'

import { useMemo, useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Textarea } from '@workspace/ui/components/textarea'
import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { cn } from '@workspace/ui/lib/utils'
import { createClient } from '@/lib/supabase'
import { trpc } from '@/lib/trpc'
import { useWhatsAppMessages, useWhatsAppReply } from '@/hooks/useWhatsApp'
import type { Conversation } from '@/types/database'
import {
  CheckCircleIcon,
  UserCheckIcon,
  SendIcon,
  PhoneIcon,
  MessageCircleIcon,
} from 'lucide-react'

interface WhatsAppMessage {
  id: string
  messageId: string | null
  direction: 'inbound' | 'outbound'
  messageType:
    | 'text'
    | 'image'
    | 'audio'
    | 'document'
    | 'template'
    | 'sticker'
    | 'unsupported'
  mediaUrl: string | null
  mediaMimeType: string | null
  createdAt: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'agent' | 'system'
  content: string
  ai_metadata: Record<string, unknown> | null
  created_at: string
}

type RenderedMessage = {
  id: string
  kind: 'inbound' | 'assistant' | 'agent' | 'system'
  text: string
  createdAt: string
  waMessage?: WhatsAppMessage
}

interface Props {
  conversation: Conversation
  orgId: string
  agentId: string
  onStatusChange?: (id: string, status: string) => void
}

function getContactLabel(conversation: Conversation) {
  return (
    conversation.contacts?.name ??
    conversation.contacts?.phone ??
    conversation.contacts?.email ??
    'Anonymous'
  )
}

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function hasRenderableMedia(message: WhatsAppMessage): boolean {
  return (
    message.messageType === 'image' ||
    message.messageType === 'audio' ||
    message.messageType === 'document'
  )
}

function isHttpUrl(value: string | null): value is string {
  if (!value) return false
  return value.startsWith('http://') || value.startsWith('https://')
}

function MessageBubble({ message }: { message: RenderedMessage }) {
  if (message.kind === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
          {message.text}
        </span>
      </div>
    )
  }

  const isInbound = message.kind === 'inbound'
  const isAgent = message.kind === 'agent'
  const isAssistant = message.kind === 'assistant'

  return (
    <div
      className={cn('flex w-full', isInbound ? 'justify-start' : 'justify-end')}
    >
      <div className="max-w-[78%]">
        {message.text && (
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
              isInbound && 'rounded-bl-sm bg-muted text-foreground',
              isAssistant &&
                'rounded-br-sm bg-primary text-primary-foreground',
              isAgent && 'rounded-br-sm bg-emerald-600 text-white'
            )}
          >
            {message.text}
          </div>
        )}

        {message.waMessage && hasRenderableMedia(message.waMessage) && (
          <div className="mt-1.5">
            {message.waMessage.messageType === 'image' &&
            isHttpUrl(message.waMessage.mediaUrl) ? (
              <a href={message.waMessage.mediaUrl} target="_blank" rel="noreferrer">
                <img
                  src={message.waMessage.mediaUrl}
                  alt="WhatsApp media"
                  className="max-h-56 rounded-lg border object-cover"
                />
              </a>
            ) : null}

            {message.waMessage.messageType === 'audio' &&
            isHttpUrl(message.waMessage.mediaUrl) ? (
              <audio controls className="w-full min-w-[220px]">
                <source
                  src={message.waMessage.mediaUrl}
                  type={message.waMessage.mediaMimeType ?? 'audio/mpeg'}
                />
              </audio>
            ) : null}

            {message.waMessage.messageType === 'document' &&
            isHttpUrl(message.waMessage.mediaUrl) ? (
              <a
                href={message.waMessage.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs font-medium"
              >
                Open document
              </a>
            ) : null}

            {((message.waMessage.messageType !== 'text' &&
              !isHttpUrl(message.waMessage.mediaUrl)) ||
              message.waMessage.messageType === 'unsupported') && (
              <span className="text-xs text-muted-foreground">
                Media message (view on WhatsApp)
              </span>
            )}
          </div>
        )}

        <span className="mt-1 block text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(message.createdAt), {
            addSuffix: true,
          })}
        </span>
      </div>
    </div>
  )
}

export function WhatsAppConversationView({
  conversation,
  agentId,
  onStatusChange,
}: Props) {
  const { messages: waMessages, isLoading: waLoading } = useWhatsAppMessages(
    conversation.id
  )
  const chatQuery = trpc.chat.getMessages.useQuery(
    { conversationId: conversation.id },
    { staleTime: 30_000 }
  )
  const chatMessages = (chatQuery.data ?? []) as ChatMessage[]
  const { sendReply } = useWhatsAppReply()
  const [content, setContent] = useState('')

  const status = conversation.status
  const isResolved = status === 'resolved' || status === 'closed'
  const takeoverRequired = status === 'bot' || status === 'pending'
  const maxChars = 4096

  const renderedMessages = useMemo(() => {
    const waTyped = waMessages as WhatsAppMessage[]
    const chatById = new Map(chatMessages.map((message) => [message.id, message]))
    const linkedChatIds = new Set<string>()
    const result: RenderedMessage[] = []

    for (const wa of waTyped) {
      const linked = wa.messageId ? chatById.get(wa.messageId) : undefined
      if (linked) linkedChatIds.add(linked.id)

      if (wa.direction === 'inbound') {
        result.push({
          id: `wa-${wa.id}`,
          kind: 'inbound',
          text:
            linked?.content?.trim() ||
            (wa.messageType === 'text' ? '' : 'Media message'),
          createdAt: wa.createdAt,
          waMessage: wa,
        })
        continue
      }

      if (linked?.role === 'agent') {
        result.push({
          id: `wa-${wa.id}`,
          kind: 'agent',
          text: linked.content ?? '',
          createdAt: wa.createdAt,
          waMessage: wa,
        })
        continue
      }

      result.push({
        id: `wa-${wa.id}`,
        kind: 'assistant',
        text: linked?.content ?? '',
        createdAt: wa.createdAt,
        waMessage: wa,
      })
    }

    for (const chat of chatMessages) {
      if (linkedChatIds.has(chat.id)) continue

      const meta = safeMetadata(chat.ai_metadata)
      const isSystem = chat.role === 'system' || meta['system'] === true

      if (isSystem) {
        result.push({
          id: `msg-${chat.id}`,
          kind: 'system',
          text: chat.content,
          createdAt: chat.created_at,
        })
        continue
      }

      if (chat.role === 'agent') {
        result.push({
          id: `msg-${chat.id}`,
          kind: 'agent',
          text: chat.content,
          createdAt: chat.created_at,
        })
        continue
      }

      if (chat.role === 'assistant') {
        result.push({
          id: `msg-${chat.id}`,
          kind: 'assistant',
          text: chat.content,
          createdAt: chat.created_at,
        })
      }
    }

    return result.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }, [chatMessages, waMessages])

  const handleTakeOver = useCallback(async () => {
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ status: 'open', assigned_to: agentId })
      .eq('id', conversation.id)
    onStatusChange?.(conversation.id, 'open')
  }, [agentId, conversation.id, onStatusChange])

  const handleResolve = useCallback(async () => {
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ status: 'resolved' })
      .eq('id', conversation.id)
    onStatusChange?.(conversation.id, 'resolved')
  }, [conversation.id, onStatusChange])

  const handleSend = useCallback(async () => {
    const text = content.trim()
    if (!text || takeoverRequired || isResolved || sendReply.isPending) return

    setContent('')
    try {
      await sendReply.mutateAsync({
        conversationId: conversation.id,
        content: text,
      })
    } catch {
      setContent(text)
    }
  }, [
    content,
    takeoverRequired,
    isResolved,
    sendReply,
    conversation.id,
    setContent,
  ])

  const canSend =
    content.trim().length > 0 &&
    content.trim().length <= maxChars &&
    !takeoverRequired &&
    !isResolved &&
    !sendReply.isPending

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b bg-card/50 px-5 py-3">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs font-semibold">
            {getContactLabel(conversation).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {getContactLabel(conversation)}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <MessageCircleIcon className="size-2.5" />
              WhatsApp
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {conversation.contacts?.phone && (
              <span className="inline-flex items-center gap-1">
                <PhoneIcon className="size-3" />
                {conversation.contacts.phone}
              </span>
            )}
            <span className="uppercase tracking-wide">{status}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {takeoverRequired && (
            <Button
              size="sm"
              onClick={handleTakeOver}
              className="h-7 gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              <UserCheckIcon className="size-3.5" />
              Take Over
            </Button>
          )}
          {!isResolved && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResolve}
              className="h-7 gap-1 text-xs"
            >
              <CheckCircleIcon className="size-3.5" />
              Resolve
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-4">
          {waLoading || chatQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex">
                <Skeleton className="h-10 w-64 rounded-2xl" />
              </div>
            ))
          ) : renderedMessages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No WhatsApp messages yet.
            </p>
          ) : (
            renderedMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-card/50 p-3">
        {takeoverRequired ? (
          <div className="rounded-lg border bg-amber-50 px-4 py-3 text-center dark:bg-amber-900/20">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Take over conversation first.
            </p>
            <Button
              size="sm"
              onClick={handleTakeOver}
              className="mt-2 h-7 gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              <UserCheckIcon className="size-3.5" />
              Take Over
            </Button>
          </div>
        ) : isResolved ? (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              This conversation is resolved.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border bg-background p-2">
            <Textarea
              value={content}
              onChange={(event) =>
                setContent(event.target.value.slice(0, maxChars))
              }
              placeholder="Type a WhatsApp reply..."
              className="min-h-[80px] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {content.length}/{maxChars}
              </span>
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleSend}
                disabled={!canSend}
              >
                <SendIcon className="size-3.5" />
                {sendReply.isPending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Textarea } from '@workspace/ui/components/textarea'
import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { cn } from '@workspace/ui/lib/utils'
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
  actionLog?: {
    logId: string | null
    actionName: string | null
    status: string | null
  } | null
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

function getAssignedLabel(conversation: Conversation): string {
  if (!conversation.assigned_to) return 'Unassigned'
  if (conversation.assigned_agent_name?.trim()) return conversation.assigned_agent_name.trim()
  if (conversation.assigned_agent_email?.trim()) return conversation.assigned_agent_email.trim()
  return 'Assigned'
}

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function readActionLogMetadata(value: unknown): {
  logId: string | null
  actionName: string | null
  status: string | null
} | null {
  const meta = safeMetadata(value)
  const actionLog = meta.actionLog
  if (!actionLog || typeof actionLog !== 'object' || Array.isArray(actionLog)) {
    return null
  }

  const parsed = actionLog as Record<string, unknown>
  return {
    logId: typeof parsed.logId === 'string' ? parsed.logId : null,
    actionName: typeof parsed.actionName === 'string' ? parsed.actionName : null,
    status: typeof parsed.status === 'string' ? parsed.status : null,
  }
}

function actionStatusLabel(status: string | null): string {
  if (!status) return 'Unknown'
  if (status === 'pending_approval') return 'Awaiting Approval'
  if (status === 'pending_confirmation') return 'Awaiting Confirmation'
  if (status === 'success') return 'Success'
  if (status === 'failed') return 'Failed'
  if (status === 'timeout') return 'Timeout'
  if (status === 'rejected') return 'Rejected'
  if (status === 'cancelled') return 'Cancelled'
  return status.replace(/_/g, ' ')
}

function actionStatusStyle(status: string | null): string {
  if (status === 'success') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (status === 'pending_approval') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (status === 'pending_confirmation') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (status === 'failed' || status === 'timeout') {
    return 'bg-rose-100 text-rose-700 border-rose-200'
  }
  if (status === 'rejected' || status === 'cancelled') {
    return 'bg-muted text-muted-foreground border-border'
  }
  return 'bg-muted text-muted-foreground border-border'
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

function MessageBubble({
  message,
  resolvingActionKey,
  onApprove,
  onReject,
}: {
  message: RenderedMessage
  resolvingActionKey: string | null
  onApprove: (logId: string) => void
  onReject: (logId: string) => void
}) {
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

        {message.actionLog && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium">
              <MessageCircleIcon className="size-2.5" />
              Action: {message.actionLog.actionName ?? 'action'}
            </span>
            <span
              className={cn(
                'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium',
                actionStatusStyle(message.actionLog.status)
              )}
            >
              {actionStatusLabel(message.actionLog.status)}
            </span>
          </div>
        )}

        {message.actionLog?.status === 'pending_approval' && message.actionLog.logId && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-6 px-2 text-[10px]"
              disabled={Boolean(resolvingActionKey)}
              onClick={() => onApprove(message.actionLog!.logId!)}
            >
              {resolvingActionKey === `${message.actionLog.logId}:approve`
                ? 'Approving...'
                : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              disabled={Boolean(resolvingActionKey)}
              onClick={() => onReject(message.actionLog!.logId!)}
            >
              {resolvingActionKey === `${message.actionLog.logId}:reject`
                ? 'Rejecting...'
                : 'Reject'}
            </Button>
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
  const approveAction = trpc.actions.approveAction.useMutation({
    onSuccess: () => {
      void chatQuery.refetch()
    },
  })
  const rejectAction = trpc.actions.rejectAction.useMutation({
    onSuccess: () => {
      void chatQuery.refetch()
    },
  })
  const updateConversationStatus = trpc.chat.updateStatus.useMutation()
  const { sendReply } = useWhatsAppReply()
  const [content, setContent] = useState('')
  const [resolvingActionKey, setResolvingActionKey] = useState<string | null>(null)

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
      const linkedActionLog = linked ? readActionLogMetadata(linked.ai_metadata) : null

      if (wa.direction === 'inbound') {
        result.push({
          id: `wa-${wa.id}`,
          kind: 'inbound',
          text:
            linked?.content?.trim() ||
            (wa.messageType === 'text' ? '' : 'Media message'),
          createdAt: wa.createdAt,
          waMessage: wa,
          actionLog: linkedActionLog,
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
          actionLog: linkedActionLog,
        })
        continue
      }

      result.push({
        id: `wa-${wa.id}`,
        kind: 'assistant',
        text: linked?.content ?? '',
        createdAt: wa.createdAt,
        waMessage: wa,
        actionLog: linkedActionLog,
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
          actionLog: readActionLogMetadata(chat.ai_metadata),
        })
        continue
      }

      if (chat.role === 'assistant') {
        result.push({
          id: `msg-${chat.id}`,
          kind: 'assistant',
          text: chat.content,
          createdAt: chat.created_at,
          actionLog: readActionLogMetadata(chat.ai_metadata),
        })
      }
    }

    return result.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }, [chatMessages, waMessages])

  const handleTakeOver = useCallback(async () => {
    await updateConversationStatus.mutateAsync({
      conversationId: conversation.id,
      status: 'open',
      assignedTo: agentId,
    })
    onStatusChange?.(conversation.id, 'open')
  }, [agentId, conversation.id, onStatusChange, updateConversationStatus])

  const handleResolve = useCallback(async () => {
    await updateConversationStatus.mutateAsync({
      conversationId: conversation.id,
      status: 'resolved',
    })
    onStatusChange?.(conversation.id, 'resolved')
  }, [conversation.id, onStatusChange, updateConversationStatus])

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

  const handleApprove = useCallback(async (logId: string) => {
    setResolvingActionKey(`${logId}:approve`)
    try {
      await approveAction.mutateAsync({ logId })
      void chatQuery.refetch()
    } finally {
      setResolvingActionKey(null)
    }
  }, [approveAction, chatQuery])

  const handleReject = useCallback(async (logId: string) => {
    setResolvingActionKey(`${logId}:reject`)
    try {
      await rejectAction.mutateAsync({ logId })
      void chatQuery.refetch()
    } finally {
      setResolvingActionKey(null)
    }
  }, [chatQuery, rejectAction])

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
            <span className="inline-flex items-center gap-1 truncate max-w-[210px]">
              <UserCheckIcon className="size-3 shrink-0" />
              <span className="truncate">Assigned: {getAssignedLabel(conversation)}</span>
            </span>
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
              <MessageBubble
                key={message.id}
                message={message}
                resolvingActionKey={resolvingActionKey}
                onApprove={handleApprove}
                onReject={handleReject}
              />
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

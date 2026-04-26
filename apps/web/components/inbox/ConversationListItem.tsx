'use client'

import { formatDistanceToNow } from 'date-fns'
import { cn } from '@workspace/ui/lib/utils'
import type { Conversation } from '@/types/database'

export const CHANNEL_ICONS: Record<string, string> = {
  chat: '💬',
  email: '📧',
  whatsapp: '📱',
  facebook: '👥',
  instagram: '📸',
  sms: '📲',
  telegram: '✈️',
  voice: '📞',
}

function getContactLabel(conversation: Conversation): string {
  return (
    conversation.contacts?.name ??
    conversation.contacts?.email ??
    conversation.contacts?.phone ??
    'Anonymous'
  )
}

function getLastMessageText(conversation: Conversation): string {
  const messages = conversation.messages ?? []
  if (messages.length === 0) return 'No messages yet'

  const latest = messages.reduce((acc, current) => {
    if (!acc) return current
    return new Date(current.created_at).getTime() >=
      new Date(acc.created_at).getTime()
      ? current
      : acc
  }, messages[0])

  return latest.content?.trim() || 'No messages yet'
}

function getEmailSubject(conversation: Conversation): string | null {
  const emailMessages = conversation.email_messages ?? []
  if (emailMessages.length === 0) return null

  const latest = emailMessages.reduce((acc, current) => {
    if (!acc) return current
    return new Date(current.created_at).getTime() >=
      new Date(acc.created_at).getTime()
      ? current
      : acc
  }, emailMessages[0])

  return latest.subject?.trim() || null
}

function getPreviewText(conversation: Conversation): string {
  if (conversation.channel === 'email') {
    return getEmailSubject(conversation) ?? getLastMessageText(conversation)
  }
  return getLastMessageText(conversation)
}

function statusClass(status: Conversation['status']): string {
  if (status === 'bot') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (status === 'pending')
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (status === 'open')
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  return 'bg-muted text-muted-foreground'
}

interface ConversationListItemProps {
  conversation: Conversation
  isSelected: boolean
  onSelect: () => void
}

export function ConversationListItem({
  conversation,
  isSelected,
  onSelect,
}: ConversationListItemProps) {
  const channelIcon = CHANNEL_ICONS[conversation.channel] ?? '💬'
  const contactLabel = getContactLabel(conversation)
  const previewText = getPreviewText(conversation)

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border border-transparent p-3 text-left transition-colors',
        'hover:border-border hover:bg-muted/40',
        isSelected && 'border-primary/20 bg-primary/5'
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-flex size-5 items-center justify-center rounded-md bg-muted text-xs"
            aria-label={`${conversation.channel} channel`}
          >
            {channelIcon}
          </span>
          <span className="truncate text-sm font-semibold">{contactLabel}</span>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(conversation.started_at), {
            addSuffix: false,
          })}
        </span>
      </div>

      <p className="line-clamp-2 text-xs text-muted-foreground">{previewText}</p>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            statusClass(conversation.status)
          )}
        >
          {conversation.status}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {conversation.channel}
        </span>
      </div>
    </button>
  )
}

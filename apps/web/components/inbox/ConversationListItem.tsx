'use client'

import { formatDistanceToNow } from 'date-fns'
import { cn } from '@workspace/ui/lib/utils'
import type { Conversation } from '@/types/database'

const CHANNEL_LABELS: Record<string, string> = {
  chat: 'Chat',
  email: 'Email',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  sms: 'SMS',
  telegram: 'Telegram',
  voice: 'Voice',
}

function getContactLabel(conversation: Conversation): string {
  return conversation.contacts?.name ?? conversation.contacts?.email ?? conversation.contacts?.phone ?? 'Anonymous'
}

function getLatestMessageContent(conversation: Conversation): string | null {
  if (conversation.latest_message_content?.trim()) {
    return conversation.latest_message_content.trim()
  }

  const messages = conversation.messages ?? []
  let latest: (typeof messages)[number] | null = null

  for (const message of messages) {
    if (!latest) {
      latest = message
      continue
    }

    if (new Date(message.created_at).getTime() >= new Date(latest.created_at).getTime()) {
      latest = message
    }
  }

  return latest?.content?.trim() || null
}

function getLatestEmailSubject(conversation: Conversation): string | null {
  if (conversation.latest_email_subject?.trim()) {
    return conversation.latest_email_subject.trim()
  }

  const emails = conversation.email_messages ?? []
  let latest: (typeof emails)[number] | null = null

  for (const email of emails) {
    if (!latest) {
      latest = email
      continue
    }

    if (new Date(email.created_at).getTime() >= new Date(latest.created_at).getTime()) {
      latest = email
    }
  }

  return latest?.subject?.trim() || null
}

function getPreviewText(conversation: Conversation): string {
  if (conversation.channel === 'email') {
    return getLatestEmailSubject(conversation) ?? getLatestMessageContent(conversation) ?? 'No messages yet'
  }

  return getLatestMessageContent(conversation) ?? 'No messages yet'
}

function statusClass(status: Conversation['status']): string {
  if (status === 'bot') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (status === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (status === 'open') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
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
  const channelLabel = CHANNEL_LABELS[conversation.channel] ?? 'Chat'
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
            className="inline-flex h-5 items-center justify-center rounded-md bg-muted px-1.5 text-[10px] font-semibold"
            aria-label={`${conversation.channel} channel`}
          >
            {channelLabel}
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
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{channelLabel}</span>
      </div>
    </button>
  )
}

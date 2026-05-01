'use client'

import { formatDistanceToNow } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
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

function queueStateClass(queueState: string): string {
  if (queueState === 'queued') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
  if (queueState === 'assigned') return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
  if (queueState === 'in_progress') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (queueState === 'waiting_customer') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
  if (queueState === 'resolved') return 'bg-muted text-muted-foreground'
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
}

function backlogClass(backlogState: string | null): string {
  if (backlogState === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (backlogState === 'stale') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (backlogState === 'watch') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  if (backlogState === 'fresh') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  return 'bg-muted text-muted-foreground'
}

function slaClass(slaState: string | null): string {
  if (slaState === 'breached') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (slaState === 'at_risk') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (slaState === 'met') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (slaState === 'on_track') return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
  return 'bg-muted text-muted-foreground'
}

function normalizeQueueState(conversation: Conversation): string {
  const queueState = conversation.queue_state
  if (queueState) return queueState
  if (conversation.status === 'resolved' || conversation.status === 'closed') return 'resolved'
  if (conversation.status === 'pending') return conversation.assigned_to ? 'assigned' : 'queued'
  if (conversation.status === 'open') return 'in_progress'
  return 'bot'
}

function fallbackBacklogState(backlogMinutes: number | null): string | null {
  if (backlogMinutes === null) return null
  if (backlogMinutes <= 15) return 'fresh'
  if (backlogMinutes <= 45) return 'watch'
  if (backlogMinutes <= 120) return 'stale'
  return 'critical'
}

function formatDurationCompact(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${safe}s`
}

function toMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function toLabel(value: string): string {
  return value.replace(/_/g, ' ')
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
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const channelLabel = CHANNEL_LABELS[conversation.channel] ?? 'Chat'
  const contactLabel = getContactLabel(conversation)
  const previewText = getPreviewText(conversation)
  const queueState = normalizeQueueState(conversation)
  const showQueueBadge = toLabel(queueState).toLowerCase() !== conversation.status.toLowerCase()

  const backlog = useMemo(() => {
    const queueEnteredMs = toMs(conversation.queue_entered_at ?? conversation.started_at)
    const backlogMinutes =
      conversation.backlog_minutes ??
      (queueEnteredMs === null ? null : Math.max(0, Math.floor((nowMs - queueEnteredMs) / 60000)))
    const backlogState = conversation.backlog_state ?? fallbackBacklogState(backlogMinutes)

    if (backlogMinutes === null) return null
    return {
      minutes: backlogMinutes,
      state: backlogState,
      label: `${backlogMinutes}m backlog`,
    }
  }, [conversation.backlog_minutes, conversation.backlog_state, conversation.queue_entered_at, conversation.started_at, nowMs])

  const sla = useMemo(() => {
    const slaTarget = conversation.sla_target_at
      ?? conversation.first_response_due_at
      ?? conversation.next_response_due_at
      ?? conversation.resolution_due_at

    const targetMs = toMs(slaTarget)
    if (!targetMs) return null

    if (conversation.sla_state === 'met') {
      return {
        state: 'met',
        label: 'SLA met',
      }
    }

    const remainingSeconds = Math.floor((targetMs - nowMs) / 1000)
    if (remainingSeconds <= 0) {
      return {
        state: 'breached',
        label: `SLA breached ${formatDurationCompact(Math.abs(remainingSeconds))}`,
      }
    }

    return {
      state: conversation.sla_state ?? (remainingSeconds <= 300 ? 'at_risk' : 'on_track'),
      label: `SLA ${formatDurationCompact(remainingSeconds)} left`,
    }
  }, [
    conversation.first_response_due_at,
    conversation.next_response_due_at,
    conversation.resolution_due_at,
    conversation.sla_state,
    conversation.sla_target_at,
    nowMs,
  ])

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

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            statusClass(conversation.status)
          )}
        >
          {conversation.status}
        </span>
        {showQueueBadge && (
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              queueStateClass(queueState)
            )}
          >
            {toLabel(queueState)}
          </span>
        )}
        {backlog && (
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              backlogClass(backlog.state)
            )}
          >
            {backlog.label}
          </span>
        )}
        {sla && (
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              slaClass(sla.state)
            )}
          >
            {sla.label}
          </span>
        )}
      </div>
    </button>
  )
}

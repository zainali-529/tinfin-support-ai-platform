'use client'

import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  ClockIcon,
  MailIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  NotebookPenIcon,
  PencilLineIcon,
  RefreshCwIcon,
  SendIcon,
  StarIcon,
  Trash2Icon,
  UserCheckIcon,
  UserIcon,
  ZapIcon,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Textarea } from '@workspace/ui/components/textarea'
import { cn } from '@workspace/ui/lib/utils'
import { useAgentRealtimeListener } from '@/components/realtime/AgentRealtimeProvider'
import { trpc } from '@/lib/trpc'
import type { AgentRealtimeEvent, RealtimeTimelineItem } from '@workspace/types'

type TimelineItem = {
  id: string
  kind: 'note' | 'event'
  eventType: string
  title: string
  body: string | null
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

const MAX_REALTIME_ITEMS = 30

const EVENT_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  internal_note: {
    icon: NotebookPenIcon,
    className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900',
  },
  internal_note_edited: {
    icon: PencilLineIcon,
    className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900',
  },
  internal_note_deleted: {
    icon: Trash2Icon,
    className: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900',
  },
  assignment_changed: {
    icon: UserCheckIcon,
    className: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-900',
  },
  status_changed: {
    icon: RefreshCwIcon,
    className: 'bg-muted text-muted-foreground ring-border',
  },
  sla_changed: {
    icon: ClockIcon,
    className: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900',
  },
  sla_met: {
    icon: CheckCircle2Icon,
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900',
  },
  sla_breached: {
    icon: AlertTriangleIcon,
    className: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900',
  },
  ai_takeover: {
    icon: BotIcon,
    className: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900',
  },
  ai_released: {
    icon: UserIcon,
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900',
  },
  action_executed: {
    icon: ZapIcon,
    className: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-900',
  },
  contact_updated: {
    icon: UserIcon,
    className: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:ring-violet-900',
  },
  channel_event: {
    icon: MessageCircleIcon,
    className: 'bg-muted text-muted-foreground ring-border',
  },
  csat_received: {
    icon: StarIcon,
    className: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:ring-yellow-900',
  },
}

function eventStyle(type: string) {
  return EVENT_STYLES[type] ?? EVENT_STYLES.status_changed!
}

function normalizeRealtimeTimelineItem(item: RealtimeTimelineItem | null | undefined): TimelineItem | null {
  if (!item?.id || !item.eventType || !item.title || !item.createdAt) return null

  return {
    id: item.id,
    kind: item.kind,
    eventType: item.eventType,
    title: item.title,
    body: item.body ?? null,
    actorUserId: item.actorUserId ?? null,
    actorName: item.actorName ?? null,
    actorEmail: item.actorEmail ?? null,
    createdAt: item.createdAt,
    metadata: item.metadata ?? {},
  }
}

function trimPreview(content: unknown): string | null {
  if (typeof content !== 'string') return null
  const value = content.trim()
  if (!value) return null
  return value.length > 180 ? `${value.slice(0, 177)}...` : value
}

function realtimeId(event: AgentRealtimeEvent, suffix = ''): string {
  const record = event as Record<string, unknown>
  const conversationId = typeof record.conversationId === 'string' ? record.conversationId : 'conversation'
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString()
  return `realtime:${event.type}:${conversationId}:${createdAt}:${suffix}`
}

function buildSocketTimelineItem(event: AgentRealtimeEvent): TimelineItem | null {
  if (event.type === 'timeline:updated') {
    const item = normalizeRealtimeTimelineItem(event.timelineItem)
    if (item) return item

    return {
      id: realtimeId(event, event.eventType ?? 'timeline'),
      kind: 'event',
      eventType: event.eventType ?? 'status_changed',
      title: 'Timeline updated',
      body: null,
      actorUserId: null,
      actorName: null,
      actorEmail: null,
      createdAt: event.createdAt ?? new Date().toISOString(),
      metadata: { source: 'socket' },
    }
  }

  if (event.type === 'visitor:message') {
    return {
      id: realtimeId(event, 'visitor-message'),
      kind: 'event',
      eventType: 'channel_event',
      title: 'Customer message received',
      body: trimPreview(event.content),
      actorUserId: null,
      actorName: null,
      actorEmail: null,
      createdAt: event.createdAt ?? new Date().toISOString(),
      metadata: { channel: event.channel ?? 'chat', role: 'user', source: 'socket' },
    }
  }

  if (event.type === 'agent:message') {
    return {
      id: realtimeId(event, event.clientNonce ?? 'agent-message'),
      kind: 'event',
      eventType: 'channel_event',
      title: 'Agent reply sent',
      body: trimPreview(event.content),
      actorUserId: event.agentId ?? null,
      actorName: null,
      actorEmail: null,
      createdAt: event.createdAt ?? new Date().toISOString(),
      metadata: {
        channel: event.channel ?? 'chat',
        role: 'agent',
        source: 'socket',
        agentId: event.agentId ?? null,
      },
    }
  }

  if (event.type === 'ai:response') {
    return {
      id: realtimeId(event, 'ai-response'),
      kind: 'event',
      eventType: 'channel_event',
      title: 'AI response sent',
      body: trimPreview(event.content),
      actorUserId: null,
      actorName: 'AI assistant',
      actorEmail: null,
      createdAt: event.createdAt ?? new Date().toISOString(),
      metadata: {
        channel: event.channel ?? 'chat',
        role: 'assistant',
        source: 'socket',
        handoff: event.handoff ?? false,
      },
    }
  }

  if (event.type === 'conversation:status_changed') {
    const status = event.status ?? 'updated'
    return {
      id: realtimeId(event, `status-${status}`),
      kind: 'event',
      eventType: status === 'bot' ? 'ai_takeover' : 'status_changed',
      title: status === 'bot' ? 'AI resumed conversation' : 'Conversation status updated',
      body: `Status changed to ${status}.`,
      actorUserId: event.actorUserId ?? null,
      actorName: null,
      actorEmail: null,
      createdAt: event.createdAt ?? new Date().toISOString(),
      metadata: {
        status,
        queueState: event.queueState ?? null,
        assignedTo: event.assignedTo ?? null,
        source: 'socket',
      },
    }
  }

  if (event.type === 'handoff:requested') {
    return {
      id: realtimeId(event, 'handoff-requested'),
      kind: 'event',
      eventType: 'ai_released',
      title: 'Human handoff requested',
      body: 'AI requested a human agent for this conversation.',
      actorUserId: null,
      actorName: 'AI assistant',
      actorEmail: null,
      createdAt: event.createdAt ?? new Date().toISOString(),
      metadata: {
        assignedTo: event.assignedTo ?? null,
        source: 'socket',
      },
    }
  }

  if (event.type === 'contact:updated') {
    return {
      id: realtimeId(event, 'contact-updated'),
      kind: 'event',
      eventType: 'contact_updated',
      title: 'Contact updated',
      body: null,
      actorUserId: null,
      actorName: null,
      actorEmail: null,
      createdAt: event.createdAt ?? new Date().toISOString(),
      metadata: { source: 'socket' },
    }
  }

  if (event.type === 'approval:requested' || event.type === 'approval:resolved') {
    const status = event.type === 'approval:requested' ? 'requested' : event.status ?? 'resolved'
    const body = event.type === 'approval:requested' ? event.actionName : event.message

    return {
      id: realtimeId(event, event.logId ?? status),
      kind: 'event',
      eventType: 'action_executed',
      title: event.type === 'approval:requested' ? 'Action approval requested' : `Action ${status}`,
      body: body ?? 'AI action event',
      actorUserId: null,
      actorName: null,
      actorEmail: null,
      createdAt: event.createdAt ?? new Date().toISOString(),
      metadata: {
        logId: event.logId ?? null,
        status,
        source: 'socket',
      },
    }
  }

  return null
}

function eventBelongsToConversation(event: AgentRealtimeEvent, conversationId: string): boolean {
  const record = event as Record<string, unknown>
  return typeof record.conversationId === 'string' && record.conversationId === conversationId
}

function mergeTimelineItems(queryItems: TimelineItem[], realtimeItems: TimelineItem[]): TimelineItem[] {
  const byId = new Map<string, TimelineItem>()

  for (const item of queryItems) {
    byId.set(item.id, item)
  }

  for (const item of realtimeItems) {
    byId.set(item.id, item)
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

function actorLabel(item: TimelineItem): string {
  return item.actorName ?? item.actorEmail ?? 'System'
}

function metadataText(item: TimelineItem): string | null {
  const channel = typeof item.metadata.channel === 'string' ? item.metadata.channel : null
  const status = typeof item.metadata.status === 'string' ? item.metadata.status : null
  const actionName = typeof item.metadata.actionName === 'string' ? item.metadata.actionName : null

  if (actionName && status) return `${actionName} - ${status}`
  if (channel && status) return `${channel} - ${status}`
  if (channel) return channel
  return null
}

function noteIdFromTimelineItem(item: TimelineItem): string | null {
  if (typeof item.metadata.noteId === 'string') return item.metadata.noteId
  if (!item.id.startsWith('note:')) return null
  return item.id.slice('note:'.length).split(':')[0] ?? null
}

function noteWasEdited(item: TimelineItem): boolean {
  return item.kind === 'note' && typeof item.metadata.editedAt === 'string'
}

export function ConversationTimelinePanel({
  conversationId,
  agentId,
}: {
  conversationId: string
  agentId: string
}) {
  const [note, setNote] = React.useState('')
  const [realtimeItems, setRealtimeItems] = React.useState<TimelineItem[]>([])
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null)
  const [editBody, setEditBody] = React.useState('')
  const [deleteTarget, setDeleteTarget] = React.useState<TimelineItem | null>(null)
  const syncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const timelineQuery = trpc.chat.getConversationTimeline.useQuery(
    { conversationId },
    {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    }
  )

  const pushRealtimeItem = React.useCallback((item: TimelineItem) => {
    setRealtimeItems((previous) => [
      item,
      ...previous.filter((previousItem) => previousItem.id !== item.id),
    ].slice(0, MAX_REALTIME_ITEMS))
  }, [])

  const scheduleTimelineSync = React.useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
    }

    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null
      void timelineQuery.refetch()
    }, 150)
  }, [timelineQuery.refetch])

  React.useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
        syncTimerRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    setRealtimeItems([])
  }, [conversationId, timelineQuery.dataUpdatedAt])

  const createNote = trpc.chat.createInternalNote.useMutation({
    onSuccess: (result) => {
      setNote('')
      const item = normalizeRealtimeTimelineItem(result.timelineItem)
      if (item) {
        pushRealtimeItem(item)
      }
      scheduleTimelineSync()
    },
  })

  const updateNote = trpc.chat.updateInternalNote.useMutation({
    onSuccess: (result) => {
      setEditingNoteId(null)
      setEditBody('')
      const item = normalizeRealtimeTimelineItem(result.timelineItem)
      if (item) {
        pushRealtimeItem(item)
      }
      scheduleTimelineSync()
    },
  })

  const deleteNote = trpc.chat.deleteInternalNote.useMutation({
    onSuccess: (result) => {
      setDeleteTarget(null)
      const item = normalizeRealtimeTimelineItem(result.timelineItem)
      if (item) {
        pushRealtimeItem(item)
      }
      scheduleTimelineSync()
    },
  })

  useAgentRealtimeListener(React.useCallback((event: AgentRealtimeEvent) => {
    if (!eventBelongsToConversation(event, conversationId)) return

    const item = buildSocketTimelineItem(event)
    if (!item) return

    pushRealtimeItem(item)

    if (event.type === 'timeline:updated') {
      scheduleTimelineSync()
    }
  }, [conversationId, pushRealtimeItem, scheduleTimelineSync]))

  const items = mergeTimelineItems((timelineQuery.data ?? []) as TimelineItem[], realtimeItems)
  const canSave = note.trim().length > 0 && !createNote.isPending

  const handleSave = () => {
    const body = note.trim()
    if (!body) return
    createNote.mutate({ conversationId, body })
  }

  const startEditing = (item: TimelineItem) => {
    const noteId = noteIdFromTimelineItem(item)
    if (!noteId) return
    setEditingNoteId(noteId)
    setEditBody(item.body ?? '')
  }

  const cancelEditing = () => {
    setEditingNoteId(null)
    setEditBody('')
  }

  const saveEdit = () => {
    const noteId = editingNoteId
    const body = editBody.trim()
    if (!noteId || !body || updateNote.isPending) return
    updateNote.mutate({ noteId, body })
  }

  const confirmDelete = () => {
    const noteId = deleteTarget ? noteIdFromTimelineItem(deleteTarget) : null
    if (!noteId || deleteNote.isPending) return
    deleteNote.mutate({ noteId })
  }

  return (
    <aside className="hidden h-full w-[318px] shrink-0 flex-col border-l bg-muted/10 xl:flex">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Notes & timeline</h3>
            <p className="text-xs text-muted-foreground">Internal context for agents only</p>
          </div>
          <NotebookPenIcon className="size-4 text-muted-foreground" />
        </div>
      </div>

      <div className="border-b p-3">
        <div className="rounded-xl border bg-background p-2.5">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add an internal note. Customers cannot see this."
            maxLength={4000}
            className="min-h-[82px] resize-none border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {note.trim().length}/4000
            </span>
            <Button size="sm" className="h-7 gap-1.5 text-xs" disabled={!canSave} onClick={handleSave}>
              <SendIcon className="size-3" />
              {createNote.isPending ? 'Saving...' : 'Save note'}
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {timelineQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex gap-2">
                <Skeleton className="size-7 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-center">
            <ClockIcon className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No timeline yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Notes, assignments, actions, and channel events will appear here.
            </p>
          </div>
        ) : (
          <div className="relative space-y-3">
            <div className="absolute left-[14px] top-2 h-[calc(100%-1rem)] w-px bg-border" />
            {items.map((item) => {
              const style = eventStyle(item.eventType)
              const Icon = item.eventType === 'channel_event' && item.metadata.channel === 'email'
                ? MailIcon
                : style.icon
              const meta = metadataText(item)
              const noteId = noteIdFromTimelineItem(item)
              const isOwnNote = item.kind === 'note' && Boolean(noteId) && item.actorUserId === agentId
              const isEditing = Boolean(noteId) && editingNoteId === noteId
              const isEdited = noteWasEdited(item)
              return (
                <div key={item.id} className="relative flex gap-2.5">
                  <div
                    className={cn(
                      'z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-1',
                      style.className
                    )}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div
                    className={cn(
                      'min-w-0 flex-1 rounded-xl border bg-background px-3 py-2',
                      item.kind === 'note' && 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{item.title}</p>
                        {isEdited && (
                          <p className="mt-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                            Edited
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </span>
                        {isOwnNote && !isEditing && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontalIcon className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem className="gap-2 text-xs" onClick={() => startEditing(item)}>
                                <PencilLineIcon className="size-3.5" />
                                Edit note
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                className="gap-2 text-xs"
                                onClick={() => setDeleteTarget(item)}
                              >
                                <Trash2Icon className="size-3.5" />
                                Delete note
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editBody}
                          onChange={(event) => setEditBody(event.target.value)}
                          maxLength={4000}
                          className="min-h-[76px] resize-none text-xs"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {editBody.trim().length}/4000
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={updateNote.isPending}
                              onClick={cancelEditing}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={!editBody.trim() || updateNote.isPending}
                              onClick={saveEdit}
                            >
                              {updateNote.isPending ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : item.body && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{actorLabel(item)}</span>
                      {meta && (
                        <>
                          <span>-</span>
                          <span>{meta}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete internal note?</AlertDialogTitle>
            <AlertDialogDescription>
              The note body will be hidden, but the timeline will keep an audit event showing that you deleted it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteNote.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteNote.isPending}
              onClick={confirmDelete}
            >
              {deleteNote.isPending ? 'Deleting...' : 'Delete note'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}

